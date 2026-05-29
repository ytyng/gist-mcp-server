// 設定 (GITHUB_TOKEN) の遅延ロード。
//
// 起動時には秘密マネージャー (1Password CLI 等) を呼ばず、初回アクセス時に
// 一度だけ解決する。MCP サーバーをプロセス起動するたびに `op read` の認証
// ダイアログが出るのを防ぐためのパターン。
//
// 解決順:
//   1. 環境変数 GITHUB_TOKEN — リテラル (最優先、subprocess を起動しない)
//   2. 環境変数 GIST_MCP_SERVER_ENV_GETTER_COMMAND — stdout を .env テキスト
//      として実行・パースし、GITHUB_TOKEN を取り出す (遅延実行)

// 初回 SSO / 生体認証は時間がかかるので長めに取る。
// 認証待ちで無限ハングするとツール呼び出しが固まるため、必ず timeout を付ける。
const GETTER_TIMEOUT_MS = 120_000;

const GETTER_ENV_KEY = "GIST_MCP_SERVER_ENV_GETTER_COMMAND";

// memoize 用。解決に成功した token のみキャッシュする (失敗時は再試行させる)。
// キャッシュはプロセス終了まで永続する。トークンをローテーション・失効させた
// 場合、新しい値を使うにはプロセスの再起動が必要 (長期稼働の MCP サーバーで注意)。
let cachedToken: string | null = null;
// 並行する初回呼び出しを 1 本に束ねる (op の認証ダイアログが複数出るのを防ぐ)。
let inflight: Promise<string> | null = null;

// シェルを介さずに argv へ分割する最小限の splitter。
// `op read "op://development/foo/.env"` → ["op", "read", "op://development/foo/.env"]
// シェルメタ文字 (; | $() 等) を解釈しないため、コマンドインジェクションの余地が無い。
// 対応範囲は単純なケースのみ:
//   - パイプ・リダイレクト・変数展開は不可 (単一コマンド前提)
//   - クォート内のバックスラッシュエスケープ (\" 等) は未対応
// op のパスは通常これらを含まないため実用上問題ないが、必要なら 1 コマンドの
// ラッパースクリプトを getter に指定すること。
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
    throw new Error("Unbalanced quotes in getter command");
  }
  if (hasToken) args.push(current);
  return args;
}

// getter command を shell を介さず実行し、stdout を返す。
async function runGetterCommand(command: string): Promise<string> {
  const argv = splitCommand(command);
  if (argv.length === 0) {
    throw new Error(`${GETTER_ENV_KEY} is empty`);
  }
  const [cmd, ...cmdArgs] = argv;

  let output: Deno.CommandOutput;
  try {
    output = await new Deno.Command(cmd, {
      args: cmdArgs,
      stdout: "piped",
      stderr: "piped",
      signal: AbortSignal.timeout(GETTER_TIMEOUT_MS),
    }).output();
  } catch (error) {
    // 起動失敗 (コマンド不在 / 権限不足 / timeout による中断)
    throw new Error(
      `Failed to run getter command (${cmd}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!output.success) {
    // stderr に秘密が載りうるので切り詰める。
    const stderr = new TextDecoder().decode(output.stderr).trim().slice(0, 200);
    throw new Error(
      `Getter command exited with non-zero status (code=${output.code})${
        stderr ? `: ${stderr}` : ""
      }`,
    );
  }

  return new TextDecoder().decode(output.stdout);
}

// .env 形式のテキストを { KEY: value } にパースする。
// `export KEY=value`、`# コメント`、前後の空白、value のクォートに対応。
// value は単一行のみ対応 (バックスラッシュ継続行や heredoc は非対応)。
// op read が返す .env テキストは 1 行 1 値なので実用上問題ない。
function parseDotenv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const body = line.startsWith("export ") ? line.slice(7).trimStart() : line;
    const eq = body.indexOf("=");
    if (eq === -1) continue;

    const key = body.slice(0, eq).trim();
    if (!key) continue;
    let value = body.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function resolveToken(): Promise<string> {
  // 1. 環境変数リテラル (最優先)
  const literal = Deno.env.get("GITHUB_TOKEN");
  if (literal) return literal;

  // 2. getter command (遅延実行)。stdout を .env テキストとしてパースする。
  const getter = Deno.env.get(GETTER_ENV_KEY);
  if (getter) {
    const output = await runGetterCommand(getter);
    const token = parseDotenv(output)["GITHUB_TOKEN"];
    if (token) return token;
    throw new Error(`Getter command output does not contain GITHUB_TOKEN`);
  }

  throw new Error(
    `GITHUB_TOKEN is not set (set the GITHUB_TOKEN env var, or ${GETTER_ENV_KEY} to resolve it lazily)`,
  );
}

// GITHUB_TOKEN を遅延・memoize して取得する。
// 初回アクセス時のみ getter command を実行し、以降はキャッシュを返す。
// 失敗時はキャッシュせず、次回呼び出しで再試行する。
export function getGitHubToken(): Promise<string> {
  if (cachedToken !== null) return Promise.resolve(cachedToken);
  if (inflight !== null) return inflight;

  inflight = resolveToken().then(
    (token) => {
      cachedToken = token;
      inflight = null;
      return token;
    },
    (error) => {
      inflight = null;
      throw error;
    },
  );
  return inflight;
}
