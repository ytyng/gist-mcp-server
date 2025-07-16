#!/usr/bin/env zsh

# 画像を Gist にアップロードするテスト
# 使用方法: ./test-upload-image.sh [image_file_path]

IMAGE_FILE=$1

if [ $# -eq 0 ]; then
    # デフォルトでサンプル画像（小さな PNG）を作成
    echo "画像ファイルが指定されていません。サンプル画像を使用します。"
    # 1x1 ピクセルの透明な PNG の Base64 データ
    BASE64_CONTENT="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWgmQ8wAAAABJRU5ErkJggg=="
    FILENAME="sample.png"
else
    if [ ! -f "$IMAGE_FILE" ]; then
        echo "エラー: ファイル '$IMAGE_FILE' が見つかりません。"
        exit 1
    fi
    
    # ファイルを Base64 エンコード
    BASE64_CONTENT=$(base64 -i "$IMAGE_FILE" | tr -d '\n')
    FILENAME=$(basename "$IMAGE_FILE")
fi

cd $(dirname $0)/../

json="{
  \"jsonrpc\": \"2.0\",
  \"id\": 1,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"upload_image_to_gist\",
    \"arguments\": {
      \"filename\": \"$FILENAME\",
      \"base64_content\": \"$BASE64_CONTENT\",
      \"description\": \"Image uploaded via MCP Server test\"
    }
  }
}"

{
  echo "$json" | tr -d '\n'
  echo
} | ./launch.sh | jq