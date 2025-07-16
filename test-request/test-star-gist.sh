#!/usr/bin/env zsh

# Gist にスターを付けるテスト
# 使用方法: ./test-star-gist.sh <gist_id>

if [ $# -eq 0 ]; then
    echo "使用方法: $0 <gist_id>"
    echo "例: $0 1234567890abcdef1234567890abcdef12345678"
    exit 1
fi

GIST_ID=$1

cd $(dirname $0)/../

json="{
  \"jsonrpc\": \"2.0\",
  \"id\": 1,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"star_gist\",
    \"arguments\": {
      \"gist_id\": \"$GIST_ID\"
    }
  }
}"

{
  echo "$json" | tr -d '\n'
  echo
} | ./launch.sh | jq