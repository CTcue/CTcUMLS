#!/usr/bin/env node
'use strict';

var config  = require('../config/config.js');

var wrapper = require('co-mysql'),
    mysql   = require('mysql'),
    co      = require('co');

var connection = mysql.createConnection(config.mysql);
    connection.connect();

var client = wrapper(connection);

var elastic = require('elasticsearch');
var sugar   = require('sugar');
var _       = require('lodash');
var utf8    = require('utf8');

var elasticClient = new elastic.Client({
  "apiVersion" : "1.3",

  "log" : [
    {
      type  : 'file',
      level : 'trace',
      path  : './elastic_trace.log'
    },
    {
      type  : 'file',
      level : 'error',
      path  : './elastic_error.log'
    }
  ]
});

var semanticTypes = require('./semanticTypes.js');
var limit  = [ process.argv[2], process.argv[3] ];

co(function *() {
  var cuiQuery = [
    "SELECT DISTINCT CUI, STY",
    "FROM MRSTY",
    "WHERE STY IN ('"+ semanticTypes.join("', '") + "')",
    "LIMIT " + limit.join(", ")
  ].join(" ");

  var cuiCodes = yield client.query(cuiQuery);

  if (! cuiCodes) {
    console.log("Could not get CUI codes!");
    process.exit(0);
  }

  var bulk = [];

  // Get all records for single CUI
  for (var i=0, L=cuiCodes.length; i<L; i++) {

    // Get preferred terms
    var preferredQuery = [
      "SELECT STR",
      "FROM MRCONSO",
      "WHERE CUI='" + cuiCodes[i].CUI + "'",
      "AND SAB IN ('SNOMEDCT_US', 'ICD10CM')",
      "AND TS='P'",
      "AND STT='PF'",
      "AND ISPREF='Y'",
      "AND LAT IN ('DUT', 'ENG')"
    ].join(" ");

    // Alternate/Different spellings
    var alternateQuery = [
      "SELECT STR",
      "FROM MRCONSO",
      "WHERE CUI='" + cuiCodes[i].CUI + "'",
      "AND SAB IN ('SNOMEDCT_US', 'ICD10CM')",
      "AND LAT IN ('DUT', 'ENG')"
    ].join(" ");

    var preferred = yield client.query(preferredQuery);
    var alternate = yield client.query(alternateQuery);

    if (preferred) {
      var definitions = _.pluck(preferred, 'STR');
          definitions = getUniqueDefinitions(definitions);

      // Alternate definitions
      var altDefinitions = _.pluck(alternate, 'STR');
          altDefinitions = getUniqueDefinitions(altDefinitions);


      // Select unique words from preferred definitions
      var words = _.map(definitions, function(str) {
        return _.reject(str.words(), function(str) {
          return str.length < 5;
        });
      });

      words = _.uniq(_.flatten(words, true));


      // Add document to bulk list
      bulk.push({
        "index" : {
          "_index" : "autocomplete",
          "_type"  : cuiCodes[i].STY.toLowerCase().replace(/ /g, "_"),
        }
      });

      bulk.push({
        "cui"   : cuiCodes[i].CUI,
        "words" : words,

        // Check  for abbr

        // To allow prefix query for incomplete starting words
        "startsWith" : words[0],

        "terms" : definitions.concat(altDefinitions),

        "complete" : {
          "weight"  : scoreTerms(definitions),
          "input"   : definitions,
          "output"  : definitions,
          "payload" : { "cui" : cuiCodes[i].CUI, "codes" : definitions }
        }
      });
    }
  }

  connection.end();

  // Insert preffered in Elasticsearch
  elasticClient.bulk({'body' : bulk }, function(err, body) {
    if (err) {
      console.log(err);
    }
    else {
      var offset = parseInt(process.argv[2], 10);
      var end    = offset + parseInt(process.argv[3], 10);

      console.log("Inserted " + offset + "," + end);
    }

    process.exit(0);
  });
});


// +- the avg. length of terms
function scoreTerms(terms) {
  var sum = _.reduce(terms, function(sum, str) {
    return sum + str.length;
  }, 0);

  var average = sum / terms.length;
      average = average > 40 ? average + 10 : average;

  return Math.ceil(1000/average);
}

var diacritics = [
    {'base':'a','letters':/[\u00E1\u00E2\u00E3\u00E4\u00E5\u0101\u0103\u0105\u01CE\u01FB\u00C0\u00C4]/g},
    {'base':'ae','letters':/[\u00E6\u01FD]/g},
    {'base':'c','letters':/[\u00E7\u0107\u0109\u010B\u010D]/g},
    {'base':'d','letters':/[\u010F\u0111\u00F0]/g},
    {'base':'e','letters':/[\u00E8\u00E9\u00EA\u00EB\u0113\u0115\u0117\u0119\u011B]/g},
    {'base':'f','letters':/[\u0192]/g},
    {'base':'g','letters':/[\u011D\u011F\u0121\u0123]/g},
    {'base':'h','letters':/[\u0125\u0127]/g},
    {'base':'i','letters':/[\u00ED\u00EC\u00EE\u00EF\u0129\u012B\u012D\u012F\u0131]/g},
    {'base':'ij','letters':/[\u0133]/g},
    {'base':'j','letters':/[\u0135]/g},
    {'base':'k','letters':/[\u0137\u0138]/g},
    {'base':'l','letters':/[\u013A\u013C\u013E\u0140\u0142]/g},
    {'base':'n','letters':/[\u00F1\u0144\u0146\u0148\u0149\u014B]/g},
    {'base':'o','letters':/[\u00F2\u00F3\u00F4\u00F5\u00F6\u014D\u014F\u0151\u01A1\u01D2\u01FF]/g},
    {'base':'oe','letters':/[\u0153]/g},
    {'base':'r','letters':/[\u0155\u0157\u0159]/g},
    {'base':'s','letters':/[\u015B\u015D\u015F\u0161]/g},
    {'base':'t','letters':/[\u0163\u0165\u0167]/g},
    {'base':'u','letters':/[\u00F9\u00FA\u00FB\u00FC\u0169\u016B\u016B\u016D\u016F\u0171\u0173\u01B0\u01D4\u01D6\u01D8\u01DA\u01DC]/g},
    {'base':'w','letters':/[\u0175]/g},
    {'base':'y','letters':/[\u00FD\u00FF\u0177]/g},
    {'base':'z','letters':/[\u017A\u017C\u017E]/g},
    {'base':'A','letters':/[\u00C1\u00C2\u00C3\uCC04\u00C5\u00E0\u0100\u0102\u0104\u01CD\u01FB]/g},
    {'base':'AE','letters':/[\u00C6]/g},
    {'base':'C','letters':/[\u00C7\u0106\u0108\u010A\u010C]/g},
    {'base':'D','letters':/[\u010E\u0110\u00D0]/g},
    {'base':'E','letters':/[\u00C8\u00C9\u00CA\u00CB\u0112\u0114\u0116\u0118\u011A]/g},
    {'base':'G','letters':/[\u011C\u011E\u0120\u0122]/g},
    {'base':'H','letters':/[\u0124\u0126]/g},
    {'base':'I','letters':/[\u00CD\u00CC\u00CE\u00CF\u0128\u012A\u012C\u012E\u0049]/g},
    {'base':'IJ','letters':/[\u0132]/g},
    {'base':'J','letters':/[\u0134]/g},
    {'base':'K','letters':/[\u0136]/g},
    {'base':'L','letters':/[\u0139\u013B\u013D\u013F\u0141]/g},
    {'base':'N','letters':/[\u00D1\u0143\u0145\u0147\u0149\u014A]/g},
    {'base':'O','letters':/[\u00D2\u00D3\u00D4\u00D5\u00D6\u014C\u014E\u0150\u01A0\u01D1]/g},
    {'base':'OE','letters':/[\u0152]/g},
    {'base':'R','letters':/[\u0154\u0156\u0158]/g},
    {'base':'S','letters':/[\u015A\u015C\u015E\u0160]/g},
    {'base':'T','letters':/[\u0162\u0164\u0166]/g},
    {'base':'U','letters':/[\u00D9\u00DA\u00DB\u00DC\u0168\u016A\u016C\u016E\u0170\u0172\u01AF\u01D3\u01D5\u01D7\u01D9\u01DB]/g},
    {'base':'W','letters':/[\u0174]/g},
    {'base':'Y','letters':/[\u0178\u0176]/g},
    {'base':'Z','letters':/[\u0179\u017B\u017D]/g}
];

function removeDiacritics(str) {
  for(var i=0, L=diacritics.length; i<L; i++) {
    str = str.replace(diacritics[i].letters, diacritics[i].base);
  }

  return str;
}

function getUniqueDefinitions(list) {
  return _.uniq(_.map(list, function(str) {
    try {
      str = utf8.decode(str);

      return removeDiacritics(str)
          .toLowerCase()
          .replace(/\W+/g, " ")
          .replace(/  /g, " ")
          .trim();
    }
    catch (err) {
     return "";
    }
  }));
}

