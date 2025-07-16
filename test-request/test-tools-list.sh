#!/usr/bin/env zsh

# ツール一覧を取得する

cd $(dirname $0)/../

json='{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

{
  echo "$json" | tr -d '\n'
  echo
} | ./launch.sh | jq
