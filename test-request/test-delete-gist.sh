#!/usr/bin/env zsh

# Gist を削除するテスト
# 使用方法: ./test-delete-gist.sh <gist_id>

if [ $# -eq 0 ]; then
    echo "使用方法: $0 <gist_id>"
    echo "例: $0 1234567890abcdef1234567890abcdef12345678"
    exit 1
fi

GIST_ID=$1

echo "警告: この操作により Gist ID $GIST_ID が完全に削除されます。"
echo "本当に削除しますか? (y/N)"
read -r REPLY

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "削除がキャンセルされました。"
    exit 0
fi

cd $(dirname $0)/../

json="{
  \"jsonrpc\": \"2.0\",
  \"id\": 1,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"delete_gist\",
    \"arguments\": {
      \"gist_id\": \"$GIST_ID\"
    }
  }
}"

{
  echo "$json" | tr -d '\n'
  echo
} | ./launch.sh | jq