#!/usr/bin/env node
'use strict';

/*
  Finds all UMLS entries between two given numbers (i.e. C0120000 - C0130000)
  in the Semantic Types defined below, that have at least one SNOWMED description.

  For each entry matching this criteria, it will lookup alternative, but unique,
  variants in english and dutch.
*/

var semanticTypes = [
  "Pharmacologic Substance",
  "Antibiotic",

  "Organic Chemical",

  "Sign or Symptom",
  "Disease or Syndrome",
    "Mental or Behavioral Dysfunction",
    "Neoplastic Process",

  "Cell or Molecular Dysfunction",
  "Injury or Poisoning"
];


var DEBUG = true || process.argv[4] === "debug";
var config  = require('../config/config.js');
var wrapper = require('co-mysql');
var mysql   = require('mysql');
var co      = require('co');

try {
  var connection = mysql.createConnection(config.mysql);
      connection.connect();

  var client = wrapper(connection);
***REMOVED***
catch (err) {
  console.log("MySQL database connection is down");
  process.exit(0);
***REMOVED***

var elastic = require('elasticsearch');
var _       = require('lodash');
var sugar   = require('sugar');

// Custom lib functions
var getUnique  = require('./lib/getUnique.js');
var digitToCUI = require('./lib/digitToCUI.js');

var elasticClient = new elastic.Client({
  "apiVersion" : "1.3"
***REMOVED***);

var between = digitToCUI(process.argv[2]) +"\" AND \"" + digitToCUI(process.argv[3]);
var preferredQuery = [
  "SELECT DISTINCT(a.CUI), b.STY FROM MRCONSO a INNER JOIN MRSTY b ON (a.CUI = b.CUI)",
  "WHERE a.CUI BETWEEN \""+ between + "\"",
    "AND b.STY in (\"" + semanticTypes.join("\",\"") + "\")"
].join(" ");

co(function *() {
  var recordCounter = 0;
  var cuiCodes = yield client.query(preferredQuery);

  if (! cuiCodes || cuiCodes.length === 0) {
    console.log("Could not find any CUI codes!");
    process.exit(0);
  ***REMOVED***

  var bulk = [];

  // Get all records for single CUI
  for (var i=0, N=cuiCodes.length; i<N; i++) {
***REMOVED*** Alternate/Different spellings
    var englishQuery = [
      "SELECT STR",
      "FROM MRCONSO",
      "WHERE CUI='" + cuiCodes[i].CUI + "'",
      "AND SAB IN ('SNOMEDCT_US')",
      "LIMIT 20"
    ].join(" ");

    var dutchQuery = [
      "SELECT STR",
      "FROM MRCONSO",
      "WHERE CUI='" + cuiCodes[i].CUI + "'",
      "AND SAB IN ('MDRDUT', 'MSHDUT', 'ICD10DUT', 'ICD9')",
      "LIMIT 30"
    ].join(" ");

    var englishTerms = yield client.query(englishQuery);
        englishTerms = _.pluck(englishTerms, 'STR');

    if (DEBUG) {
      console.log(cuiCodes[i].CUI);
  ***REMOVED***console.log(englishTerms);
***REMOVED***

    if (englishTerms.length === 0) {
      continue;
***REMOVED***

    var dutchTerms = yield client.query(dutchQuery);
        dutchTerms = _.pluck(dutchTerms, 'STR')

***REMOVED*** Now make the terms unique-ish for elasticsearch
    englishTerms = getUnique(englishTerms);
    dutchTerms   = getUnique(dutchTerms);

    if (DEBUG) {
      console.log("Unique\n", englishTerms.concat(dutchTerms));
  ***REMOVED***console.log("Unique dut", dutchTerms);
      console.log("----------");
***REMOVED***

    /*
***REMOVED*** Add document as a whole for expanding queries.
    bulk.push({
      "index" : {
        "_index" : "expander",
        "_type"  : "records",
  ***REMOVED***
***REMOVED***);

    bulk.push({
      "cui"  : cuiCodes[i].CUI,
      "type" : cuiCodes[i].STY,
      "str"  : englishTerms.concat(dutchTerms)
***REMOVED***);

    if (DEBUG) {
      console.log("Added expander doc");
***REMOVED***

***REMOVED*** For each english term add a document for autocompletions
    for (var j=0, L=englishTerms.length; j<L; j++) {
      recordCounter++;

      bulk.push({
        "index" : {
          "_index" : "autocomplete",
          "_type"  : "records",
    ***REMOVED***
  ***REMOVED***);

      bulk.push({
        "cui"   : cuiCodes[i].CUI,
        "str"   : englishTerms[j]
  ***REMOVED***);
***REMOVED***
    */
  ***REMOVED***

  connection.end();

  /*
  // No entries with usable CUI codes found
  if (bulk.length === 0) {
    process.exit(0);
  ***REMOVED***

  // Insert preffered in Elasticsearch
  elasticClient.bulk({'body' : bulk ***REMOVED***, function(err, body) {
    if (err) {
      console.log(err);
***REMOVED***
    ***REMOVED***
      console.log("Inserted " + recordCounter + " records between \"" + between + "\"");
***REMOVED***

    process.exit(0);
  ***REMOVED***);
  */
***REMOVED***);
