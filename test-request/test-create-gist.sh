#!/usr/bin/env zsh

# Gist を作成するテスト

cd $(dirname $0)/../

json='{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_gist",
    "arguments": {
      "description": "Test Gist from MCP Server",
      "files": {
        "hello.py": {
          "content": "#!/usr/bin/env python3\n\ndef main():\n    print(\"Hello, World from Gist!\")\n\nif __name__ == \"__main__\":\n    main()\n"
        },
        "README.md": {
          "content": "# Test Gist\n\nこれは MCP サーバーからのテスト用 Gist です。\n\n## 内容\n\n- hello.py: Python の Hello World スクリプト\n- README.md: このファイル\n"
        }
      },
      "public": false
    }
  }
}'

{
  echo "$json" | tr -d '\n'
  echo
} | ./launch.sh | jq