#!/usr/bin/env python
# -*- coding: utf-8 -*-
from mrjob.job import MRJob
import tempfile
from collections import defaultdict
from normalize import normalize
from semantic import get_group
from body_parts import is_bodypart
from skip_categories import skip_categories
import re
import os



# Set tmp dir to relative directory from script
basepath = os.path.dirname(__file__)
tmp_dir  = os.path.abspath(os.path.join(basepath, "mrjob_tmp"))
tempfile.tempdir = tmp_dir


# Patterns
p_number = re.compile(r"^[0-9]+$")
p_roman  = re.compile("^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$", flags=re.I)



class AggregatorJob(MRJob):
    """
    Groups unique terms/synonyms by CUI, for each language.
    Output format: (CUI, LANG, PREF_TERM, [TYPES], [STR, STR, ...])
    """

    def mapper(self, _, line):
        split = line.decode("utf-8").split("|")

        # MRCONSO Header
        if len(split) == 19:
            (CUI, LAT, TS, LUI, STT, SUI, ISPREF, AUI, SAUI, SCUI, SDUI, SAB, TTY, CODE, STR, SRL, SUPPRESS, CVF, _) = split

            STR = STR.strip()

            if len(STR) < 2 or len(STR) > 30:
                return

            if ISPREF != 'Y' or STT != "PF":
                return

            # Language
            if LAT not in ['ENG', 'DUT']:
                return

            # Obsolete sources
            if TTY in ['N1', 'PM', 'OAS', 'OAF', 'OAM', 'OAP', 'OA', 'OCD', 'OET', 'OF', 'OLC', 'OM', 'ONP', 'OOSN', 'OPN', 'OP', 'LO', 'IS', 'MTH_LO', 'MTH_IS', 'MTH_OET']:
                return

            if SAB in ["CHV", "PSY", "ICD9", "ICD9CM", "NCI_FDA", "NCI_CTCAE", "NCI_CDISC", "ICPC2P", "SNOMEDCT_VET"]:
                return

            normalized = normalize(STR)

            # Skip NOS terms
            if re.match(r"(nos|NOS)$", normalized):
                return

            # Skip digit(s) only terms
            if re.match(p_number, normalized):
                return

            if re.match(p_roman, normalized):
                return

            # Skip records such as Pat.mo.dnt
            if normalized.count(".") >= 3 or normalized.count(":") >= 3:
                return

            if "." in normalized and "^" in normalized:
                return

            if TS == "P":
                yield CUI, ["PREF", LAT, normalize(STR), SAB]
            else:
                yield CUI, ["TERM", LAT, normalize(STR), SAB]


        # Additional Terms header
        elif len(split) == 4:
            (CUI, STR, LAT, SAB) = split

            if not STR:
                return

            STR = STR.strip()

            if STR.startswith(","):
                return

            yield CUI, ["TERM", LAT, STR, SAB]

        # Custom terms header
        elif len(split) == 5:
            (CUI, STR, LAT, SAB, PREF) = split
            STR = STR.strip()

            if PREF == "Y":
                yield CUI, ["PREF", LAT, STR, SAB]
            else:
                yield CUI, ["TERM", LAT, STR, SAB]

        # Custom terms header
        elif len(split) == 6:
            (CUI, STR, LAT, SAB, PREF, STY) = split
            STR = STR.strip()

            if PREF == "Y":
                yield CUI, ["PREF", LAT, STR, SAB]
            else:
                yield CUI, ["TERM", LAT, STR, SAB]


            if STY and len(STY):
                yield CUI, ["STY", STY]


        # MRSTY Header
        elif len(split) == 7:
            (CUI, TUI, STN, STY, ATUI, CVF, _) = split

            # Skipabble categories
            if STY in skip_categories:
                return

            group = get_group(TUI)
            yield CUI, ["STY", group]

        else:
            # Unknown file, so skip it
            pass


    def reducer(self, CUI, values):
        terms = defaultdict(lambda: defaultdict(set))
        preferred = defaultdict(list)
        types = set()

        for value in values:
            if value[0] == "TERM" or value[0] == "PREF":
                (LAT, STR, SAB) = value[1:]
                terms[LAT][SAB].add(STR)

                if value[0] == "PREF":
                    preferred[LAT].append(STR)

            elif value[0] == "STY":
                types.add(value[1])


        # Skip if no actual terms found
        if not terms:
            return

        # Check types
        # + custom concepts have their own "yield STY"
        if not types:
            return


        if any(x for x in types if x in ["LIVB", "CONC", "ACTI", "GEOG", "OBJC", "OCCU", "DEVI", "ORGA"]):
            return


        for LAT, SAB_terms in terms.iteritems():
            for SAB, v in SAB_terms.iteritems():

                # If ANATOMY category -> skip checking for anatomoy terms
                if not any(x for x in types if x == "ANAT"):
                    tmp_terms = set()
                    for t in v:
                        if not is_bodypart(t):
                            tmp_terms.add(t)
                    v = tmp_terms

                # Get unique terms per language
                unique = {t.lower(): t for t in v}.values()

                if not unique:
                    continue

                # Find preferred term
                if LAT in preferred:
                    pref_term = preferred[LAT][0]
                elif "ENG" in preferred:
                    pref_term = preferred["ENG"][0]
                else:
                    pref_term = list(unique)[0]

                out = "\t".join([CUI, LAT, SAB, "|".join(types), pref_term, "|".join(unique)])
                print out.encode("utf-8")


if __name__ == "__main__":
    AggregatorJob.run()