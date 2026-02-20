#!/usr/bin/env -S deno run --allow-read --allow-net --allow-env

import { GistClient, formatGistInfo } from "./lib/gist.ts";

function getGitHubToken(): string {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) {
    console.error("Error: GITHUB_TOKEN environment variable is not set.");
    Deno.exit(1);
  }
  return token;
}

function showHelp() {
  console.log(`gist-cli - GitHub Gist management CLI tool

USAGE:
  gist-cli <subcommand> [options]

SUBCOMMANDS:
  create        Create a new GitHub Gist
  get           Get details of a specific Gist by ID
  update        Update an existing Gist
  delete        Delete a Gist (irreversible)
  list          List Gists for the authenticated user or a specified user
  star          Star a Gist
  unstar        Unstar a Gist

EXAMPLES:
  gist-cli create --file=hello.py --content="print('hello')"
  gist-cli create --file=script.sh --stdin --description="My script" --public
  gist-cli get <gist_id>
  gist-cli list --per-page=10 --page=1
  gist-cli list --username=octocat
  gist-cli update <gist_id> --description="Updated description"
  gist-cli update <gist_id> --file=hello.py --content="print('updated')"
  gist-cli delete <gist_id>
  gist-cli star <gist_id>
  gist-cli unstar <gist_id>

Run 'gist-cli <subcommand> --help' for detailed usage of each subcommand.

ENVIRONMENT:
  GITHUB_TOKEN  Required. GitHub Personal Access Token with 'gist' scope.`);
}

function showCreateHelp() {
  console.log(`gist-cli create - Create a new GitHub Gist

USAGE:
  gist-cli create --file=<filename> --content=<content> [options]
  gist-cli create --file=<filename> --stdin [options]
  echo "content" | gist-cli create --file=<filename> --stdin [options]

OPTIONS:
  --file=<filename>       Filename for the Gist (required, can be specified multiple times)
  --content=<content>     Content for the file (matched by position with --file; 1st with 1st, 2nd with 2nd, etc.)
  --stdin                 Read content from stdin (requires exactly one --file option)
  --description=<desc>    Description for the Gist
  --public                Make the Gist public (default: private)

MULTIPLE FILES:
  gist-cli create --file=a.py --content="print('a')" --file=b.py --content="print('b')"

STDIN:
  cat myfile.py | gist-cli create --file=myfile.py --stdin`);
}

function showGetHelp() {
  console.log(`gist-cli get - Get details of a Gist

USAGE:
  gist-cli get <gist_id>

ARGUMENTS:
  gist_id    The ID of the Gist to retrieve

OUTPUT:
  Displays Gist metadata and file contents in a readable format.`);
}

function showUpdateHelp() {
  console.log(`gist-cli update - Update an existing Gist

USAGE:
  gist-cli update <gist_id> [options]

ARGUMENTS:
  gist_id                   The ID of the Gist to update

OPTIONS:
  --description=<desc>      New description for the Gist
  --file=<filename>         File to update or add (can be specified multiple times)
  --content=<content>       New content for the file (paired with preceding --file)
  --rename=<old>:<new>      Rename a file
  --delete-file=<filename>  Delete a file from the Gist`);
}

function showListHelp() {
  console.log(`gist-cli list - List Gists

USAGE:
  gist-cli list [options]

OPTIONS:
  --username=<user>   List Gists of a specific user (default: authenticated user)
  --per-page=<n>      Number of Gists per page, 1-100 (default: 30)
  --page=<n>          Page number (default: 1)

OUTPUT:
  Displays a summary list of Gists with ID, description, files, and URL.`);
}

function showDeleteHelp() {
  console.log(`gist-cli delete - Delete a Gist

USAGE:
  gist-cli delete <gist_id>

ARGUMENTS:
  gist_id    The ID of the Gist to delete

WARNING:
  This operation is irreversible.`);
}

function showStarHelp() {
  console.log(`gist-cli star - Star a Gist

USAGE:
  gist-cli star <gist_id>

ARGUMENTS:
  gist_id    The ID of the Gist to star`);
}

function showUnstarHelp() {
  console.log(`gist-cli unstar - Unstar a Gist

USAGE:
  gist-cli unstar <gist_id>

ARGUMENTS:
  gist_id    The ID of the Gist to unstar`);
}

function parseArgs(args: string[]): { positional: string[]; flags: Map<string, string[]> } {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const val = arg.slice(eqIdx + 1);
        if (!flags.has(key)) flags.set(key, []);
        flags.get(key)!.push(val);
      } else {
        const key = arg.slice(2);
        if (!flags.has(key)) flags.set(key, []);
        flags.get(key)!.push("true");
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

function getFlag(flags: Map<string, string[]>, key: string): string | undefined {
  return flags.get(key)?.[0];
}

function hasFlag(flags: Map<string, string[]>, key: string): boolean {
  return flags.has(key);
}

async function readStdin(): Promise<string> {
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  for await (const chunk of Deno.stdin.readable) {
    chunks.push(decoder.decode(chunk, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}

async function cmdCreate(args: string[]) {
  const { flags } = parseArgs(args);

  if (hasFlag(flags, "help")) {
    showCreateHelp();
    return;
  }

  const fileNames = flags.get("file");
  if (!fileNames || fileNames.length === 0) {
    console.error("Error: --file is required. Use --help for usage.");
    Deno.exit(1);
  }

  const contents = flags.get("content") || [];
  const useStdin = hasFlag(flags, "stdin");
  const description = getFlag(flags, "description");
  const isPublic = hasFlag(flags, "public");

  const files: Record<string, { content: string }> = {};

  if (useStdin) {
    if (fileNames.length > 1) {
      console.error("Error: --stdin can only be used with a single --file.");
      Deno.exit(1);
    }
    const stdinContent = await readStdin();
    files[fileNames[0]] = { content: stdinContent };
  } else {
    // --content paired with --file by index
    if (contents.length !== fileNames.length) {
      console.error(
        `Error: Number of --file (${fileNames.length}) and --content (${contents.length}) must match.`
      );
      Deno.exit(1);
    }
    for (let i = 0; i < fileNames.length; i++) {
      files[fileNames[i]] = { content: contents[i] };
    }
  }

  const client = new GistClient(getGitHubToken());
  const gist = await client.createGist({ description, files, public: isPublic });
  console.log(formatGistInfo(gist));
}

async function cmdGet(args: string[]) {
  const { positional, flags } = parseArgs(args);

  if (hasFlag(flags, "help")) {
    showGetHelp();
    return;
  }

  const gistId = positional[0];
  if (!gistId) {
    console.error("Error: Gist ID is required. Usage: gist-cli get <gist_id>");
    Deno.exit(1);
  }

  const client = new GistClient(getGitHubToken());
  const gist = await client.getGist(gistId);
  console.log(formatGistInfo(gist));

  // Print file contents
  for (const [filename, file] of Object.entries(gist.files)) {
    console.log(`\n--- ${filename} (${file.language || "unknown"}, ${file.size} bytes) ---`);
    if (file.content) {
      console.log(file.content);
    } else {
      console.log(`(content not included, raw_url: ${file.raw_url})`);
    }
  }
}

async function cmdUpdate(args: string[]) {
  const { positional, flags } = parseArgs(args);

  if (hasFlag(flags, "help")) {
    showUpdateHelp();
    return;
  }

  const gistId = positional[0];
  if (!gistId) {
    console.error("Error: Gist ID is required. Usage: gist-cli update <gist_id> [options]");
    Deno.exit(1);
  }

  const description = getFlag(flags, "description");
  const fileNames = flags.get("file");
  const contents = flags.get("content");
  const renames = flags.get("rename");
  const deleteFiles = flags.get("delete-file");

  const files: Record<string, { content?: string; filename?: string } | null> = {};

  // File content updates
  if (fileNames && !contents) {
    console.error("Error: --file requires --content. Use --help for usage.");
    Deno.exit(1);
  }
  if (fileNames && contents) {
    if (fileNames.length !== contents.length) {
      console.error("Error: Number of --file and --content must match.");
      Deno.exit(1);
    }
    for (let i = 0; i < fileNames.length; i++) {
      files[fileNames[i]] = { content: contents[i] };
    }
  }

  // Renames: --rename=old:new
  if (renames) {
    for (const r of renames) {
      const [oldName, newName] = r.split(":", 2);
      if (!oldName || !newName) {
        console.error(`Error: Invalid rename format '${r}'. Use --rename=old:new`);
        Deno.exit(1);
      }
      files[oldName] = { filename: newName };
    }
  }

  // Deletes
  if (deleteFiles) {
    for (const f of deleteFiles) {
      files[f] = null;
    }
  }

  if (!description && Object.keys(files).length === 0) {
    console.error("Error: Nothing to update. Specify --description, --file/--content, --rename, or --delete-file.");
    Deno.exit(1);
  }

  const client = new GistClient(getGitHubToken());
  const gist = await client.updateGist(gistId, {
    description,
    files: Object.keys(files).length > 0 ? files : undefined,
  });
  console.log(formatGistInfo(gist));
}

async function cmdDelete(args: string[]) {
  const { positional, flags } = parseArgs(args);

  if (hasFlag(flags, "help")) {
    showDeleteHelp();
    return;
  }

  const gistId = positional[0];
  if (!gistId) {
    console.error("Error: Gist ID is required. Usage: gist-cli delete <gist_id>");
    Deno.exit(1);
  }

  const client = new GistClient(getGitHubToken());
  await client.deleteGist(gistId);
  console.log(`Gist ${gistId} has been deleted.`);
}

async function cmdList(args: string[]) {
  const { flags } = parseArgs(args);

  if (hasFlag(flags, "help")) {
    showListHelp();
    return;
  }

  const username = getFlag(flags, "username");
  const perPage = getFlag(flags, "per-page");
  const page = getFlag(flags, "page");

  const perPageNum = perPage ? parseInt(perPage, 10) : 30;
  const pageNum = page ? parseInt(page, 10) : 1;
  if (isNaN(perPageNum) || perPageNum < 1 || perPageNum > 100) {
    console.error("Error: --per-page must be an integer between 1 and 100.");
    Deno.exit(1);
  }
  if (isNaN(pageNum) || pageNum < 1) {
    console.error("Error: --page must be a positive integer.");
    Deno.exit(1);
  }

  const client = new GistClient(getGitHubToken());
  const gists = await client.listGists(username, {
    per_page: perPageNum,
    page: pageNum,
  });

  if (gists.length === 0) {
    console.log("No Gists found.");
    return;
  }

  for (const [i, gist] of gists.entries()) {
    const files = Object.keys(gist.files).join(", ");
    const visibility = gist.public ? "Public" : "Private";
    console.log(
      `${i + 1}. ${gist.description || "No description"} (${visibility})\n` +
      `   ID: ${gist.id}\n` +
      `   Files: ${files}\n` +
      `   Updated: ${new Date(gist.updated_at).toLocaleString("ja-JP")}\n` +
      `   URL: ${gist.html_url}`
    );
    if (i < gists.length - 1) console.log();
  }
}

async function cmdStar(args: string[]) {
  const { positional, flags } = parseArgs(args);

  if (hasFlag(flags, "help")) {
    showStarHelp();
    return;
  }

  const gistId = positional[0];
  if (!gistId) {
    console.error("Error: Gist ID is required. Usage: gist-cli star <gist_id>");
    Deno.exit(1);
  }

  const client = new GistClient(getGitHubToken());
  await client.starGist(gistId);
  console.log(`Gist ${gistId} has been starred.`);
}

async function cmdUnstar(args: string[]) {
  const { positional, flags } = parseArgs(args);

  if (hasFlag(flags, "help")) {
    showUnstarHelp();
    return;
  }

  const gistId = positional[0];
  if (!gistId) {
    console.error("Error: Gist ID is required. Usage: gist-cli unstar <gist_id>");
    Deno.exit(1);
  }

  const client = new GistClient(getGitHubToken());
  await client.unstarGist(gistId);
  console.log(`Gist ${gistId} has been unstarred.`);
}

// Main dispatch
const [subcommand, ...rest] = Deno.args;

if (!subcommand || subcommand === "--help" || subcommand === "-h") {
  showHelp();
  Deno.exit(0);
}

const commands: Record<string, (args: string[]) => Promise<void>> = {
  create: cmdCreate,
  get: cmdGet,
  update: cmdUpdate,
  delete: cmdDelete,
  list: cmdList,
  star: cmdStar,
  unstar: cmdUnstar,
};

const handler = commands[subcommand];
if (!handler) {
  console.error(`Unknown subcommand: ${subcommand}\nRun 'gist-cli --help' for usage.`);
  Deno.exit(1);
}

try {
  await handler(rest);
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  Deno.exit(1);
}
