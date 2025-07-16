#!/usr/bin/env zsh

# Gist 一覧を取得するテスト

cd $(dirname $0)/../

json='{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_gists",
    "arguments": {
      "per_page": 10,
      "page": 1
    }
  }
}'

{
  echo "$json" | tr -d '\n'
  echo
} | ./launch.sh | jq
