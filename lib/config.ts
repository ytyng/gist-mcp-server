// 設定の遅延ロード。
//
// 設定は `${HOME}/.config/gist-mcp-server/config.yaml` に置く。
// プロジェクトフォルダ内の .env / .loadenv.sh は使わない (起動元が複数あり、
// リポジトリの隣に秘密情報を置きたくないため)。
//
// 起動時には秘密マネージャー (1Password CLI 等) を呼ばず、初回アクセス時に
// 一度だけ解決する。MCP サーバーをプロセス起動するたびに `op read` の認証
// ダイアログが出るのを防ぐためのパターン。
//
// 解決順:
//   1. 環境変数 GITHUB_TOKEN — リテラル (最優先、設定ファイルを読まない)
//   2. 設定ファイルの github_token
//      (config_override_command があれば、その出力 YAML を再帰マージした後の値)

import { parse as parseYaml } from "@std/yaml";

// 初回 SSO / 生体認証は時間がかかるので長めに取る。
// 認証待ちで無限ハングするとツール呼び出しが固まるため、必ず timeout を付ける。
const OVERRIDE_COMMAND_TIMEOUT_MS = 120_000;

// 設定ファイルの内容を丸ごと差し替える環境変数 (開発・テスト用)。
const CONFIG_YAML_ENV_KEY = "GIST_MCP_SERVER_CONFIG_YAML";

// 設定ファイル名。先に見つかったものを使う。
const CONFIG_FILE_NAMES = ["config.yaml", "config.yml"];

const OVERRIDE_COMMAND_KEY = "config_override_command";

export type Config = {
  // GitHub Personal Access Token (gist スコープ)
  github_token?: string;
  // 標準出力に YAML を返すコマンド。結果を設定へ再帰マージする
  config_override_command?: string;
};

type Mapping = Record<string, unknown>;

// memoize 用。解決に成功した設定のみキャッシュする (失敗時は再試行させる)。
// キャッシュはプロセス終了まで永続する。トークンをローテーション・失効させた
// 場合、新しい値を使うにはプロセスの再起動が必要 (長期稼働の MCP サーバーで注意)。
let cachedConfig: Config | null = null;
// 並行する初回呼び出しを 1 本に束ねる (op の認証ダイアログが複数出るのを防ぐ)。
let inflight: Promise<Config> | null = null;

// 設定ディレクトリ (${HOME}/.config/gist-mcp-server)。
export function configDir(): string {
  const home = Deno.env.get("HOME");
  if (!home) {
    throw new Error("HOME environment variable is not set");
  }
  return `${home}/.config/gist-mcp-server`;
}

// 存在する設定ファイルのパスを返す。無ければ null。
export function findConfigFile(): string | null {
  for (const name of CONFIG_FILE_NAMES) {
    const path = `${configDir()}/${name}`;
    try {
      if (Deno.statSync(path).isFile) {
        warnIfPermissive(path);
        return path;
      }
    } catch (error) {
      // 未作成 (NotFound) と、Deno に読み取り権限を渡していない場合
      // (NotCapable) は「設定ファイル無し」として扱い、GITHUB_TOKEN 環境変数の
      // 解決へ進ませる。それ以外は設定の状態を判断できないので投げ直す。
      // NotCapable を握り潰すと権限漏れが「設定していない」と同じ症状になるため、
      // トークンを解決できなかった時の文言で区別できるようにしてある
      // (configReadDenied を参照)。
      if (
        !(error instanceof Deno.errors.NotFound) &&
        !(error instanceof Deno.errors.NotCapable)
      ) {
        throw error;
      }
    }
  }
  return null;
}

// 設定ディレクトリが Deno の --allow-read に含まれていないか。
// トークンを解決できなかった時に、原因を「未設定」と切り分けるために使う。
function configReadDenied(): boolean {
  try {
    Deno.statSync(configDir());
    return false;
  } catch (error) {
    return error instanceof Deno.errors.NotCapable;
  }
}

// 設定ファイルが所有者以外から読める場合に警告する。
// トークンを平文で持つファイルなので 600 を期待する。読むだけで chmod はしない
// (ユーザーのファイルを黙って書き換えたくないのと、--allow-write が要るため)。
function warnIfPermissive(path: string): void {
  const mode = Deno.statSync(path).mode;
  // Windows では mode が null になる。
  if (mode === null || (mode & 0o077) === 0) return;
  console.error(
    `Warning: ${path} is readable by others (mode ${
      (mode & 0o777).toString(8)
    }). It contains a token; run: chmod 600 ${path}`,
  );
}

// シェルを介さずに argv へ分割する最小限の splitter。
// `op read "op://development/foo/config.yaml"` → ["op", "read", "op://development/foo/config.yaml"]
// シェルメタ文字 (; | $() 等) を解釈しないため、コマンドインジェクションの余地が無い。
// 対応範囲は単純なケースのみ:
//   - パイプ・リダイレクト・変数展開は不可 (単一コマンド前提)
//   - クォート内のバックスラッシュエスケープ (\" 等) は未対応
// op のパスは通常これらを含まないため実用上問題ないが、必要なら 1 コマンドの
// ラッパースクリプトを指定すること。
export function splitCommand(command: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let hasToken = false;

  for (const ch of command) {
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else current += ch;
    } else if (inDouble) {
      if (ch === '"') inDouble = false;
      else current += ch;
    } else if (ch === "'") {
      inSingle = true;
      hasToken = true;
    } else if (ch === '"') {
      inDouble = true;
      hasToken = true;
    } else if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      if (hasToken) {
        args.push(current);
        current = "";
        hasToken = false;
      }
    } else {
      current += ch;
      hasToken = true;
    }
  }

  if (inSingle || inDouble) {
    throw new Error(`Unbalanced quotes in ${OVERRIDE_COMMAND_KEY}`);
  }
  if (hasToken) args.push(current);
  return args;
}

// config_override_command を shell を介さず実行し、stdout を返す。
async function runOverrideCommand(command: string): Promise<string> {
  const argv = splitCommand(command);
  if (argv.length === 0) {
    throw new Error(`${OVERRIDE_COMMAND_KEY} is empty`);
  }
  const [cmd, ...cmdArgs] = argv;

  let output: Deno.CommandOutput;
  try {
    output = await new Deno.Command(cmd, {
      args: cmdArgs,
      stdout: "piped",
      stderr: "piped",
      // 標準入力を閉じる。パスフレーズ等を尋ねるコマンドを渡された時に
      // 入力待ちで固まらないようにする。
      stdin: "null",
      signal: AbortSignal.timeout(OVERRIDE_COMMAND_TIMEOUT_MS),
    }).output();
  } catch (error) {
    // 起動失敗 (コマンド不在 / 権限不足 / timeout による中断)
    throw new Error(
      `Failed to run ${OVERRIDE_COMMAND_KEY} (${cmd}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!output.success) {
    // stderr に秘密が載りうるので切り詰める。
    const stderr = new TextDecoder().decode(output.stderr).trim().slice(0, 200);
    throw new Error(
      `${OVERRIDE_COMMAND_KEY} exited with non-zero status (code=${output.code})${
        stderr ? `: ${stderr}` : ""
      }`,
    );
  }

  return new TextDecoder().decode(output.stdout);
}

// YAML をマッピングとしてパースする。空文書は空マッピングとみなす。
function parseMapping(yaml: string, source: string): Mapping {
  const parsed = parseYaml(yaml);
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${source} must be a YAML mapping`);
  }
  return parsed as Mapping;
}

// 設定ファイル (または環境変数) の内容を読む。どちらも無ければ空マッピング。
function loadLocalConfig(): Mapping {
  // 空文字でも「設定した」とみなす。truthy 判定にすると、空を渡して
  // 設定を無効化したつもりの時に実ファイル (= 本物のトークン) へ落ちてしまう。
  const fromEnv = Deno.env.get(CONFIG_YAML_ENV_KEY);
  if (fromEnv !== undefined) {
    return parseMapping(fromEnv, `env ${CONFIG_YAML_ENV_KEY}`);
  }

  const path = findConfigFile();
  if (!path) return {};
  return parseMapping(Deno.readTextFileSync(path), path);
}

// プレーンなオブジェクトか (配列と null を除く)。
function isMapping(value: unknown): value is Mapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// over を base へ再帰的にマージする。
// マッピング同士は再帰的にマージし、スカラーと配列は丸ごと置き換える
// (配列は要素の同一性を判定できないため)。queryfolio の merge_mapping と同じ規則。
export function mergeMapping(base: Mapping, over: Mapping): Mapping {
  const merged: Mapping = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const current = merged[key];
    merged[key] = isMapping(current) && isMapping(value)
      ? mergeMapping(current, value)
      : value;
  }
  return merged;
}

async function resolveConfig(): Promise<Config> {
  const local = loadLocalConfig();
  const command = local[OVERRIDE_COMMAND_KEY];
  if (command === undefined) return local as Config;

  if (typeof command !== "string" || !command.trim()) {
    // 黙ってローカルの設定だけで動くと、意図しないアカウントのトークンを
    // 使ってしまうので、設定ミスはエラーにする。
    throw new Error(`${OVERRIDE_COMMAND_KEY} must be a non-empty string`);
  }

  const fetched = parseMapping(
    await runOverrideCommand(command),
    `${OVERRIDE_COMMAND_KEY} output`,
  );
  // 取得した YAML 側の config_override_command は辿らない (無限再帰を避ける)。
  delete fetched[OVERRIDE_COMMAND_KEY];

  return mergeMapping(local, fetched) as Config;
}

// 設定を遅延・memoize して取得する。
// 初回アクセス時のみ config_override_command を実行し、以降はキャッシュを返す。
// 失敗時はキャッシュせず、次回呼び出しで再試行する。
export function loadConfig(): Promise<Config> {
  if (cachedConfig !== null) return Promise.resolve(cachedConfig);
  if (inflight !== null) return inflight;

  inflight = resolveConfig().then(
    (config) => {
      cachedConfig = config;
      inflight = null;
      return config;
    },
    (error) => {
      inflight = null;
      throw error;
    },
  );
  return inflight;
}

// memoize したキャッシュを捨てる。テストから設定を差し替えるために使う。
export function resetConfigCache(): void {
  cachedConfig = null;
  inflight = null;
}

// GitHub Personal Access Token を取得する。
// 環境変数 GITHUB_TOKEN があれば設定ファイルを読まずにそれを使う。
export async function getGitHubToken(): Promise<string> {
  const literal = Deno.env.get("GITHUB_TOKEN");
  if (literal) return literal;

  // YAML は任意の型を返すので、型アサーションではなく実際の値を検証する
  // (github_token: 12345 のような値がそのまま Authorization ヘッダーへ乗らないように)。
  const token: unknown = (await loadConfig()).github_token;
  if (typeof token === "string" && token) return token;

  if (token !== undefined) {
    throw new Error("github_token must be a non-empty string");
  }
  throw new Error(
    `github_token is not set. Put it in ${configDir()}/config.yaml ` +
      `(or set the GITHUB_TOKEN environment variable).` +
      (configReadDenied()
        ? ` Note: the config directory is not readable by this process —` +
          ` add it to Deno's --allow-read.`
        : ""),
  );
}
