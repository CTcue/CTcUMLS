
var config  = require('../config/config.js');
var neo4j = require('neo4j');
var _ = require("lodash");

var db = new neo4j.GraphDatabase({
    url: 'http://localhost:7474',
    auth: config.neo4j
***REMOVED***);


var elastic = require('elasticsearch');
var elasticClient = new elastic.Client();

var getCategory = require("./lib/category.js");

const source = ["str", "lang", "types"];
const language_map = {
    "DUT" : "dutch",
    "ENG" : "english"
***REMOVED***;

module.exports = function *() {

    var body = this.request.body.query;


    var result = yield function(callback) {
        elasticClient.search({
            "index" : 'autocomplete',
            "size": 100,

            "_source": source,

            "body" : {
                "query" : {
                    "term" : {
                        "cui" : body
                 ***REMOVED***
             ***REMOVED***
        ***REMOVED***
    ***REMOVED***,
        function(err, resp) {
            if (resp && !!resp.hits && resp.hits.total > 0) {
                var hits = resp.hits.hits;

            ***REMOVED*** Return ES source part only
                if (hits.length) {
                    var types = result[0]._source.types;

                    return callback(false, [types, hits.map(s => s._source)]);
            ***REMOVED***
        ***REMOVED***

            callback(false, false);
    ***REMOVED***);
***REMOVED***;


    var types       = [];
    var found_terms = [];

    if (result) {
        types       = result[0];
        found_terms = result[1];
***REMOVED***


***REMOVED*** Check for user contributions
***REMOVED*** - If the current user added custom concepts/synonyms
    if (config.neo4j["is_active"]) {

        if (this.user) {
            var user_contributed = yield function(callback) {

                var cypherObj = {
                    "query": `MATCH
                                (s:Synonym {cui: {_CUI_***REMOVED*** ***REMOVED***)<-[r:LIKES]-(u:User { id: { _USER_ ***REMOVED***, env: { _ENV_ ***REMOVED*** ***REMOVED***)
                              RETURN
                                s.str as str, s.label as label`,

                    "params": {
                        "_CUI_": body,
                        "_USER_": this.user._id,
                        "_ENV_" : this.user.env
                ***REMOVED***,

                    "lean": true
            ***REMOVED***


                db.cypher(cypherObj, function(err, res) {
                    if (err) {
                        console.log(err);
                        callback(false, []);
                ***REMOVED***
                    ***REMOVED***
                        callback(false, res);
                ***REMOVED***
            ***REMOVED***);
        ***REMOVED***

        ***REMOVED*** Add user contributions
            if (user_contributed && user_contributed.length) {
                found_terms = found_terms.concat(user_contributed);
        ***REMOVED***
    ***REMOVED***


    ***REMOVED*** Check if anyone (any user) has unchecked concepts/synonyms
    ***REMOVED*** - Need more than 1 "downvote"
        var uncheck = yield function(callback) {
            var cypherObj = {
                "query": `MATCH
                            (s:Synonym {cui: {_CUI_***REMOVED*** ***REMOVED***)<-[r:DISLIKES]-(u:User)
                          WITH
                            type(r) as rel, s, count(s) as amount
                          WHERE
                            amount > 1
                          RETURN
                            s.str as term, s.label as label, rel, amount`,

                "params": {
                  "_CUI_": body
            ***REMOVED***,

                "lean": true
        ***REMOVED***

            db.cypher(cypherObj, function(err, res) {
                if (err) {
                    console.log(err);
                    callback(false, []);
            ***REMOVED***
                ***REMOVED***
                    callback(false, res);
            ***REMOVED***
        ***REMOVED***);
    ***REMOVED***
***REMOVED***



***REMOVED*** Group terms by label / language
    var terms = {***REMOVED***;

    for (var i=0; i < found_terms.length; i++) {
        var t = found_terms[i];
        var key = "custom";

        console.log(t)

        if (t["label"] !== "undefined") {
            key = t["label"].toLowerCase();
    ***REMOVED***
        else if (t["lang"] !== "undefined") {
            key = language_map[t["lang"]] || "custom";
    ***REMOVED***


        if (typeof terms[key] === "undefined") {
            terms[key] = [ t["str"] ];
    ***REMOVED***
        ***REMOVED***
            terms[key].push(t["str"]);
    ***REMOVED***
***REMOVED***

***REMOVED*** - Remove empty key/values
***REMOVED*** - Sort terms by their length
    for (var k in terms) {
        if (! terms[k].length) {
            delete terms[k];
    ***REMOVED***
        ***REMOVED***
            terms[k] = _.sortBy(terms[k], "length");
    ***REMOVED***
***REMOVED***


    this.body = {
      "category" : getCategory(types),
      "terms"    : terms,
      "uncheck"  : uncheck || []
***REMOVED***;
***REMOVED***;

