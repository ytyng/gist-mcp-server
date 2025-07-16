# gist-mcp-server

GitHub Gist の作成・管理用の MCP (Model Context Protocol) サーバーです。

## 概要

この MCP サーバーは、GitHub Gist API との連携を提供し、AI アシスタントから GitHub Gist の管理操作を可能にします。コードスニペットやファイルの共有、プライベート・パブリック Gist の作成、画像アップロード機能をサポートします。

### 主な特徴

- **Gist 作成・管理**: 単一・複数ファイルの Gist を作成・更新・削除
- **プライバシー制御**: プライベート・パブリック Gist の選択可能
- **画像アップロード**: Base64 エンコードされた画像を Gist にアップロード
- **スター機能**: Gist のスター付け・削除機能
- **一覧表示**: 自分や他のユーザーの Gist 一覧表示
- **型安全性**: TypeScript + Zod による厳密な型チェック
- **エラーハンドリング**: 堅牢なエラー処理とユーザーフレンドリーなメッセージ

## セットアップ

### 必要な環境

- **Deno**: v1.40 以降
- **GitHub Personal Access Token**: Gist 権限を持つトークン

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd gist-mcp-server
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` ファイルを作成し、GitHub トークンを設定します：

```bash
cp .env.example .env
```

`.env` ファイルを編集：

```bash
# GitHub Personal Access Token
# 必要な権限: gist (Gist の作成・読み書き・削除)
GITHUB_TOKEN=your_github_token_here
```

### 3. GitHub Personal Access Token の取得

1. GitHub の Settings > Developer settings > Personal access tokens > Tokens (classic) に移動
2. "Generate new token (classic)" をクリック
3. 必要な権限を選択：
   - `gist` - Gist の作成・読み書き・削除
4. トークンを生成し、`.env` ファイルに設定

### 4. 動作確認

```bash
# MCP サーバーを起動
./launch.sh

# または直接実行
deno run --allow-read --allow-net --allow-env main.ts
```

## 利用可能なツール

### 📝 Gist 管理

- **`create_gist`**: GitHub Gist を作成
  - `description`: Gist の説明（オプション）
  - `files`: ファイル名をキーとした、ファイル内容のオブジェクト
  - `public`: パブリック Gist かどうか（デフォルト: false）

- **`get_gist`**: 指定された ID の Gist を取得
  - `gist_id`: 取得したい Gist の ID

- **`update_gist`**: 既存の Gist を更新
  - `gist_id`: 更新したい Gist の ID
  - `description`: 新しい説明（オプション）
  - `files`: 更新するファイル（オプション）

- **`delete_gist`**: 指定された ID の Gist を削除
  - `gist_id`: 削除したい Gist の ID

- **`list_gists`**: ユーザーの Gist 一覧を取得
  - `username`: 取得したいユーザー名（省略時は認証されたユーザー）
  - `per_page`: 1ページあたりの件数（1-100、デフォルト: 30）
  - `page`: 取得するページ番号（デフォルト: 1）

### 🖼️ 画像アップロード

- **`upload_image_to_gist`**: 画像を Base64 エンコードして Gist にアップロード
  - `filename`: 画像ファイル名
  - `base64_content`: Base64 エンコードされた画像データ
  - `description`: Gist の説明（オプション）

### ⭐ スター機能

- **`star_gist`**: 指定された Gist にスターを付ける
  - `gist_id`: スターを付けたい Gist の ID

- **`unstar_gist`**: 指定された Gist のスターを外す
  - `gist_id`: スターを外したい Gist の ID

## 使用例

### 基本的な使用フロー

1. **単一ファイル Gist 作成**
   ```
   create_gist を実行
   - description: "Python Hello World"
   - files: {"hello.py": {"content": "print('Hello, World!')"}}
   - public: false
   ```

2. **複数ファイル Gist 作成**
   ```
   create_gist を実行
   - description: "React Component Example"
   - files: {
       "Component.jsx": {"content": "import React from 'react'..."},
       "styles.css": {"content": ".component { color: blue; }"}
     }
   - public: true
   ```

3. **Gist 一覧確認**
   ```
   list_gists を実行
   → 作成済み Gist の一覧を確認
   ```

4. **Gist 詳細確認**
   ```
   get_gist に gist_id を指定
   → Gist の詳細情報を確認
   ```

5. **Gist 更新**
   ```
   update_gist に gist_id と更新内容を指定
   → ファイル内容や説明を変更
   ```

6. **画像アップロード**
   ```
   upload_image_to_gist を実行
   - filename: "screenshot.png"
   - base64_content: "iVBORw0KGgoAAAANSUhEUgAA..."
   - description: "アプリのスクリーンショット"
   ```

## テスト

### 動作確認テスト

test-request ディレクトリ内のスクリプトを使用して動作確認ができます：

```bash
cd test-request

# ツール一覧の確認
./test-tools-list.sh

# Gist 作成テスト
./test-create-gist.sh

# Gist 一覧取得テスト
./test-list-gists.sh

# Gist 詳細取得テスト（gist_id が必要）
./test-get-gist.sh <gist_id>

# Gist 更新テスト（gist_id が必要）
./test-update-gist.sh <gist_id>

# Gist 削除テスト（gist_id が必要）
./test-delete-gist.sh <gist_id>
```

## 開発

### プロジェクト構造

```
gist-mcp-server/
├── main.ts                         # MCP サーバーのエントリーポイント
├── lib/
│   ├── gist.ts                     # GitHub Gist API 関連の機能実装
│   └── mcp-server-instructions.md  # MCP サーバーの説明文
├── test-request/                   # 動作確認用スクリプト
├── deno.json                       # Deno 設定ファイル
├── .env.example                    # 環境変数のサンプル
├── launch.sh                       # 実行スクリプト
├── CLAUDE.md                       # Claude Code 用のガイド
└── README.md                       # このファイル
```

### 技術スタック

- **言語**: TypeScript
- **ランタイム**: Deno
- **MCP フレームワーク**: `@modelcontextprotocol/sdk`
- **スキーマ検証**: Zod
- **API クライアント**: Fetch API

### 設計原則

1. **型安全性**: TypeScript + Zod による厳密な型チェック
2. **エラーハンドリング**: すべての API 呼び出しとユーザー入力に対する適切なエラー処理
3. **入力検証**: MCP ツール層での入力値検証
4. **レスポンス構造**: 統一されたエラー・成功レスポンス形式
5. **セキュリティ**: デフォルトでプライベート Gist として作成

### GitHub Gist API エンドポイント

使用する主要な API エンドポイント：

| エンドポイント | メソッド | 説明 |
|----------------|----------|------|
| `/gists` | GET | Gist 一覧取得 |
| `/gists` | POST | Gist 作成 |
| `/gists/{id}` | GET | Gist 詳細取得 |
| `/gists/{id}` | PATCH | Gist 更新 |
| `/gists/{id}` | DELETE | Gist 削除 |
| `/gists/{id}/star` | PUT/DELETE | スター付け/削除 |

## トラブルシューティング

### よくある問題と解決方法

1. **認証エラー (401 Unauthorized)**
   - `.env` ファイルの `GITHUB_TOKEN` が正しく設定されているか確認
   - トークンに `gist` 権限が付与されているか確認
   - トークンの有効期限を確認

2. **ネットワークエラー**
   - インターネット接続を確認
   - ファイアウォール設定を確認
   - GitHub API の稼働状況を確認

3. **リソースが見つからない (404 Not Found)**
   - 指定した gist_id が正しいか確認
   - 削除済みの Gist ではないか確認
   - プライベート Gist の場合、所有者であることを確認

4. **デバッグモード**
   ```bash
   # デバッグ情報を有効にして実行
   DENO_LOG=debug deno run --allow-read --allow-net --allow-env main.ts
   ```

### ログ例

```
Warning: Failed to load instructions file: ...
Starting gist-mcp-server v1.0.0
```

## セキュリティ考慮事項

- **API トークン管理**: `.env` ファイルはリポジトリにコミットしない
- **デフォルトプライベート**: 全ての Gist はデフォルトでプライベートとして作成
- **権限管理**: 必要最小限の権限（gist のみ）を持つトークンを使用
- **機密情報**: 機密情報を含むファイルは Gist に保存しない

## ライセンス

プライベートプロジェクト

## 貢献

このプロジェクトは個人用途のため、外部からの貢献は受け付けていません。

## サポート

技術的な問題や質問については、プロジェクトの Issue トラッカーを使用してください。