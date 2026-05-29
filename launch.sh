#!/usr/bin/env zsh
# gist-mcp-server 実行スクリプト

# エラーが発生したら即座に終了
set -e

cd "$(dirname "$0")" || exit 1

# .loadenv.sh が存在する場合、環境変数を読み込む
[ -f .loadenv.sh ] && source .loadenv.sh

# 必要な権限でDenoを実行
# --allow-run=op: GITHUB_TOKEN を遅延ロードする getter command (op read) の実行用
/opt/homebrew/bin/deno run \
  --allow-read=./ \
  --allow-net \
  --allow-write=$HOME/Downloads,/tmp \
  --allow-env \
  --allow-run=op \
  main.ts
