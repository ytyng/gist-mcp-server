#!/usr/bin/env zsh
# memento-mcp-server 実行スクリプト

# エラーが発生したら即座に終了
set -e

cd "$(dirname "$0")" || exit 1

# .envファイルが存在する場合、環境変数を読み込む
# つまり、launch.sh 経由で起動して、.env があるなら、環境変数の指定は不要
# echo はできない。(JSON を出力する必要がある)
if [ -f .env ]; then
  set -a  # 自動エクスポートモードをオン
  source .env
  set +a  # 自動エクスポートモードをオフ
fi

# 必要な権限でDenoを実行
/opt/homebrew/bin/deno run \
  --allow-read=./ \
  --allow-net \
  --allow-write=$HOME/Downloads \
  --allow-env \
  main.ts
