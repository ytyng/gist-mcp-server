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
- **ランタイム**: Deno (v2.1 以降)
  - 以前は「v1.40 以降」と書いてあったが実態と合っていなかった (`main` の
    `deno.lock` が既に lockfile v4 = Deno 2.x 必須だった)。現在の下限は
    `jsr:` 指定子 (1.42+)・`Deno.errors.NotCapable` (2.0+)・lockfile v5 (2.1+)
    で決まる
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
│   ├── config.ts               # 設定ファイルの遅延ロード、config_override_command
│   ├── config_test.ts          # config.ts のユニットテスト
│   └── mcp-server-instructions.md # MCP サーバーの説明文
├── test-request/               # 動作確認用スクリプト
├── deno.json                   # Deno 設定、依存関係
├── config.example.yaml         # 設定ファイルのテンプレート
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
8. **`prune_old_gists`**: 指定日数以上前に作成された Gist を一括削除 (二重ゲート設計)

## 設定

### 設定ファイル

設定は **リポジトリの外**、`${HOME}/.config/gist-mcp-server/config.yaml` に置く
(`config.yml` も可。両方あれば `config.yaml` が優先)。

```yaml
github_token: your_github_personal_access_token_here
```

プロジェクトフォルダの `.env` / `.loadenv.sh` は**使わない**。起動元が複数あり
(launch.sh・gist-cli のラッパー)、それぞれが同じ .env を source する構成だったため、
設定の置き場を 1 箇所に寄せた。

### GitHub Personal Access Token の取得
1. GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. "Generate new token (classic)" をクリック
3. 必要な権限を選択：
   - `gist` - Gist の作成・読み書き・削除
4. トークンを生成し、設定ファイルの `github_token` に設定

### 開発環境の準備
1. Deno のインストール
2. `config.example.yaml` を `~/.config/gist-mcp-server/config.yaml` にコピーして
   トークンを設定 (`chmod 600`)
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

### API 制約 (重要)

- **visibility フィルター不在**: `/gists` には Secret/Public で絞り込む query parameter が存在しない。クライアント側で `gist.public` を見て弾くしかない。`/gists/public` は「全ユーザーの新着パブリック Gist」、`/gists/starred` は「自分がスターした Gist」で、認証ユーザー所有 Gist の visibility 絞り込みには使えない。
- **`/users/<username>/gists` はパブリックのみ**: 他人の Secret Gist は API では取得不可能。CLI/MCP で `--username` + `--visibility=secret` を併用すると常に 0 件返る (ヘルプとランタイム警告で明示)。
- **per_page 上限**: 1-100。`listAllGists` ではこの範囲にクランプし、`batch.length === 0` でも break して無限ループを防ぐ。

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
- **デフォルト Secret**: 明示的に指定しない限り Secret Gist として作成
- **権限最小化**: gist 権限のみを要求
- **トークン管理**: 環境変数からの安全な取得
- **可視性の表記統一**: ユーザー向け表示は `Secret` / `Public` で統一する (`Private` は使わない)。GitHub 公式が "Secret gist" と呼び、CLI/MCP のフラグ名も `--visibility=secret` のため。

### 4. ユーザビリティ
- **日本語メッセージ**: エラー・成功メッセージの日本語対応
- **詳細表示**: Gist 情報の分かりやすい整形表示
- **ページネーション**: 大量 Gist の効率的な取得

### 5. 破壊的操作の安全設計 (CLI と MCP の非対称性)

破壊的操作 (例: `prune_old_gists` / `gist-cli prune`) は CLI と MCP で異なるゲートを設ける:

- **CLI (人間が叩く)**: 必須フラグを明示要求する (`--days` と `--visibility` 両方必須)。`--yes` 無しなら確認プロンプト、`--dry-run` で候補確認。
- **MCP (AI が呼ぶ)**: 安全側デフォルトに倒す。
  - `visibility=secret` デフォルト (パブリック誤爆を防ぐ)
  - `dry_run=true` デフォルト (うっかり呼び出しでは候補一覧のみ返す)
  - `confirm=false` デフォルト + `dry_run=false` 時の必須化 (二重ゲート)
  - 数値パラメータは AI 誤爆リスクが高い値を弾く (例: `days >= 1`)

「CLI = 人間が叩くので明示要求」「MCP = AI が叩くので安全側デフォルト + 二重ゲート」の原則。新規破壊的機能を追加するときはこのパターンを踏襲する。

## トラブルシューティング

### よくある問題とデバッグ方法

1. **GitHub トークンエラー**
   ```bash
   # 設定ファイルの確認
   cat ~/.config/gist-mcp-server/config.yaml
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
   - 設定ファイルはリポジトリ外 (`~/.config/gist-mcp-server/`) に置き、パーミッションは 600
   - 平文を置きたくない場合は `config_override_command` で秘密マネージャーから取得する
   - 最小権限（gist のみ）の原則

2. **入力値検証**
   - すべてのユーザー入力を Zod スキーマで検証
   - 悪意のあるコンテンツの検出

3. **プライバシー保護**
   - デフォルトで Secret Gist として作成
   - 機密情報をログに出力しない

### 既知の問題

- **`create_gist` の verbose ログ出力 (対応済み)**: `create_gist` ハンドラは Gist 中身を `/tmp/gist-mcp-server.log` に平文・JSON エスケープ・raw bytes の3形式で全文ログ出力していた。現在は `create_gist` の詳細ログ全体 (Gist 内容に加え description・Gist URL・ID 等のメタデータも含む) を `writeDebugLog` 経由にし、`DEBUG=1` / `DEBUG=true` の時のみ出力するようゲート化した (`main.ts` の `VERBOSE_LOG`)。Secret Gist の URL は推測困難＝アクセス資格そのものなので既定では書かない。`main()` の起動マーカー (version / ログパス) のみ非機密として常時出力する。デバッグで内容を見たい時のみ `DEBUG` を立てる。

## 設定の遅延ロード

設定の解決は `lib/config.ts` の `getGitHubToken()` / `loadConfig()` に一本化されており、
**初回ツール呼び出し時に一度だけ**解決して memoize する (起動時には解決しない)。
これは MCP プロセス起動のたびに 1Password CLI (`op read`) の認証ダイアログが
出るのを防ぐため。解決順:

1. 環境変数 `GITHUB_TOKEN` — リテラル (最優先。設定ファイルを読まない)
2. 設定ファイル `~/.config/gist-mcp-server/config.yaml` の `github_token`
   (`config_override_command` があれば、その出力 YAML を再帰マージした後の値)

`config_override_command` は queryfolio の同名キーと同じ設計:

- 標準出力の **YAML** をローカル設定へ再帰マージする (マッピングは再帰、
  スカラーと配列は丸ごと置換)
- 取得した YAML 側の `config_override_command` は辿らない (無限再帰を避けるため
  マージ後に削除する)
- **shell 非経由**で実行する (`Deno.Command` + 引用符を考慮した `splitCommand`)。
  パイプ・リダイレクト・変数展開は使えず、コマンドインジェクションの余地も無い
- 120s timeout。キーはあるが空文字・非文字列なら **エラー** (黙ってローカル設定へ
  フォールバックしない。意図しないアカウントのトークンを使わないため)

注意点:
- `config_override_command` を使う場合、Deno の `--allow-run` がそのバイナリ
  (既定は `op`) に必要。`launch.sh` と `gist-cli.ts` のシバンに `--allow-run=op` を付与済み。
  別の秘密マネージャー (pass / vault 等) を使う場合はここを変更する。
- `launch.sh` の `--allow-read` に `$HOME/.config/gist-mcp-server` を含めること。
  含めないと設定ファイルの読み取りが `NotCapable` になり、`GITHUB_TOKEN` 環境変数が
  無い限りトークンを解決できない (`findConfigFile` は NotCapable を「ファイル無し」
  として扱うので、権限漏れは "設定していない" と同じ症状で出る)。
- キャッシュはプロセス終了まで永続。トークンをローテーション・失効させた場合は再起動が必要。
- 並行する初回呼び出しは in-flight promise で 1 本に束ね、`op` の認証ダイアログが
  複数出ないようにしている。
- 環境変数 `GIST_MCP_SERVER_CONFIG_YAML` で設定ファイルの内容を丸ごと差し替えられる
  (開発・テスト用)。
- **旧仕様からの移行**: `.env` / `.loadenv.sh` の読み込みと
  `GIST_MCP_SERVER_ENV_GETTER_COMMAND` (stdout が `.env` テキスト) は廃止した。

## テスト戦略

### ユニットテスト
```bash
deno test --allow-env --allow-read --allow-write --allow-run lib/
```
`lib/config_test.ts` が設定の読み込み (YAML パース・再帰マージ・
`config_override_command` の実行・解決順・設定ファイルの探索) を検証する。
`--allow-write` はテンポラリの HOME に設定ファイルを置くために要る。

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