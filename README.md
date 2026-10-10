# kan-mcp-full

A Model Context Protocol (MCP) server that exposes the [Kan.bn](https://kan.bn) REST API as tools for AI assistants.

Built with Bun + TypeScript.

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)

## Overview

kan-mcp-full exposes 54 tools for managing Kan.bn workspaces, plus MCP Resources for efficient read operations. It follows the Kan REST API of **Kan 0.6.0** (tested against `ghcr.io/kanbn/kan:latest`).

| Domain     | Tools | Description                              |
|------------|-------|------------------------------------------|
| workspace  | 12    | List, find, create, update, delete, search; invite links |
| member     | 3     | Invite, remove, change role              |
| board      | 8     | Manage boards, card filters, public boards by slug |
| list       | 3     | Create, update, delete lists             |
| card       | 10    | Cards, move, duplicate, labels, members, activities |
| label      | 4     | Create and manage colored labels         |
| checklist  | 6     | Checklist management with items          |
| comment    | 3     | Card comments                            |
| attachment | 4     | Add (file, URL or base64), list, remove and download card attachments |
| server     | 1     | Health check                             |
| **Resources** | **3** | **Read-only URIs for efficient context loading** |

## Quick Start

```bash
# Install (for development)
bun install

# Run tests
bun test

# Build for distribution
bun run build
```

## Configuration

kan-mcp-full requires a Kan.bn API key:

```bash
export KAN_API_KEY=your_api_key_here
bun run src/index.ts
```

Optional: Set a custom API base URL:

```bash
export KAN_API_BASE_URL=https://kan.example.com/api/v1   # your Kan instance; defaults to https://kan.bn/api/v1
```

### Retries

The HTTP client retries `GET`, `PUT` and `DELETE` on 5xx, network errors and 429 (up to 3 times, with backoff). `POST` and `PATCH` are only retried on 429, because after a 5xx or a dropped connection the change may already have been applied and a retry would duplicate it (two cards, two comments).

Kan answers requests above the API key's rate limit (100 per minute by default) with `401 Unauthorized`, not 429, so that case is not retried automatically.

### Attachments

`attachment.add` uploads through the presigned-URL flow of the Kan API, so the Kan instance needs S3-compatible storage configured and reachable from where this MCP runs.

| Variable | Description |
|----------|-------------|
| `KAN_MCP_UPLOAD_ROOT` | Directory that `filePath` may read from. `filePath` is disabled when unset. Symlinks that leave this directory are rejected. |
| `KAN_MCP_DOWNLOAD_DIR` | Directory `attachment.download` saves files to. The tool is disabled when unset. |
| `KAN_MCP_ALLOW_PRIVATE_URLS` | Set to `true` to let `url` point to private or internal addresses (blocked by default, including redirects). |

Security notes for `attachment.add`:
- `filePath` only reads inside `KAN_MCP_UPLOAD_ROOT` (symlinks that escape it are rejected).
- `url` accepts only http(s) and refuses private, loopback and link-local addresses, also on every redirect. The address is checked right before the download; it does not pin the resolved IP, so a hostile DNS server that changes its answer between the check and the download is not covered. Leave `KAN_MCP_ALLOW_PRIVATE_URLS` unset unless you need internal URLs.
- The file goes straight to the storage with the presigned URL; your Kan API key is never sent to the storage.

Limits: 50 MB per file (Kan limit). `attachment.list` and `attachment.download` use the `attachments` field (with the storage `url`) returned by `GET /cards/{id}` and return a clear error when it is missing.

Tested against Kan 0.6.0 (`ghcr.io/kanbn/kan:latest`) with an S3-compatible storage.

## Installation

> `kan-mcp-full` is a fork of `michaelruelas/kan-mcp` with attachments, the Kan 0.6.0 API fixes and the tools of the official Kan MCP. It is a different package from `kan-mcp` on npm (the original project, without attachments, with routes of an older Kan API).

From the repository:

```bash
git clone https://github.com/luciancsilva/kan-mcp
cd kan-mcp
bun install
bun run build        # optional: creates a standalone ./kan-mcp-full binary
```

Once published to npm (`bun publish`), it runs without cloning: `bunx kan-mcp-full`.

## MCP Server Configuration

> **Note:** The configuration format is the same for all agents/IDEs. Check your agent/IDE documentation for where to add this JSON.

Add this to your agent/IDE's MCP server configuration (use the absolute path of your clone, or the built binary as `command` with no `args`; once published, `"command": "bunx", "args": ["kan-mcp-full"]` also works):

```json
{
  "mcpServers": {
    "kan": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/kan-mcp/src/index.ts"],
      "env": {
        "KAN_API_KEY": "kan_your_api_key_here",
        "KAN_API_BASE_URL": "https://kan.example.com/api/v1",
        "KAN_MCP_UPLOAD_ROOT": "/home/you/kan-uploads",
        "KAN_MCP_DOWNLOAD_DIR": "/home/you/kan-downloads"
      }
    }
  }
}
```

`KAN_API_KEY` is required. The other variables are optional (see Configuration and Attachments above).

## Docker (HTTP service)

The image runs the MCP over **Streamable HTTP** (`POST /mcp`) protected by a bearer token, so it can stay running next to your Kan and be used by n8n, agents or remote MCP clients. It talks to any Kan through its URL.

```bash
git clone https://github.com/luciancsilva/kan-mcp && cd kan-mcp
cp .env.example .env          # fill KAN_API_KEY, KAN_API_BASE_URL and MCP_AUTH_TOKEN (openssl rand -hex 32)
mkdir -p uploads downloads && sudo chown 1000:1000 downloads
docker compose up -d          # builds the image from the Dockerfile when the published one is not available
curl http://127.0.0.1:3333/health      # {"status":"ok","version":"..."}
```

To update later: `git pull && docker compose up -d --build`.

To use the published image instead of building it (after `docker login ghcr.io`, see below): `docker compose pull && docker compose up -d`.

| Variable | Default | Description |
|----------|---------|-------------|
| `KAN_API_KEY` | required | Kan API key |
| `KAN_API_BASE_URL` | required in compose | e.g. `https://kan.example.com/api/v1` |
| `MCP_AUTH_TOKEN` | required | Clients send `Authorization: Bearer <token>` (at least 16 characters) |
| `MCP_TRANSPORT` | `http` in the image, `stdio` otherwise | `http` or `stdio` |
| `MCP_HOST` / `MCP_PORT` | `0.0.0.0` in the image / `3333` | Listen address |
| `KAN_MCP_UPLOAD_DIR` | `./uploads` | Host folder mounted read-only at `/data/uploads`; `attachment.add` `filePath` reads from it |
| `KAN_MCP_DOWNLOAD_DIR` | `./downloads` | Host folder mounted at `/data/downloads`; `attachment.download` writes to it. It must be writable by `MCP_UID`:`MCP_GID` (default 1000:1000) |

Notes:
- The port is published on `127.0.0.1` only. To reach it from other machines, put a reverse proxy with **TLS** in front (the token travels in a header).
- `/health` needs no token and shows only the version. Everything else requires the token.
- The container is non-root, with a read-only filesystem, no capabilities and `no-new-privileges`. Inside the container `filePath` is limited to `/data/uploads`, so the model cannot read other files.
- Kan's presigned storage URLs (R2, S3, MinIO) must be reachable from the container, since the file is sent straight to the storage.
- Kan on the same host: use `KAN_API_BASE_URL=http://host.docker.internal:3000/api/v1`, or join the Kan compose network.

Clients (any client that supports Streamable HTTP with a custom header):

```bash
# Claude Code
claude mcp add --transport http kan https://mcp.example.com/mcp --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
```

n8n: MCP Client node with Streamable HTTP, URL `http://kan-mcp:3333/mcp` (same Docker network) and a header `Authorization: Bearer <MCP_AUTH_TOKEN>`.

stdio from the image (the MCP client starts the container on demand):

```json
{ "mcpServers": { "kan": { "command": "docker", "args": ["run", "-i", "--rm",
  "-e", "MCP_TRANSPORT=stdio", "-e", "KAN_API_KEY", "-e", "KAN_API_BASE_URL",
  "ghcr.io/luciancsilva/kan-mcp-full:latest"],
  "env": { "KAN_API_KEY": "kan_...", "KAN_API_BASE_URL": "https://kan.example.com/api/v1" } } } }
```

Publishing the image: `.github/workflows/docker.yml` builds `linux/amd64` and `linux/arm64`. Every push to `main` publishes `ghcr.io/<owner>/kan-mcp-full:latest` (and `:sha-<short>`); pushing a `v*.*.*` tag (e.g. `git tag v0.4.0 && git push origin v0.4.0`) also publishes the version tags `:0.4.0` and `:0.4`. Pull requests only build. The first publication creates a private package: make it public in the GitHub package settings, or `docker login ghcr.io` (a token with `read:packages`) on the server.

### Where to add the configuration

| Agent/IDE | Location |
|-----------|----------|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | Settings → MCP → Add new server |
| VS Code with Copilot | `.vscode/mcp.json` |
| Roo (CLINE) | Your global MCP settings |

## Available Tools

### Workspace Tools

```
workspace.list                    # List workspaces of the user (with role); limit/offset on the client
workspace.findByName              # Find a workspace by name
workspace.create                  # Create a new workspace (slug optional)
workspace.getById                 # Get workspace by ID (with members)
workspace.getBySlug               # Get workspace by slug
workspace.update                  # Update name, slug, description, weekStartDay, showEmailsToMembers
workspace.delete                  # Delete a workspace
workspace.search                  # Search boards and cards of a workspace
workspace.checkSlugAvailability   # Check a slug (see note below)
workspace.getInviteLink           # Get the active invite link
workspace.createInviteLink        # Create an invite link
workspace.deactivateInviteLinks   # Deactivate the invite link
```

> **Note:** Kan 0.6.0 routes `GET /workspaces/check-slug-availability` to the public-ID handler, so
> `workspace.checkSlugAvailability` may answer with an explanatory error. `workspace.create` reports a
> taken slug anyway. `workspace.getBySlug` is unaffected: it resolves the slug from `workspace.list`.

### Member Tools

```
member.invite                    # Invite a person by e-mail
member.remove                    # Remove a member from a workspace
member.updateRole                # Change the role: admin, member or guest
```

### Board Tools

```
board.list                       # List boards of a workspace (type/archived filters)
board.findByName                 # Find a board by name inside a workspace
board.create                     # Create a board with lists, labels, template; slug/visibility optional
board.getById                    # Get board by ID (with card filters)
board.getBySlug                  # Get a PUBLIC board by workspace slug and board slug
board.update                     # Update name, slug, visibility, favorite, isArchived
board.delete                     # Delete a board
board.checkSlugAvailability      # Check a slug for a board
```

#### Board Filtering
`board.getById` and `board.getBySlug` narrow the cards returned:

| Parameter | Description |
|-----------|-------------|
| `members` | Cards assigned to these workspace member IDs |
| `labels` | Cards with these label IDs |
| `lists` | Only these lists |
| `dueDateFilters` | `overdue`, `today`, `tomorrow`, `next-week`, `next-month`, `no-due-date` |
| `type` | `regular` or `template` (`board.getById` only) |

> Kan only serves **public** boards by slug (private ones return nothing). Use `board.getById` for private boards.

### List Tools

```
list.create                      # Create a new list
list.update                      # Rename or reorder (index) a list
list.delete                      # Delete a list
```

### Card Tools

```
card.create                      # Create a card (labels, members, due date, position)
card.getById                     # Get card by ID (labels, members, checklists, attachments, list)
card.update                      # Update fields; move to another list with listPublicId + index
card.delete                      # Delete a card
card.duplicate                   # Duplicate a card (same or other list)
card.addLabel                    # Add label to card (idempotent)
card.removeLabel                 # Remove label from card (idempotent)
card.addMember                   # Assign a workspace member (idempotent)
card.removeMember                # Unassign a workspace member (idempotent)
card.listActivities              # List card activities (with cursor pagination)
```

### Label Tools

```
label.create                     # Create a new label
label.getById                    # Get label by ID
label.update                     # Update label properties
label.delete                     # Delete a label
```

### Checklist Tools

```
checklist.create                 # Create checklist on card
checklist.update                 # Update checklist properties
checklist.delete                 # Delete a checklist
checklist.addItem                # Add item to checklist
checklist.updateItem             # Update checklist item
checklist.deleteItem             # Delete checklist item
```

### Attachment Tools

```
attachment.add                   # Attach a file to a card (filePath, url or contentBase64)
attachment.list                  # List attachments of a card
attachment.remove                # Remove an attachment
attachment.download              # Save an attachment to KAN_MCP_DOWNLOAD_DIR
```

### Comment Tools

```
comment.add                      # Add comment to card
comment.update                   # Update comment
comment.delete                   # Delete a comment
```

### Server Tools

```
server.health                    # Check MCP server and dependency health
```

### MCP Resources

MCP Resources provide read-only data URIs for efficient LLM context loading. Unlike tools (which require an action), resources allow the LLM to read data directly via URI.

```
kan://stats                                    # Application statistics (needs Kan's admin API key)
kan://board/{boardPublicId}                   # Board by public ID
kan://workspace/{workspaceSlug}/board/{boardSlug}  # Board by slug
```

#### Card Activities Pagination
`card.listActivities` supports cursor-based pagination:

| Parameter | Description |
|-----------|-------------|
| `limit` | Number of activities (1-100, default 10) |
| `cursor` | ISO timestamp cursor for next page |

Response includes `hasMore` and `nextCursor` for easy iteration.

## Rich Text / HTML Support

Card descriptions and comment content support HTML formatting. The API automatically sanitizes HTML to prevent XSS attacks, allowing only safe tags and attributes.

### Supported HTML Tags

- `<p>...</p>` - Paragraphs
- `<br>` - Line breaks
- `<strong>`, `<em>`, `<b>`, `<i>`, `<u>` - Text formatting
- `<a href="...">...</a>` - Links (javascript: and data: URLs are blocked)
- `<ul>`, `<ol>`, `<li>` - Lists
- `<h1>` through `<h6>` - Headings

### Example

```html
<p>Salary: $156,400 - $225,000</p>
<p>Location: Washington, DC area (Hybrid)</p>
<p>Tech Stack: Python, Java, Spark, BigQuery, Kafka, AWS</p>
<p><a href="https://linkedin.com/jobs/123">View on LinkedIn</a></p>
```

### Important

- **Plain text with `\n` will NOT render correctly** - Use `<br>` or `<p>` tags for line breaks
- Dangerous tags like `<script>`, `<iframe>`, `<form>` are automatically removed
- Event handler attributes (onclick, onmouseover, etc.) are stripped

## Usage Examples

### Create a workspace and board

```
AI: Create a workspace called "Project Alpha" with slug "project-alpha"

Tool: workspace.create
Input: { "name": "Project Alpha", "slug": "project-alpha" }
Output: { "publicId": "ws_xxx", "name": "Project Alpha", "slug": "project-alpha", ... }

AI: Now create a board called "Sprint 1" in that workspace

Tool: board.create
Input: { "workspacePublicId": "ws_xxx", "name": "Sprint 1", "lists": ["Todo", "Doing", "Done"], "labels": ["backend"] }
Output: { "publicId": "brd_xxx", "name": "Sprint 1", ... }
```

### Manage cards with labels and checklists

```
AI: Add a card called "Implement login" to the Sprint 1 board, add the "backend" label, and create a checklist with "Design DB schema" and "Write auth middleware"

Tool: card.create
Input: { "listPublicId": "lst_xxx", "title": "Implement login" }

Tool: card.addLabel
Input: { "cardPublicId": "card_xxx", "labelPublicId": "lbl_backend" }

Tool: checklist.create
Input: { "cardPublicId": "card_xxx", "name": "Tasks" }

Tool: checklist.addItem
Input: { "checklistPublicId": "chk_xxx", "title": "Design DB schema" }

Tool: checklist.addItem
Input: { "checklistPublicId": "chk_xxx", "title": "Write auth middleware" }
```

### Search and update

```
AI: Find the cards with "login" in the title and move one to the Doing list

Tool: workspace.search
Input: { "workspacePublicId": "ws_xxx", "query": "login" }
Output: [{ "type": "card", "publicId": "card_xxx", "title": "Implement login", ... }]

Tool: card.update
Input: { "publicId": "card_xxx", "title": "Implement login (SSO)", "listPublicId": "lst_doing" }
```

## Tests

```bash
bun test                                   # unit tests, no Kan needed
./scripts/integration-up.sh                # disposable Kan + Postgres + S3 (Docker, Linux)
set -a; . ./.env.integration; set +a
INTEGRATION_TEST=true bun test tests/integration
```

- `tests/tools/api-contract.test.ts`: method, path and body each tool sends, plus input validation for every tool.
- `tests/tools/flows.test.ts` and `attachment.test.ts`: tools that need several requests, error messages, security checks.
- `tests/integration/`: every tool against a real Kan 0.6.0 (also verified with Cloudflare R2 storage). See `docs/testing/INTEGRATION_TESTS.md`.

## Architecture

```
src/
├── index.ts               # Entry point: stdio or HTTP depending on MCP_TRANSPORT
├── server.ts              # createKanServer(): tool and resource registration
├── http.ts                # Streamable HTTP server with bearer token
├── client.ts              # Kan API client: auth, retries, timeouts, error details
├── attachment-source.ts   # filePath / url / base64 sources (path and SSRF safety)
├── types.ts  errors.ts  utils.ts  version.ts
└── tools/
    ├── tool.ts            # Tool type, defineTool(), query helpers
    ├── workspace.ts  member.ts  board.ts  list.ts  card.ts
    ├── label.ts  checklist.ts  comment.ts  attachment.ts
    └── server.ts  resources.ts  mod.ts
```

## Type Safety

kan-mcp-full uses TypeScript strict mode with:

- **Branded types** for IDs (WorkspaceId, BoardId, CardId, etc.) to prevent mixing
- **Discriminated unions** for API responses and tool results
- **Const assertions** for routes and enums

## License

MIT, see [LICENSE](LICENSE). Derived from [michaelruelas/kan-mcp](https://github.com/michaelruelas/kan-mcp), see [NOTICE](NOTICE).
