import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GistClient, formatGistInfo } from "./lib/gist.ts";

// ログファイルのパス
const LOG_FILE = "/tmp/gist-mcp-server.log";

// ログ出力関数
function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  try {
    Deno.writeTextFileSync(LOG_FILE, logMessage, { append: true });
  } catch (error) {
    console.error("Failed to write log:", error);
  }
}

// MCP サーバーの説明を読み込む
async function loadInstructions(): Promise<string> {
  try {
    const instructionsPath = new URL("./lib/mcp-server-instructions.md", import.meta.url);
    const text = await Deno.readTextFile(instructionsPath);
    return text;
  } catch (error) {
    console.error("Warning: Failed to load instructions file:", error);
    // フォールバック用の基本的な説明
    return "このサーバーは、GitHub Gist の作成・管理を行うためのツールを提供します。コードスニペットやファイルの共有に便利です。";
  }
}

function getGitHubToken(): string {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) {
    throw new Error("GITHUB_TOKEN 環境変数が設定されていません");
  }
  return token;
}

const server = new McpServer({
  name: "gist-mcp-server",
  version: "1.0.0",
  instructions: await loadInstructions()
});

// Gist を作成
server.tool(
  "create_gist",
  "GitHub Gist を作成します。単一ファイルまたは複数ファイルの Gist を作成でき、プライベート・パブリックを選択できます。",
  {
    description: z.string().optional().describe("Gist の説明"),
    files: z.record(z.object({
      content: z.string().describe("ファイルの内容")
    })).describe("ファイル名をキーとした、ファイル内容のオブジェクト"),
    public: z.boolean().optional().default(false).describe("パブリック Gist かどうか（デフォルト: false）")
  },
  async ({ description, files, public: isPublic }, _extra) => {
    try {
      writeLog(`=== CREATE_GIST START ===`);
      writeLog(`Description: ${description}`);
      writeLog(`Public: ${isPublic}`);
      writeLog(`Files count: ${Object.keys(files).length}`);
      
      // 各ファイルの詳細をログ出力
      for (const [filename, fileData] of Object.entries(files)) {
        writeLog(`File: ${filename}`);
        writeLog(`Content length: ${fileData.content.length}`);
        writeLog(`Content (first 100 chars): ${fileData.content.substring(0, 100)}`);
        writeLog(`Content (escaped): ${JSON.stringify(fileData.content)}`);
        writeLog(`Content (raw bytes): ${Array.from(fileData.content).map(c => c.charCodeAt(0)).join(',')}`);
        writeLog(`--- End of ${filename} ---`);
      }
      
      const client = new GistClient(getGitHubToken());
      
      writeLog(`Calling GitHub API...`);
      const gist = await client.createGist({
        description,
        files,
        public: isPublic
      });
      
      writeLog(`GitHub API response: ${gist.id}`);
      writeLog(`Gist URL: ${gist.html_url}`);

      const info = formatGistInfo(gist);
      writeLog(`=== CREATE_GIST SUCCESS ===`);
      
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Gist が正常に作成されました！\n\n${info}`
          }
        ]
      };
    } catch (error) {
      writeLog(`=== CREATE_GIST ERROR ===`);
      writeLog(`Error: ${error}`);
      console.error("Tool error in create_gist:", error);
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Gist の作成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  },
);

// Gist を取得
server.tool(
  "get_gist",
  "指定された ID の Gist を取得し、詳細情報を表示します。",
  {
    gist_id: z.string().min(1).describe("取得したい Gist の ID")
  },
  async ({ gist_id }, _extra) => {
    try {
      const client = new GistClient(getGitHubToken());
      const gist = await client.getGist(gist_id);

      const info = formatGistInfo(gist);
      return {
        content: [
          {
            type: "text" as const,
            text: `📄 Gist の詳細情報:\n\n${info}`
          }
        ]
      };
    } catch (error) {
      console.error("Tool error in get_gist:", error);
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Gist の取得中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  },
);

// Gist を更新
server.tool(
  "update_gist",
  "既存の Gist を更新します。説明の変更、ファイルの追加・削除・変更ができます。",
  {
    gist_id: z.string().min(1).describe("更新したい Gist の ID"),
    description: z.string().optional().describe("新しい説明"),
    files: z.record(z.union([
      z.object({
        content: z.string().optional().describe("ファイルの新しい内容"),
        filename: z.string().optional().describe("ファイルの新しい名前")
      }),
      z.null().describe("ファイルを削除する場合は null")
    ])).optional().describe("更新するファイル")
  },
  async ({ gist_id, description, files }, _extra) => {
    try {
      const client = new GistClient(getGitHubToken());
      const gist = await client.updateGist(gist_id, {
        description,
        files
      });

      const info = formatGistInfo(gist);
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Gist が正常に更新されました！\n\n${info}`
          }
        ]
      };
    } catch (error) {
      console.error("Tool error in update_gist:", error);
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Gist の更新中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  },
);

// Gist を削除
server.tool(
  "delete_gist",
  "指定された ID の Gist を削除します。この操作は元に戻せません。",
  {
    gist_id: z.string().min(1).describe("削除したい Gist の ID")
  },
  async ({ gist_id }, _extra) => {
    try {
      const client = new GistClient(getGitHubToken());
      await client.deleteGist(gist_id);

      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Gist（ID: ${gist_id}）が正常に削除されました。`
          }
        ]
      };
    } catch (error) {
      console.error("Tool error in delete_gist:", error);
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Gist の削除中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  },
);

// Gist 一覧を取得
server.tool(
  "list_gists",
  "ユーザーの Gist 一覧を取得します。自分の Gist または指定したユーザーの Gist を表示できます。",
  {
    username: z.string().optional().describe("取得したいユーザー名（省略時は認証されたユーザー）"),
    per_page: z.number().min(1).max(100).optional().default(30).describe("1ページあたりの件数（1-100、デフォルト: 30）"),
    page: z.number().min(1).optional().default(1).describe("取得するページ番号（デフォルト: 1）")
  },
  async ({ username, per_page, page }, _extra) => {
    try {
      const client = new GistClient(getGitHubToken());
      const gists = await client.listGists(username, {
        per_page,
        page
      });

      if (gists.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "📄 Gist が見つかりませんでした。"
            }
          ]
        };
      }

      const gistList = gists.map((gist, index) => {
        const files = Object.keys(gist.files).join(', ');
        const visibility = gist.public ? 'Public' : 'Private';
        return `${index + 1}. ${gist.description || 'No description'} (${visibility})
   ID: ${gist.id}
   Files: ${files}
   Updated: ${new Date(gist.updated_at).toLocaleString('ja-JP')}
   URL: ${gist.html_url}`;
      }).join('\n\n');

      const targetUser = username || '認証されたユーザー';
      return {
        content: [
          {
            type: "text" as const,
            text: `📄 ${targetUser} の Gist 一覧（${gists.length}件）:\n\n${gistList}`
          }
        ]
      };
    } catch (error) {
      console.error("Tool error in list_gists:", error);
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Gist 一覧の取得中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  },
);


// Gist にスターを付ける
server.tool(
  "star_gist",
  "指定された Gist にスターを付けます。",
  {
    gist_id: z.string().min(1).describe("スターを付けたい Gist の ID")
  },
  async ({ gist_id }, _extra) => {
    try {
      const client = new GistClient(getGitHubToken());
      await client.starGist(gist_id);

      return {
        content: [
          {
            type: "text" as const,
            text: `⭐ Gist（ID: ${gist_id}）にスターを付けました。`
          }
        ]
      };
    } catch (error) {
      console.error("Tool error in star_gist:", error);
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Gist のスター追加中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  },
);

// Gist のスターを外す
server.tool(
  "unstar_gist",
  "指定された Gist のスターを外します。",
  {
    gist_id: z.string().min(1).describe("スターを外したい Gist の ID")
  },
  async ({ gist_id }, _extra) => {
    try {
      const client = new GistClient(getGitHubToken());
      await client.unstarGist(gist_id);

      return {
        content: [
          {
            type: "text" as const,
            text: `⭐ Gist（ID: ${gist_id}）のスターを外しました。`
          }
        ]
      };
    } catch (error) {
      console.error("Tool error in unstar_gist:", error);
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Gist のスター削除中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  },
);

async function main(): Promise<void> {
  try {
    // ログファイルを初期化
    writeLog("=== GIST MCP SERVER STARTING ===");
    writeLog(`Version: 1.0.0`);
    writeLog(`Log file: ${LOG_FILE}`);
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Starting gist-mcp-server v1.0.0");
    writeLog("=== GIST MCP SERVER STARTED ===");
  } catch (error) {
    writeLog(`=== STARTUP ERROR ===`);
    writeLog(`Error: ${error}`);
    console.error("Failed to start gist-mcp-server:", error);
    Deno.exit(1);
  }
}

// グローバル例外ハンドラーの設定
addEventListener("error", (event) => {
  console.error("Uncaught error:", event.error);
});

addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  event.preventDefault();
});

main().catch((error) => {
  console.error("Fatal error in main:", error);
  Deno.exit(1);
});