> **Histórico:** documento do projeto original (`michaelruelas/kan-mcp`, abril de 2026), escrito para uma versão antiga da API do Kan. As rotas, nomes e contagens aqui estão desatualizados. Para o estado atual, veja `README.md`, `AGENTS.md` e `docs/COMPARACAO_MCP_OFICIAL.md`.

# Kan MCP Server Design Specification

> **Date:** 2026-04-09
> **Project:** Kan MCP Server
> **Status:** Approved for Implementation

## Overview

An MCP (Model Context Protocol) server that exposes the Kan.bn REST API as tools for AI assistants. Built with Bun + TypeScript for public distribution.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| Language | TypeScript (strict mode) |
| SDK | @modelcontextprotocol/sdk |
| HTTP | Native fetch |
| Testing | Bun:test |

---

## TypeScript Best Practices Applied

### 1. Strict Mode Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"]
  }
}
```

### 2. Branded Types for IDs

All public IDs use branded types to prevent mixing different ID types:

```typescript
type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };
type BoardId = string & { readonly __brand: 'BoardId' };
type CardId = string & { readonly __brand: 'CardId' };
type ListId = string & { readonly __brand: 'ListId' };
type LabelId = string & { readonly __brand: 'LabelId' };
type ChecklistId = string & { readonly __brand: 'ChecklistId' };
type CommentId = string & { readonly __brand: 'CommentId' };
```

### 3. Discriminated Unions for API Responses

```typescript
type ApiSuccess<T> = { status: 'success'; data: T };
type ApiError = { status: 'error'; code: string; message: string };
type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

### 4. Discriminated Unions for Tool Results

Each tool returns a discriminated union ensuring type-safe results:

```typescript
type ToolSuccess<T> = { ok: true; data: T };
type ToolError = { ok: false; error: McpError };
type ToolResult<T> = ToolSuccess<T> | ToolError;
```

### 5. Const Assertions for Routes and Enums

```typescript
const ROUTES = {
  WORKSPACES: '/workspaces',
  BOARDS: '/boards',
  CARDS: '/cards',
} as const;

const VISIBILITY = ['public', 'private'] as const;
type Visibility = typeof VISIBILITY[number];

const POSITION = ['start', 'end'] as const;
type Position = typeof POSITION[number];
```

---

## Project Structure

```
kan-mcp/
├── src/
│   ├── index.ts              # Server entry, tool registration
│   ├── client.ts             # Kan API client
│   ├── types.ts              # Branded IDs, discriminants
│   ├── errors.ts             # Error mapping
│   ├── tools/
│   │   ├── mod.ts            # Aggregates all tools
│   │   ├── workspace.ts      # workspace.* tools
│   │   ├── board.ts          # board.* tools
│   │   ├── list.ts           # list.* tools
│   │   ├── card.ts           # card.* tools
│   │   ├── label.ts          # label.* tools
│   │   ├── checklist.ts      # checklist.* tools
│   │   └── comment.ts        # comment.* tools
│   └── utils/
│       └── index.ts          # Type guards, builders
├── tests/
│   ├── client.test.ts
│   ├── tools/
│   │   ├── workspace.test.ts
│   │   ├── board.test.ts
│   │   └── card.test.ts
│   └── types.test.ts
├── docs/
│   └── superpowers/
│       ├── specs/
│       └── plans/
├── package.json
├── tsconfig.json
├── bunfig.toml
└── README.md
```

---

## API Client Design

### Client Class

```typescript
class KanClient {
  private readonly baseUrl = 'https://kan.bn/api/v1';
  private readonly apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    if (!response.ok) {
      throw KanApiError.fromHttpStatus(response.status, await response.text());
    }
    
    return response.json() as Promise<T>;
  }
}
```

### Error Mapping

| HTTP Status | KanError Code | McpError Code |
|-------------|---------------|---------------|
| 400 | BAD_REQUEST | invalidInput |
| 401 | UNAUTHORIZED | unauthorized |
| 403 | FORBIDDEN | forbidden |
| 404 | NOT_FOUND | notFound |
| 500 | INTERNAL_ERROR | internalError |

---

## Tool Naming Convention

All tools follow `domain.action` pattern:

### Workspace Tools
- `workspace.list` - Get all workspaces
- `workspace.create` - Create workspace
- `workspace.getById` - Get workspace by public ID
- `workspace.getBySlug` - Get workspace by slug
- `workspace.update` - Update workspace
- `workspace.delete` - Delete workspace
- `workspace.search` - Search boards and cards
- `workspace.checkSlugAvailability` - Check if slug is available

### Board Tools
- `board.list` - Get all boards (with filters)
- `board.create` - Create board
- `board.getById` - Get board by public ID
- `board.getBySlug` - Get board by slug
- `board.update` - Update board
- `board.delete` - Delete board
- `board.checkSlugAvailability` - Check if slug is available

### List Tools
- `list.create` - Create list
- `list.update` - Update list
- `list.delete` - Delete list

### Card Tools
- `card.create` - Create card
- `card.getById` - Get card by public ID
- `card.update` - Update card
- `card.delete` - Delete card
- `card.addLabel` - Add label to card
- `card.removeLabel` - Remove label from card
- `card.addMember` - Add member to card
- `card.removeMember` - Remove member from card
- `card.listActivities` - Get card activities

### Label Tools
- `label.create` - Create label
- `label.getById` - Get label by public ID
- `label.update` - Update label
- `label.delete` - Delete label

### Checklist Tools
- `checklist.create` - Create checklist on card
- `checklist.update` - Update checklist
- `checklist.delete` - Delete checklist
- `checklist.addItem` - Add item to checklist
- `checklist.updateItem` - Update checklist item
- `checklist.deleteItem` - Delete checklist item

### Comment Tools
- `comment.add` - Add comment to card
- `comment.update` - Update comment
- `comment.delete` - Delete comment

---

## Authentication

User sets `KAN_API_KEY` environment variable:

```bash
export KAN_API_KEY=kan_123456789
```

Server reads via `process.env.KAN_API_KEY` on startup.

---

## MCP Configuration

```json
{
  "mcpServers": {
    "kan": {
      "command": "bun",
      "args": ["src/index.ts"],
      "env": {
        "KAN_API_KEY": "kan_xxx"
      }
    }
  }
}
```

---

## Testing Strategy

### Unit Tests
- API client request/response mapping
- Error code mapping
- Type guard functions
- Tool input validation

### Test Structure (TDD)

Each tool module has a corresponding test file:

```typescript
// tests/tools/board.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { BoardClient } from '../../src/tools/board';

describe('board', () => {
  // Tests for each tool
});
```

---

## Implementation Priority

### Phase 1: Foundation
1. Project setup (package.json, tsconfig, bunfig)
2. Type definitions (branded IDs, discriminated unions)
3. API client with error mapping
4. Base tool structure

### Phase 2: Core Tools
1. Workspace tools (8 tools)
2. Board tools (7 tools)
3. List tools (3 tools)
4. Card tools (9 tools)

### Phase 3: Supporting Tools
1. Label tools (4 tools)
2. Checklist tools (6 tools)
3. Comment tools (3 tools)

### Phase 4: Polish
1. README documentation
2. Error message improvements
3. Input validation enhancements

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tool naming | Namespaced (domain.action) | Scalable, clear organization |
| HTTP client | Vanilla fetch | Minimal deps, Bun native support |
| Auth | Environment variable | Standard, secure, portable |
| Listing | Single flexible tool | Cleaner, fewer tools |
| Type safety | Branded + discriminated unions | Prevents ID mixing, exhaustiveness |
| Config | TSDoc + inline validation | Self-documenting |
