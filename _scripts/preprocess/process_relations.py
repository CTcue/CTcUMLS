#!/usr/bin/env python
# -*- coding: utf-8 -*-
from mrjob.job import MRJob
import tempfile
from collections import defaultdict
import csv
import os
import hashlib


# Set tmp dir to relative directory from script
basepath = os.path.dirname(__file__)
tmp_dir  = os.path.abspath(os.path.join(basepath, "mrjob_tmp"))
tempfile.tempdir = tmp_dir


# First load used CUI's
usedCUI = defaultdict(set)

try:
    with open(os.path.join(basepath, "..", "output", "concepts.txt")) as t:
        datareader = csv.reader(t, delimiter=str("\t"))
        for line in datareader:
            (CUI, LAT, SAB, CODE, PREF, TERMS) = line
            usedCUI[CUI].add(PREF)
except:
    print "Please run `python process_concepts.py` first to generate a list of used CUI's"



# Relations defined
# https://www.nlm.nih.gov/research/umls/knowledge_sources/metathesaurus/release/abbreviations.html#REL

# AQ  Allowed qualifier
# CHD has child relationship in a Metathesaurus source vocabulary
# DEL Deleted concept
# PAR has parent relationship in a Metathesaurus source vocabulary
# QB  can be qualified by.
# RB  has a broader relationship
# RL  the relationship is similar or "alike". the two concepts are similar or "alike". In the current edition of the Metathesaurus, most relationships with this attribute are mappings provided by a source, named in SAB and SL; hence concepts linked by this relationship may be synonymous, i.e. self-referential: CUI1 = CUI2. In previous releases, some MeSH Supplementary Concept relationships were represented in this way.
# RN  has a narrower relationship
# RO  has relationship other than synonymous, narrower, or broader
# RQ  related and possibly synonymous.
# RU  Related, unspecified
# SIB has sibling relationship in a Metathesaurus source vocabulary.
# SY  source asserted synonymy.
# XR  Not related, no mapping
#     Empty relationship

class AggregatorJob(MRJob):
    """
    Obtains unique relations by CUI1 / CUI2 combinations
    Output format: (CUI1, relation, CUI2)
    """

    def mapper(self, _, line):
        split = line.decode("utf-8").split("|")

        # MRREL header
        if len(split) == 17:
            (CUI1, AUI1, STYPE1, REL, CUI2, AUI2, STYPE2, RELA, RUI, SRUI, SAB, SL, RG, DIR, SUPPRESS, CVF, _) = split

            if CUI1 == "" or CUI2 == "" or CUI1 == CUI2:
                return

            # MSH for isa relations
            # SNOMED / ICD10 for hierarchy
            if not SAB or SAB not in ["SNOMEDCT_US", "ICD10CM"]:
                return

            if REL not in ["RN", "CHD", "SIB"]:
                return

            # Allow 'narrower' relations, but only `isa`
            if REL == "RN" and RELA != "isa":
                return

            if not CUI1 in usedCUI:
                return

            if not CUI2 in usedCUI:
                return

            # Skip relations that map term => "extended" children
            pref1 = usedCUI[CUI1] # set(["Simvastatin"])
            pref2 = usedCUI[CUI2] # set(["Simvastatin 40 MG Oral Tablet"])

            for child in pref2:
                if any(p.lower() in child.lower() for p in pref1):
                    return


            if REL == "CHD":
                relation = "child"
            elif REL == "SIB":
                relation = "sibling"
            elif REL == "RN" and RELA == "isa":
                relation = "isa"

            # Create "unique-sorted" key, to remove duplicate relations
            if CUI1 > CUI2:
                key = CUI2 + CUI1
            else:
                key = CUI1 + CUI2

            yield key, [CUI1, relation, CUI2]


    def reducer(self, key, values):
        relations = defaultdict(set)

        for (CUI1, rel, CUI2) in values:
            relations[rel] = (CUI1, CUI2)

        for rel, (CUI1, CUI2) in relations.iteritems():
            out = "\t".join([CUI1, rel, CUI2])
            print out.encode("utf-8")


if __name__ == "__main__":
    AggregatorJob.run()