# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

gist-mcp-server は、GitHub Gist の作成・管理用の MCP (Model Context Protocol) サーバーです。AI アシスタントが MCP プロトコル経由で GitHub Gist API と連携し、コードスニペットやファイルの共有、プライベート・パブリック Gist の作成などの包括的な Gist 管理機能を提供します。

### 主要機能
- GitHub Gist の作成・更新・削除
- プライベート・パブリック Gist の選択制御
- 複数ファイル対応の Gist 作成
- Gist のスター機能（付ける・外す）
- ユーザー Gist 一覧表示
- 型安全な API 設計と堅牢なエラーハンドリング

## 技術スタック

- **言語**: TypeScript
- **ランタイム**: Deno (v1.40以降)
- **MCP フレームワーク**: `@modelcontextprotocol/sdk`
- **スキーマ検証**: Zod
- **テスト**: Deno 標準テストランナー

## 開発コマンド

### 基本実行
```bash
# MCP サーバーを起動
./launch.sh

# または直接実行
deno run --allow-read --allow-net --allow-env main.ts
```

### 動作確認
```bash
cd test-request

# ツール一覧の確認
./test-tools-list.sh

# Gist 作成テスト
./test-create-gist.sh

# Gist 一覧取得テスト
./test-list-gists.sh

# Gist 詳細取得テスト
./test-get-gist.sh <gist_id>

# Gist 更新テスト
./test-update-gist.sh <gist_id>

# Gist 削除テスト
./test-delete-gist.sh <gist_id>

# スター機能テスト
./test-star-gist.sh <gist_id>
./test-unstar-gist.sh <gist_id>
```

## アーキテクチャ

### ディレクトリ構造
```
gist-mcp-server/
├── main.ts                     # MCP サーバーのエントリーポイント、ツール定義
├── lib/
│   ├── gist.ts                 # GitHub Gist API 通信ロジック、型定義
│   └── mcp-server-instructions.md # MCP サーバーの説明文
├── test-request/               # 動作確認用スクリプト
├── deno.json                   # Deno 設定、依存関係
├── .env.example                # 環境変数テンプレート
├── launch.sh                   # 実行用スクリプト
└── README.md                   # ユーザー向けドキュメント
```

### 主要なファイルの役割

#### `main.ts`
- MCP サーバーのエントリーポイント
- 8つの MCP ツールの定義と登録
- Zod による入力値検証
- グローバル例外ハンドラーの設定

#### `lib/gist.ts`
- GitHub Gist API との通信を担当
- 型定義（Gist, GistFile, CreateGistInput, レスポンス型）
- API 通信の共通エラーハンドリング
- Gist 情報の整形とフォーマット

#### `lib/mcp-server-instructions.md`
- MCP サーバーの説明文（Markdown 形式）
- main.ts で動的に読み込まれる
- GitHub Gist サービスの概要と使用方法を記載

## MCP ツール一覧

### Gist 管理系
1. **`create_gist`**: GitHub Gist 作成
2. **`get_gist`**: Gist 詳細取得
3. **`update_gist`**: Gist 更新
4. **`delete_gist`**: Gist 削除
5. **`list_gists`**: Gist 一覧取得

### 拡張機能系
6. **`star_gist`**: Gist にスターを付ける
7. **`unstar_gist`**: Gist のスターを外す

## 環境設定

### 必須環境変数
`.env` ファイルに以下を設定：
```bash
GITHUB_TOKEN=your_github_personal_access_token_here
```

### GitHub Personal Access Token の取得
1. GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. "Generate new token (classic)" をクリック
3. 必要な権限を選択：
   - `gist` - Gist の作成・読み書き・削除
4. トークンを生成し、`.env` ファイルに設定

### 開発環境の準備
1. Deno のインストール
2. `.env.example` を `.env` にコピーして GitHub トークンを設定
3. `./launch.sh` で動作確認

## GitHub Gist API 仕様とエンドポイント

### ベース URL
`https://api.github.com`

### 主要エンドポイント

| エンドポイント | メソッド | 機能 | パラメータ |
|----------------|----------|------|------------|
| `/gists` | GET | Gist 一覧取得 | per_page, page, since |
| `/gists` | POST | Gist 作成 | description, files, public |
| `/gists/{id}` | GET | Gist 詳細取得 | - |
| `/gists/{id}` | PATCH | Gist 更新 | description, files |
| `/gists/{id}` | DELETE | Gist 削除 | - |
| `/gists/{id}/star` | PUT | スター付け | - |
| `/gists/{id}/star` | DELETE | スター削除 | - |
| `/users/{username}/gists` | GET | ユーザー Gist 一覧 | per_page, page |

### 認証
- **方式**: Bearer Token
- **ヘッダー**: `Authorization: Bearer <token>`

## 重要な実装ポイント

### 1. エラーハンドリング戦略
- **統一されたエラーレスポンス**: `GistAPIError` クラス
- **HTTP ステータス別エラーメッセージ**: 適切なエラー分類
- **ネットワークエラーの検出**: fetch エラーの適切な分類
- **入力値検証**: Zod スキーマによる事前検証

### 2. 型安全性の確保
- **厳密な型定義**: `Gist`, `GistFile`, `CreateGistInput`, `UpdateGistInput`
- **Null 安全**: オプショナルプロパティの適切な処理
- **レスポンス型の統一**: GitHub API レスポンスの型定義

### 3. セキュリティとプライバシー
- **デフォルトプライベート**: 明示的に指定しない限りプライベート Gist として作成
- **権限最小化**: gist 権限のみを要求
- **トークン管理**: 環境変数からの安全な取得


### 4. ユーザビリティ
- **日本語メッセージ**: エラー・成功メッセージの日本語対応
- **詳細表示**: Gist 情報の分かりやすい整形表示
- **ページネーション**: 大量 Gist の効率的な取得

## トラブルシューティング

### よくある問題とデバッグ方法

1. **GitHub トークンエラー**
   ```bash
   # 環境変数の確認
   echo $GITHUB_TOKEN

   # .env ファイルの確認
   cat .env
   ```

2. **ネットワーク接続問題**
   ```bash
   # GitHub API 接続テスト
   curl -H "Authorization: Bearer $GITHUB_TOKEN" \
        https://api.github.com/gists
   ```

3. **デバッグモード実行**
   ```bash
   # 詳細ログ付き実行
   DENO_LOG=debug deno run --allow-read --allow-net --allow-env main.ts
   ```

4. **型エラーの確認**
   ```bash
   # 型チェックのみ実行
   deno check main.ts
   ```

### パフォーマンス最適化

1. **API 呼び出しの最適化**
   - 適切なページネーション設定
   - 必要最小限のデータ取得

2. **メモリ使用量の最適化**
   - 大量 Gist 取得時の制限（最大100件/ページ）
   - Base64 画像の適切なサイズ制限

## セキュリティ考慮事項

1. **GitHub トークンの管理**
   - `.env` ファイルを `.gitignore` に含める
   - 本番環境では環境変数での設定を推奨
   - 最小権限（gist のみ）の原則

2. **入力値検証**
   - すべてのユーザー入力を Zod スキーマで検証
   - 悪意のあるコンテンツの検出

3. **プライバシー保護**
   - デフォルトでプライベート Gist として作成
   - 機密情報をログに出力しない

## テスト戦略

### 動作確認テスト
- `test-request/` スクリプト群による API テスト
- 実際の GitHub API との通信テスト

### 今後のテスト拡張
- モック機能の追加検討
- エッジケースのテスト追加
- パフォーマンステストの実装

## 保守・拡張時の注意点

### コード変更時
1. 型定義の更新時は、関連する全ての関数の型注釈も確認
2. GitHub API 仕様変更時は、エンドポイント一覧とドキュメントも更新
3. 新しいエラーケース追加時は、エラーハンドリング関数も更新

### 新機能追加時
1. Zod スキーマによる入力検証を必ず実装
2. エラーレスポンスは統一フォーマットを使用
3. テストスクリプトを同時に作成
4. README.md と CLAUDE.md の両方を更新

この情報により、Claude Code は効率的にこのプロジェクトでの開発作業を行うことができます。