#!/bin/bash

echo "Setting up Elasticsearch indexes"

# Elasticsearch index
index="autocomplete"

# Semantic types
declare -a types=(
  "pharmacologic_substance"
  "organic_chemical"
  "finding"
  "sign_or_symptom"
  "pathologic_function"
  "disease_or_syndrome"
  "neoplastic_process"
  "mental_or_behavioral_dysfunction"
  "experimental_model_of_disease"
  "cell_or_molecular_dysfunction"
  "injury_or_poisoning"
)


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
          "max_gram": 15
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

echo -e "\nAdding index mappings\n"

for t in "${types[@]}"
do
  curl -XPUT "http://localhost:9200/$index/$t/_mapping" -d '{
  "'"$t"'": {
      "properties": {
        "cui"      : { "type" : "string" },
        "terms"    : { "type" : "string", "analyzer": "autocomplete" },
        "words"    : { "type" : "string", "analyzer": "autocomplete" },

        "complete" : {
          "type"            : "completion",
          "index_analyzer"  : "simple",
          "search_analyzer" : "simple",
          "payloads" : true,

          "context": {
            "type": {
              "type": "category",
              "path": "_type"
            }
          }
        }
      }
    }
  }'

  echo " $t complete"
done

echo -e "\nCounting UMLS entries\n"
total=$(node count.js)
echo "Total records: $total";

echo -e "\nInserting UMLS entries\n"

for ((i=0, j=i+200; i<total; i+=200))
do
  node --harmony populate.js $i $j
  sleep 1
done

exit