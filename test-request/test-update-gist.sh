#!/usr/bin/env zsh

# Gist を更新するテスト
# 使用方法: ./test-update-gist.sh <gist_id>

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
    \"name\": \"update_gist\",
    \"arguments\": {
      \"gist_id\": \"$GIST_ID\",
      \"description\": \"Updated Test Gist from MCP Server\",
      \"files\": {
        \"hello.py\": {
          \"content\": \"#!/usr/bin/env python3\\n\\ndef main():\\n    print(\\\"Hello, Updated World from Gist!\\\")\\n    print(\\\"This file has been updated via MCP!\\\")\\n\\nif __name__ == \\\"__main__\\\":\\n    main()\\n\"
        },
        \"CHANGELOG.md\": {
          \"content\": \"# Changelog\\n\\n## [Updated] - $(date '+%Y-%m-%d')\\n\\n- ファイルが MCP サーバー経由で更新されました\\n- 新しい CHANGELOG.md ファイルを追加\\n\"
        }
      }
    }
  }
}"

{
  echo "$json" | tr -d '\n'
  echo
} | ./launch.sh | jq