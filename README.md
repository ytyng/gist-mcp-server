# gist-mcp-server

An MCP (Model Context Protocol) server for creating and managing GitHub Gists.

![](./documents/images/featured-image.png)

## Overview

This MCP server provides integration with the GitHub Gist API, enabling AI assistants to manage GitHub Gists. It supports sharing code snippets and files, and creating both private and public Gists.

### Key Features

- **Gist CRUD**: Create, read, update, and delete single or multi-file Gists
- **Privacy Control**: Choose between private and public Gists
- **Star Management**: Star and unstar Gists
- **Listing**: View your own or other users' Gists
- **Type Safety**: Strict type checking with TypeScript + Zod
- **Error Handling**: Robust error handling with user-friendly messages

## Setup

### Prerequisites

- **Deno**: v2.1 or later

  > The stated minimum used to be v1.40, but that was already stale: `deno.lock`
  > on `main` was lockfile v4, which needs Deno 2.x. This version adds a `jsr:`
  > specifier (`@std/yaml`, needs 1.42+), `Deno.errors.NotCapable` (2.0+), and
  > writes a v5 lockfile (2.1+), so the real floor is now v2.1.
- **GitHub Personal Access Token**: A token with Gist permissions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd gist-mcp-server
```

### 2. Create the Config File

The config lives outside the repository, at `~/.config/gist-mcp-server/config.yaml`:

```bash
mkdir -p ~/.config/gist-mcp-server
cp config.example.yaml ~/.config/gist-mcp-server/config.yaml
chmod 600 ~/.config/gist-mcp-server/config.yaml
```

Edit it and set your token:

```yaml
# GitHub Personal Access Token
# Required permission: gist (create, read, write, delete Gists)
github_token: your_github_token_here
```

`config.yml` (the `.yml` spelling) is also accepted; `config.yaml` wins when both
exist. The file holds a token in plaintext, so keep it at `600`.

#### Overriding the config from a secret manager

Instead of writing the token into the file, you can have it fetched on first use
from a secret manager (e.g. 1Password CLI). Set `config_override_command` to a
single command whose **stdout is YAML**, and that YAML is merged over the file:

```yaml
config_override_command: op read "op://vault/gist-mcp-server/config-yaml"
```

Merge rules (the same as queryfolio):

- Mappings are merged recursively; scalars and lists are replaced wholesale.
- A `config_override_command` inside the fetched YAML is **not** followed; the key
  is dropped after merging.
- The command runs **without a shell** (arguments are split honouring quotes, so
  pipes, redirects and variable expansion do not work). It has a 120-second timeout.
- It runs lazily on the first tool call (not at startup), so launching the server
  does not trigger a secret-manager auth prompt, and the result is cached for the
  life of the process.
- Deno needs `--allow-run` for the command's binary (`launch.sh` already passes
  `--allow-run=op`).

If the key is present but is not a non-empty string, that is an error — the server
will not silently fall back to the local-only config.

#### Environment variables

| Variable | Effect |
|---|---|
| `GITHUB_TOKEN` | Used as the token directly. Takes precedence and skips reading the config file entirely. |
| `GIST_MCP_SERVER_CONFIG_YAML` | Replaces the whole config file content (for development). |

> **Migrating from `.env`**: earlier versions read `.env` / `.loadenv.sh` from the
> project folder and supported `GIST_MCP_SERVER_ENV_GETTER_COMMAND`. Both are gone.
> Move `GITHUB_TOKEN=...` into `github_token:` in the config file, and replace the
> getter command with `config_override_command` (its output is YAML now, not `.env`
> text).

### 3. Obtain a GitHub Personal Access Token

1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Click "Generate new token (classic)"
3. Select the required permission:
   - `gist` - Create, read, write, and delete Gists
4. Generate the token and set it as `github_token` in your config file

### 4. Verify Installation

```bash
# Start the MCP server
./launch.sh

# Or run directly
deno run --allow-read --allow-net --allow-env main.ts
```

## Available Tools

### Gist Management

- **`create_gist`**: Create a GitHub Gist
  - `description`: Description of the Gist (optional)
  - `files`: An object with filenames as keys and file contents as values
  - `public`: Whether the Gist is public (default: false)

- **`get_gist`**: Retrieve a Gist by ID
  - `gist_id`: The ID of the Gist to retrieve

- **`update_gist`**: Update an existing Gist
  - `gist_id`: The ID of the Gist to update
  - `description`: New description (optional)
  - `files`: Files to update (optional)

- **`delete_gist`**: Delete a Gist by ID
  - `gist_id`: The ID of the Gist to delete

- **`list_gists`**: List a user's Gists
  - `username`: Username to query (defaults to the authenticated user)
  - `per_page`: Items per page (1-100, default: 30)
  - `page`: Page number (default: 1)

### Star Management

- **`star_gist`**: Star a Gist
  - `gist_id`: The ID of the Gist to star

- **`unstar_gist`**: Unstar a Gist
  - `gist_id`: The ID of the Gist to unstar

## Usage Examples

### Basic Workflow

1. **Create a single-file Gist**
   ```
   Run create_gist
   - description: "Python Hello World"
   - files: {"hello.py": {"content": "print('Hello, World!')"}}
   - public: false
   ```

2. **Create a multi-file Gist**
   ```
   Run create_gist
   - description: "React Component Example"
   - files: {
       "Component.jsx": {"content": "import React from 'react'..."},
       "styles.css": {"content": ".component { color: blue; }"}
     }
   - public: true
   ```

3. **List Gists**
   ```
   Run list_gists
   → View a list of created Gists
   ```

4. **View Gist Details**
   ```
   Run get_gist with a gist_id
   → View detailed Gist information
   ```

5. **Update a Gist**
   ```
   Run update_gist with a gist_id and updated content
   → Modify file contents or description
   ```

## Testing

### Manual Testing

Use the scripts in the `test-request` directory to verify functionality:

```bash
cd test-request

# List available tools
./test-tools-list.sh

# Test Gist creation
./test-create-gist.sh

# Test Gist listing
./test-list-gists.sh

# Test Gist retrieval (requires gist_id)
./test-get-gist.sh <gist_id>

# Test Gist update (requires gist_id)
./test-update-gist.sh <gist_id>

# Test Gist deletion (requires gist_id)
./test-delete-gist.sh <gist_id>
```

## Development

### Project Structure

```
gist-mcp-server/
├── main.ts                         # MCP server entry point
├── lib/
│   ├── gist.ts                     # GitHub Gist API implementation
│   └── mcp-server-instructions.md  # MCP server description
├── test-request/                   # Manual testing scripts
├── deno.json                       # Deno configuration
├── config.example.yaml             # Config file template
├── launch.sh                       # Launch script
├── CLAUDE.md                       # Claude Code guide
└── README.md                       # This file
```

### Tech Stack

- **Language**: TypeScript
- **Runtime**: Deno
- **MCP Framework**: `@modelcontextprotocol/sdk`
- **Schema Validation**: Zod
- **API Client**: Fetch API

### Design Principles

1. **Type Safety**: Strict type checking with TypeScript + Zod
2. **Error Handling**: Proper error handling for all API calls and user inputs
3. **Input Validation**: Validation at the MCP tool layer
4. **Response Structure**: Unified error and success response format
5. **Security**: Gists are created as private by default

### GitHub Gist API Endpoints

Primary API endpoints used:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/gists` | GET | List Gists |
| `/gists` | POST | Create a Gist |
| `/gists/{id}` | GET | Get Gist details |
| `/gists/{id}` | PATCH | Update a Gist |
| `/gists/{id}` | DELETE | Delete a Gist |
| `/gists/{id}/star` | PUT/DELETE | Star/Unstar a Gist |

## Troubleshooting

### Common Issues

1. **Authentication Error (401 Unauthorized)**
   - Verify that `github_token` is correctly set in `~/.config/gist-mcp-server/config.yaml`
   - Confirm the token has the `gist` permission
   - Check if the token has expired

2. **Network Error**
   - Check your internet connection
   - Review firewall settings
   - Check GitHub API status

3. **Resource Not Found (404 Not Found)**
   - Verify the gist_id is correct
   - Ensure the Gist has not been deleted
   - For private Gists, confirm you are the owner

4. **Debug Mode**
   ```bash
   # Run with debug logging enabled
   DENO_LOG=debug deno run --allow-read --allow-net --allow-env main.ts
   ```

### Log Examples

```
Warning: Failed to load instructions file: ...
Starting gist-mcp-server v1.0.0
```

## Security Considerations

- **API Token Management**: The config file lives outside the repository (`~/.config/gist-mcp-server/`), so the token is never near the working tree
- **Private by Default**: All Gists are created as private by default
- **Least Privilege**: Use a token with only the minimum required permission (`gist`)
- **Sensitive Data**: Do not store sensitive information in Gists

## License

Private project

## Contributing

This project is for personal use; external contributions are not accepted.

## Support

For technical issues or questions, please use the project's issue tracker.
