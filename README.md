# kan-mcp

A Model Context Protocol (MCP) server that exposes the [Kan.bn](https://kan.bn) REST API as tools for AI assistants.

Built with Bun + TypeScript.

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
![Test Coverage](https://img.shields.io/badge/coverage-97%25-brightgreen?style=for-the-badge)

## Overview

kan-mcp exposes 40 tools across 7 domains for managing Kan.bn workspaces, plus MCP Resources for efficient read operations:

| Domain     | Tools | Description                              |
|------------|-------|------------------------------------------|
| workspace  | 8     | List, create, get, update, delete, search workspaces |
| board      | 7     | Manage boards with slug availability checking |
| list       | 3     | Create, update, delete lists             |
| card       | 9     | Full card management with labels, members, activities |
| label      | 4     | Create and manage colored labels         |
| checklist  | 6     | Checklist management with items          |
| comment    | 3     | Card comments                            |
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

## Publishing

```bash
# Login to npm
npm login

# Publish to npm
bun publish --access public
```

After publishing, users can install with:
```bash
bunx kan-mcp
```

## Configuration

kan-mcp requires a Kan.bn API key:

```bash
export KAN_API_KEY=your_api_key_here
bun run src/index.ts
```

Optional: Set a custom API base URL:

```bash
export KAN_API_BASE_URL=https://kan.tools.pugcasa.com/api/v1
```

## Installation

Install once with bunx (no cloning required):

```bash
bunx kan-mcp
```

Or install globally:

```bash
bun add -g kan-mcp
```

## MCP Server Configuration

> **Note:** The configuration format is the same for all agents/IDEs. Check your agent/IDE documentation for where to add this JSON.

Add this to your agent/IDE's MCP server configuration:

```json
{
  "mcpServers": {
    "kan": {
      "command": "bunx",
      "args": ["kan-mcp"],
      "env": {
        "KAN_API_KEY": "kan_your_api_key_here"
      }
    }
  }
}
```

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
workspace.list                    # List all workspaces
workspace.create                  # Create a new workspace
workspace.getById                 # Get workspace by ID
workspace.getBySlug              # Get workspace by slug
workspace.update                  # Update workspace properties
workspace.delete                  # Delete a workspace
workspace.search                  # Search boards and cards
workspace.checkSlugAvailability   # Check if slug is available
```

### Board Tools

```
board.list                       # List boards (with filters)
board.create                     # Create a new board
board.getById                    # Get board by ID (with card filters)
board.getBySlug                  # Get board by slug (with card filters)
board.update                     # Update board properties
board.delete                     # Delete a board
board.checkSlugAvailability      # Check if slug is available
```

#### Board Filtering
`board.getById` and `board.getBySlug` support filtering cards within the board:

| Parameter | Description |
|-----------|-------------|
| `members` | Filter cards by assigned member IDs |
| `labels` | Filter cards by label IDs |
| `lists` | Filter cards by list IDs |
| `dueDateFilters` | Filter by due date status: `overdue`, `today`, `tomorrow`, `next-week`, `next-month`, `no-due-date` |
| `type` | Filter by board type: `regular`, `template` |

### List Tools

```
list.create                      # Create a new list
list.update                      # Update list properties
list.delete                      # Delete a list
```

### Card Tools

```
card.create                      # Create a new card
card.getById                     # Get card by ID
card.update                      # Update card properties
card.delete                      # Delete a card
card.addLabel                    # Add label to card
card.removeLabel                 # Remove label from card
card.addMember                   # Add member to card
card.removeMember                # Remove member from card
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
kan://stats                                    # Application statistics
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
Input: { "workspacePublicId": "ws_xxx", "name": "Sprint 1", "slug": "sprint-1", "visibility": "private" }
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
AI: Find all cards with "login" in the title and update their priority to high

Tool: workspace.search
Input: { "query": "login" }
Output: { "boards": [...], "cards": [{ "publicId": "card_xxx", "title": "Implement login", ... }] }

Tool: card.update
Input: { "publicId": "card_xxx", "priority": "high" }
```

## Test Coverage

```
------------------------|---------|---------|-------------------
File                    | % Funcs | % Lines | Uncovered Line #s
------------------------|---------|---------|-------------------
All files               |   86.50 |   89.09 |
 src/client.ts          |   87.50 |  100.00 |
 src/errors.ts          |   40.00 |   48.78 | 1-7,11-12,17-29
 src/tools/board.ts     |  100.00 |  100.00 |
 src/tools/card.ts      |  100.00 |  100.00 |
 src/tools/checklist.ts |  100.00 |  100.00 |
 src/tools/comment.ts   |  100.00 |  100.00 |
 src/tools/label.ts     |  100.00 |  100.00 |
 src/tools/list.ts      |  100.00 |  100.00 |
 src/tools/server.ts    |  100.00 |   97.73 |
 src/tools/workspace.ts |  100.00 |  100.00 |
 src/types.ts           |  100.00 |  100.00 |
------------------------|---------|---------|-------------------
```

## Architecture

```
kan-mcp/
├── src/
│   ├── index.ts           # MCP server entry, tool & resource registration
│   ├── client.ts          # Kan API client with error mapping
│   ├── types.ts           # Branded IDs, discriminated unions
│   ├── errors.ts          # KanApiError, McpError, error mapping
│   ├── utils.ts           # Type guards, builders
│   └── tools/
│       ├── server.ts      # Server-level tools (health check)
│       ├── resources.ts   # MCP resource handlers
│       ├── workspace.ts   # 8 workspace tools
│       ├── board.ts      # 7 board tools
│       ├── list.ts       # 3 list tools
│       ├── card.ts       # 9 card tools
│       ├── label.ts      # 4 label tools
│       ├── checklist.ts  # 6 checklist tools
│       └── comment.ts    # 3 comment tools
└── tests/
    ├── setup.ts
    └── tools/            # Unit tests per domain
```

## Type Safety

kan-mcp uses TypeScript strict mode with:

- **Branded types** for IDs (WorkspaceId, BoardId, CardId, etc.) to prevent mixing
- **Discriminated unions** for API responses and tool results
- **Const assertions** for routes and enums

## License

MIT
