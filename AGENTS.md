# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

gist-mcp-server is an MCP (Model Context Protocol) server for creating and managing GitHub Gists. It lets AI assistants work with the GitHub Gist API over the MCP protocol and provides comprehensive Gist management features, such as sharing code snippets and files and creating private and public Gists.

### Main features
- Create, update, and delete GitHub Gists
- Choose between private and public Gists
- Create Gists with multiple files
- Star Gists (star / unstar)
- List a user's Gists
- Type-safe API design and robust error handling

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Deno (v2.1 or later)
  - This used to say "v1.40 or later", but that did not match reality (the
    `deno.lock` on `main` was already lockfile v4 = Deno 2.x required). The current minimum is
    determined by the `jsr:` specifier (1.42+), `Deno.errors.NotCapable` (2.0+), and lockfile v5 (2.1+)
- **MCP framework**: `@modelcontextprotocol/sdk`
- **Schema validation**: Zod
- **Testing**: Deno's standard test runner

## Development Commands

### Basic execution
```bash
# Start the MCP server
./launch.sh

# Or run it directly
deno run --allow-read --allow-net --allow-env main.ts
```

### Manual checks
```bash
cd test-request

# Check the tool list
./test-tools-list.sh

# Gist creation test
./test-create-gist.sh

# Gist list test
./test-list-gists.sh

# Gist detail test
./test-get-gist.sh <gist_id>

# Gist update test
./test-update-gist.sh <gist_id>

# Gist deletion test
./test-delete-gist.sh <gist_id>

# Star tests
./test-star-gist.sh <gist_id>
./test-unstar-gist.sh <gist_id>
```

## Architecture

### Directory structure
```
gist-mcp-server/
├── main.ts                     # MCP server entry point, tool definitions
├── lib/
│   ├── gist.ts                 # GitHub Gist API communication logic, type definitions
│   ├── config.ts               # Lazy loading of the config file, config_override_command
│   ├── config_test.ts          # Unit tests for config.ts
│   └── mcp-server-instructions.md # Description of the MCP server
├── test-request/               # Scripts for manual checks
├── deno.json                   # Deno configuration, dependencies
├── config.example.yaml         # Config file template
├── launch.sh                   # Launch script
└── README.md                   # User documentation
```

### Role of the main files

#### `main.ts`
- Entry point of the MCP server
- Defines and registers the 8 MCP tools
- Input validation with Zod
- Sets up the global exception handler

#### `lib/gist.ts`
- Handles communication with the GitHub Gist API
- Type definitions (Gist, GistFile, CreateGistInput, response types)
- Common error handling for API communication
- Formatting of Gist information

#### `lib/mcp-server-instructions.md`
- Description of the MCP server (Markdown)
- Loaded dynamically by main.ts
- Describes an overview of the GitHub Gist service and how to use it

## MCP Tools

### Gist management
1. **`create_gist`**: Create a GitHub Gist
2. **`get_gist`**: Get Gist details
3. **`update_gist`**: Update a Gist
4. **`delete_gist`**: Delete a Gist
5. **`list_gists`**: List Gists

### Extended features
6. **`star_gist`**: Star a Gist
7. **`unstar_gist`**: Unstar a Gist
8. **`prune_old_gists`**: Bulk-delete Gists created more than a given number of days ago (double-gate design)

## Configuration

### Config file

The configuration lives **outside the repository**, at `${HOME}/.config/gist-mcp-server/config.yaml`
(`config.yml` also works; if both exist, `config.yaml` takes precedence).

```yaml
github_token: your_github_personal_access_token_here
```

`.env` / `.loadenv.sh` in the project folder are **not used**. There are multiple launchers
(launch.sh and the gist-cli wrapper), and each of them sourced the same .env,
so the configuration was consolidated into a single location.

### Getting a GitHub Personal Access Token
1. GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Click "Generate new token (classic)"
3. Select the required scopes:
   - `gist` - Create, read/write, and delete Gists
4. Generate the token and set it as `github_token` in the config file

### Preparing the development environment
1. Install Deno
2. Copy `config.example.yaml` to `~/.config/gist-mcp-server/config.yaml` and
   set the token (`chmod 600`)
3. Check that it works with `./launch.sh`

## GitHub Gist API Specification and Endpoints

### Base URL
`https://api.github.com`

### Main endpoints

| Endpoint | Method | Function | Parameters |
|----------------|----------|------|------------|
| `/gists` | GET | List Gists | per_page, page, since |
| `/gists` | POST | Create a Gist | description, files, public |
| `/gists/{id}` | GET | Get Gist details | - |
| `/gists/{id}` | PATCH | Update a Gist | description, files |
| `/gists/{id}` | DELETE | Delete a Gist | - |
| `/gists/{id}/star` | PUT | Star | - |
| `/gists/{id}/star` | DELETE | Unstar | - |
| `/users/{username}/gists` | GET | List a user's Gists | per_page, page |

### Authentication
- **Method**: Bearer Token
- **Header**: `Authorization: Bearer <token>`

### API constraints (important)

- **No visibility filter**: `/gists` has no query parameter to filter by Secret/Public. The only option is to drop them on the client side by looking at `gist.public`. `/gists/public` is "the newest public Gists of all users" and `/gists/starred` is "Gists you have starred", so neither can be used to filter the authenticated user's own Gists by visibility.
- **`/users/<username>/gists` returns public Gists only**: Other people's Secret Gists cannot be retrieved through the API. Combining `--username` with `--visibility=secret` in the CLI/MCP always returns 0 results (stated explicitly in the help and in a runtime warning).
- **per_page limit**: 1-100. `listAllGists` clamps to this range and also breaks on `batch.length === 0` to prevent an infinite loop.

## Key Implementation Points

### 1. Error handling strategy
- **Unified error responses**: the `GistAPIError` class
- **Error messages per HTTP status**: appropriate error classification
- **Network error detection**: appropriate classification of fetch errors
- **Input validation**: upfront validation with Zod schemas

### 2. Ensuring type safety
- **Strict type definitions**: `Gist`, `GistFile`, `CreateGistInput`, `UpdateGistInput`
- **Null safety**: proper handling of optional properties
- **Unified response types**: type definitions for GitHub API responses

### 3. Security and privacy
- **Secret by default**: Gists are created as Secret Gists unless specified otherwise
- **Least privilege**: only the gist scope is requested
- **Token management**: obtained safely from environment variables
- **Consistent visibility wording**: user-facing output consistently uses `Secret` / `Public` (do not use `Private`). This is because GitHub officially calls them "Secret gists" and the CLI/MCP flag name is also `--visibility=secret`.

### 4. Usability
- **Japanese messages**: error and success messages are in Japanese
- **Detailed display**: Gist information is formatted in an easy-to-read way
- **Pagination**: efficient retrieval of large numbers of Gists

### 5. Safety design for destructive operations (asymmetry between CLI and MCP)

Destructive operations (e.g. `prune_old_gists` / `gist-cli prune`) have different gates in the CLI and MCP:

- **CLI (run by humans)**: require the mandatory flags explicitly (both `--days` and `--visibility` are required). Without `--yes`, show a confirmation prompt; use `--dry-run` to review the candidates.
- **MCP (called by AI)**: default to the safe side.
  - `visibility=secret` by default (prevents accidentally hitting public Gists)
  - `dry_run=true` by default (a careless call only returns the candidate list)
  - `confirm=false` by default + required when `dry_run=false` (double gate)
  - Numeric parameters reject values with a high risk of AI misfires (e.g. `days >= 1`)

The principle is "CLI = run by humans, so require things explicitly" and "MCP = run by AI, so safe-side defaults + a double gate". Follow this pattern when adding new destructive features.

## Troubleshooting

### Common problems and how to debug them

1. **GitHub token errors**
   ```bash
   # Check the config file
   cat ~/.config/gist-mcp-server/config.yaml
   ```

2. **Network connectivity problems**
   ```bash
   # GitHub API connectivity test
   curl -H "Authorization: Bearer $GITHUB_TOKEN" \
        https://api.github.com/gists
   ```

3. **Running in debug mode**
   ```bash
   # Run with verbose logging
   DENO_LOG=debug deno run --allow-read --allow-net --allow-env main.ts
   ```

4. **Checking type errors**
   ```bash
   # Run only the type check
   deno check main.ts
   ```

### Performance optimization

1. **Optimizing API calls**
   - Appropriate pagination settings
   - Fetch only the minimum necessary data

2. **Optimizing memory usage**
   - Limit when fetching large numbers of Gists (maximum 100 per page)
   - Appropriate size limit for Base64 images

## Security Considerations

1. **Managing the GitHub token**
   - Put the config file outside the repository (`~/.config/gist-mcp-server/`) with permission 600
   - If you do not want to store it in plain text, fetch it from a secrets manager with `config_override_command`
   - Principle of least privilege (gist only)

2. **Input validation**
   - Validate all user input with Zod schemas
   - Detect malicious content

3. **Privacy protection**
   - Create Secret Gists by default
   - Do not write confidential information to logs

### Known issues

- **Verbose logging in `create_gist` (resolved)**: The `create_gist` handler used to write the full contents of the Gist to `/tmp/gist-mcp-server.log` in three forms: plain text, JSON-escaped, and raw bytes. Now the entire detailed log of `create_gist` (not only the Gist contents but also metadata such as the description, Gist URL, and ID) goes through `writeDebugLog`, and is gated to be written only when `DEBUG=1` / `DEBUG=true` (`VERBOSE_LOG` in `main.ts`). The URL of a Secret Gist is hard to guess, which makes it the access credential itself, so it is not written by default. Only the startup marker in `main()` (version / log path) is always written, as non-sensitive. Set `DEBUG` only when you need to see the contents for debugging.

## Lazy Loading of the Configuration

Configuration resolution is consolidated in `getGitHubToken()` / `loadConfig()` in `lib/config.ts`,
and it is resolved **only once, on the first tool call**, and memoized (it is not resolved at startup).
This prevents the 1Password CLI (`op read`) authentication dialog from appearing
every time the MCP process starts. Resolution order:

1. Environment variable `GITHUB_TOKEN` — literal (highest priority; the config file is not read)
2. `github_token` in the config file `~/.config/gist-mcp-server/config.yaml`
   (if `config_override_command` is present, the value after recursively merging its output YAML)

`config_override_command` follows the same design as the key of the same name in queryfolio:

- The **YAML** on standard output is recursively merged into the local config (mappings are merged recursively,
  scalars and arrays are replaced wholesale)
- `config_override_command` in the fetched YAML is not followed (it is removed after the merge
  to avoid infinite recursion)
- It runs **without a shell** (`Deno.Command` + `splitCommand`, which respects quotes).
  Pipes, redirects, and variable expansion cannot be used, and there is no room for command injection
- 120s timeout. If the key exists but is an empty string or not a string, it is an **error** (it does not silently fall back
  to the local config, so that a token for an unintended account is not used)

Caveats:
- When using `config_override_command`, Deno's `--allow-run` is required for that binary
  (`op` by default). `--allow-run=op` has already been added to `launch.sh` and the shebang of `gist-cli.ts`.
  If you use a different secrets manager (pass / vault, etc.), change it there.
- Include `$HOME/.config/gist-mcp-server` in `--allow-read` in `launch.sh`.
  Otherwise reading the config file fails with `NotCapable`, and the token cannot be resolved unless
  the `GITHUB_TOKEN` environment variable is set (`findConfigFile` treats NotCapable as "no file",
  so a missing permission shows up with the same symptom as "not configured").
- The cache lasts until the process exits. If you rotate or revoke the token, a restart is required.
- Concurrent first calls are bundled into one via an in-flight promise, so that multiple `op` authentication dialogs
  do not appear.
- The environment variable `GIST_MCP_SERVER_CONFIG_YAML` replaces the entire contents of the config file
  (for development and testing).
- **Migration from the old specification**: loading of `.env` / `.loadenv.sh` and
  `GIST_MCP_SERVER_ENV_GETTER_COMMAND` (whose stdout was `.env` text) have been removed.

## Testing Strategy

### Unit tests
```bash
deno test --allow-env --allow-read --allow-write --allow-run lib/
```
`lib/config_test.ts` verifies configuration loading (YAML parsing, recursive merging,
running `config_override_command`, resolution order, and config file discovery).
`--allow-write` is needed to place the config file in a temporary HOME.

### Manual check tests
- API tests with the `test-request/` scripts
- Communication tests against the real GitHub API

### Future test extensions
- Consider adding mocking
- Add edge case tests
- Implement performance tests

## Notes for Maintenance and Extension

### When changing code
1. When updating type definitions, also check the type annotations of all related functions
2. When the GitHub API specification changes, also update the endpoint list and documentation
3. When adding a new error case, also update the error handling functions

### When adding new features
1. Always implement input validation with Zod schemas
2. Use the unified format for error responses
3. Create a test script at the same time
4. Update both README.md and CLAUDE.md

With this information, Claude Code can work efficiently on development in this project.