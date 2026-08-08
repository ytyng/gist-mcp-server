#!/usr/bin/env zsh
# gist-mcp-server 実行スクリプト

# エラーが発生したら即座に終了
set -e

cd "$(dirname "$0")" || exit 1

# 設定は ${HOME}/.config/gist-mcp-server/config.yaml から読む。
# プロジェクトフォルダの .env / .loadenv.sh は読まない。
# --allow-run=op: config_override_command (op read) の実行用
/opt/homebrew/bin/deno run \
  --allow-read=./,$HOME/.config/gist-mcp-server \
  --allow-net \
  --allow-write=$HOME/Downloads,/tmp \
  --allow-env \
  --allow-run=op \
  main.ts
