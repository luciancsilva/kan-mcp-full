# AGENTS.md - kan-mcp Development Guide

## Overview

kan-mcp is a Model Context Protocol (MCP) server for the Kan.bn API. It exposes 54 tools across 10 domains: workspace, member, board, list, card, label, checklist, comment, attachment, and server. It follows the Kan 0.6.0 REST API (OpenAPI at `<kan>/api/v1/openapi.json`).

**Technology Stack:** Bun runtime, TypeScript (strict mode), @modelcontextprotocol/sdk

---

## Commands

```bash
# Install dependencies
bun install

# Build for distribution (creates standalone binary ./kan-mcp)
bun run build

# Run all unit tests
bun test

# Run a specific test file
bun test tests/tools/workspace.test.ts

# Run tests matching a pattern (using grep)
bun test tests/integration

# Run integration tests (requires KAN_API_KEY environment variable)
INTEGRATION_TEST=true bun test tests/integration
```

### Environment Variables

```bash
KAN_API_KEY=your-api-key           # Required for integration tests
KAN_API_BASE_URL=https://kan.bn/api/v1  # Optional, defaults to this
```

---

## TypeScript Configuration

The project uses strict TypeScript with additional checks. Key settings in `tsconfig.json`:

- `strict: true` - Enable all strict type checks
- `noUncheckedIndexedAccess: true` - Arrays/objects return undefined possibility
- `exactOptionalPropertyTypes: true` - Distinguish between unset and undefined
- `noImplicitOverride: true` - Require `override` keyword on overridden methods
- `moduleResolution: bundler` - For ESM with Bun

---

## Code Style Guidelines

### No Linting/Formatting Config

Currently, the project has no ESLint or Prettier configuration. Code style follows TypeScript strict mode and existing patterns in the codebase. **When adding new tooling, maintain consistency with surrounding code.**

### Imports

- Use ESM imports with `.js` extension for local files
- Group imports: external packages first, then internal modules
- Type imports should use `import type` when only importing types

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from './workspace';
import { success, error } from './utils.js';
```

### File Naming

- Source files: lowercase singular (e.g., `client.ts`, `errors.ts`, `workspace.ts`)
- Test files: `*.test.ts` suffix (e.g., `workspace.test.ts`)
- Tool files organized by domain in `src/tools/`

---

## Type Patterns

### Branded Types for IDs

Prevent mixing different ID types using branded types:

```typescript
export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };
export type BoardId = string & { readonly __brand: 'BoardId' };
export type CardId = string & { readonly __brand: 'CardId' };
```

### Discriminated Unions for Results

Use discriminated unions for API responses and tool results:

```typescript
// API responses
export type ApiSuccess<T> = { status: 'success'; data: T };
export type ApiError = { status: 'error'; code: string; message: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Tool results
export type ToolSuccess<T> = { ok: true; data: T };
export type ToolError = { ok: false; error: string };
export type ToolResult<T> = ToolSuccess<T> | ToolError;
```

### Const Assertions for Enums

Use const assertions for fixed sets of values:

```typescript
export const VISIBILITY = ['public', 'private'] as const;
export type Visibility = (typeof VISIBILITY)[number];

export const ROUTES = {
  WORKSPACES: '/workspaces',
  BOARDS: '/boards',
} as const;
```

---

## Naming Conventions

### MCP Tools

Pattern: `domain.action` (lowercase)

```typescript
name: 'workspace.list'
name: 'board.create'
name: 'card.addLabel'
```

### Tool Export Names

Pattern: `{domain}{Action}Tool` (camelCase)

```typescript
export const workspaceListTool
export const boardCreateTool
export const cardAddLabelTool
```

### Input Interfaces

Pattern: `{Domain}{Action}Input`

```typescript
interface WorkspaceCreateInput {
  name: string;
  slug: string;
  description?: string;
}
```

### Entity Interfaces

```typescript
interface Workspace { ... }
interface Board { ... }
interface Card { ... }
```

---

## Error Handling

### Error Class Hierarchy

```typescript
// API errors from HTTP responses
export class KanApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) { ... }
}

// MCP wrapper errors
export class McpError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) { ... }
}

// Convert any error to McpError
export function toMcpError(error: unknown): McpError
```

### HTTP Status to Error Code Mapping

| Status | Code |
|--------|------|
| 400 | invalidInput |
| 401 | unauthorized |
| 403 | forbidden |
| 404 | notFound |
| 500 | internalError |
| default | unknownError |

### Tool Error Pattern

Tools should catch errors and return `ToolResult` using the `success()` or `error()` helpers:

```typescript
handler: async (client: KanClient, input: SomeInput): Promise<ToolResult<T>> => {
  try {
    const data = await client.request<T>(path);
    return success(data);
  } catch (err) {
    return error(toMcpError(err).message);
  }
}
```

---

## Tool Implementation Pattern

Tools are built with `defineTool` (`src/tools/tool.ts`), which wraps `run` so any thrown error becomes a
`ToolResult` error with the message from the Kan API:

```typescript
export const listCreateTool = defineTool<{ boardPublicId: string; name: string }, unknown>({
  name: 'list.create',
  description: 'Create a list (column) in a board.',
  properties: { boardPublicId: { type: 'string' }, name: { type: 'string' } },
  required: ['boardPublicId', 'name'],
  run: async (client, input) => {
    assertString(input.boardPublicId, 'boardPublicId');
    assertString(input.name, 'name');
    return client.request(ROUTES.LISTS, {
      method: 'POST',
      body: JSON.stringify({ boardPublicId: input.boardPublicId, name: input.name }),
    });
  },
});
```

Rules learned from the real API (Kan 0.6.0):

- Build routes from the OpenAPI spec (`/api/v1/openapi.json`), never from memory: methods differ (PUT, not PATCH, for most updates).
- Array query parameters must be repeated (`labels=a&labels=b`) and a single value is rejected: use `appendArray`.
- Check behavior against a real Kan (`scripts/integration-up.sh`), not only with mocks.

Steps to add a tool:

1. Create it with `defineTool` in the domain file under `src/tools/` and export it.
2. Register it in `src/tools/mod.ts`.
3. Add a row to `tests/tools/api-contract.test.ts` (method, path, body) and, if it needs several requests, a case in `tests/tools/flows.test.ts`.
4. Add it to `tests/integration/tools.test.ts` and run it against a real Kan.

---

## Testing Patterns

### Test Structure

Tests use Bun's test framework with `describe`, `test`, `expect`, `beforeEach`, `afterEach`.

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

describe('workspace tools', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('creates a workspace', async () => { ... });
});
```

### Mocking Fetch

Replace `globalThis.fetch` with a mock that returns `Response` objects:

```typescript
globalThis.fetch = async (url, init) => {
  // Access url and init to verify request
  return new Response(JSON.stringify(mockData), {
    status: 200,
    ok: true,
  }) as Response;
};
```

### Asserting ToolResult

Use type guards after checking `ok` property:

```typescript
const result = await workspaceCreateTool.handler(client, input);

expect(result.ok).toBe(true);
if (result.ok) {
  expect(result.data).toEqual(expectedWorkspace);
}
```

---

## Directory Structure

```
src/
├── index.ts              # MCP server entry point
├── version.ts            # VERSION (keep in sync with package.json)
├── client.ts             # Kan API client (KanClient class, retries, error details)
├── types.ts              # Branded IDs, interfaces, discriminated unions
├── errors.ts             # KanApiError, McpError, toMcpError
├── utils.ts              # Type guards, builders, assertions
├── attachment-source.ts  # filePath / url / base64 sources for attachment.add (path and SSRF safety)
└── tools/
    ├── tool.ts           # Tool type, defineTool(), appendArray(), withQuery()
    ├── mod.ts            # Aggregates all 54 tools
    ├── workspace.ts      # 9 workspace tools
    ├── member.ts         # 3 member tools + 3 workspace invite-link tools
    ├── board.ts          # 8 board tools
    ├── list.ts           # 3 list tools
    ├── card.ts           # 10 card tools
    ├── label.ts          # 4 label tools
    ├── checklist.ts      # 6 checklist tools
    ├── comment.ts        # 3 comment tools
    ├── attachment.ts     # 4 attachment tools
    ├── server.ts         # server.health
    └── resources.ts      # MCP resources

tests/
├── helpers.ts            # useKanMock(), run(): fetch mock that records requests
├── client.test.ts        # API client tests
├── tools/                # api-contract (method/path/body per tool), flows, attachments, ...
└── integration/          # Real Kan: tools.test.ts, attachment.test.ts (see docs/testing)
```

---

## Adding New Tools

See "Tool Implementation Pattern" above. Update README.md when a tool is added.

---

## Future Improvements

- Consider adding ESLint with TypeScript rules for consistent code style
- Consider adding Prettier for automated formatting
- Add integration test coverage for remaining tools
