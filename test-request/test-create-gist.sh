#!/usr/bin/env zsh

# Gist を作成するテスト

cd $(dirname $0)/../

# Python ファイルの内容（\n を使って改行を表現）
PYTHON_CONTENT='#!/usr/bin/env python3\\n\\ndef main():\\n    print(\\"Hello, World from Gist!\\")\\n\\nif __name__ == \\"__main__\\":\\n    main()'

# README ファイルの内容（\n を使って改行を表現）
README_CONTENT='# Test Gist\\n\\nこれは MCP サーバーからのテスト用 Gist です。\\n\\n## 内容\\n\\n- hello.py: Python の Hello World スクリプト\\n- README.md: このファイル'

# JSON を手動で構築（改行文字を適切にエスケープ）
json="{
  \"jsonrpc\": \"2.0\",
  \"id\": 1,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"create_gist\",
    \"arguments\": {
      \"description\": \"Test Gist from MCP Server\",
      \"files\": {
        \"hello.py\": {
          \"content\": \"$PYTHON_CONTENT\"
        },
        \"README.md\": {
          \"content\": \"$README_CONTENT\"
        }
      },
      \"public\": false
    }
  }
}"

echo "$json"

{
  echo "$json" | tr -d '\n'
  echo
} | ./launch.sh | jq
