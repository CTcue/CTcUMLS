#!/bin/bash

# Elasticsearch index
index="autocomplete"

curl -XDELETE "http://localhost:9200/$index"
echo " index deleted"

curl -XPUT "http://localhost:9200/$index" -d '{
  "settings" : {
    "number_of_shards"   : 1,
    "number_of_replicas" : 0,

    "analysis": {
      "filter": {
        "autocomplete_filter": {
          "type":     "edge_ngram",
          "min_gram": 3,
          "max_gram": 12
        }
      },

      "analyzer": {
        "autocomplete": {
          "type":      "custom",
          "tokenizer": "standard",
          "filter": [
            "asciifolding",
            "lowercase",
            "autocomplete_filter"
          ]
        }
      }
    }
  }
}'
echo " new index created"

curl -XPUT "http://localhost:9200/$index/records/_mapping" -d '{
"records" : {
    "properties": {
      "cui"  : { "type" : "string" },
      "type" : { "type" : "string" },

      "eng" : { "type" : "string", "analyzer": "autocomplete" },
      "dut" : { "type" : "string", "analyzer": "autocomplete" }
    }
  }
}'
echo " mapping added"


echo -e "\nCounting UMLS entries\n"
total=100 #$(node count.js)

echo -e "\nInserting $total UMLS entries\n"

for ((i=0, j=i+10; i<total; i+=10))
do
  node --harmony populate.js $i $j
  sleep 1
done

exit