# Kan MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, type-safe MCP server for Kan.bn using Bun and TypeScript.

**Architecture:** Domain-driven tool design (namespaced) with a clean API client wrapper.

**Tech Stack:** Bun, TypeScript (strict mode), @modelcontextprotocol/sdk.

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`, `tsconfig.json`, `bunfig.toml`, `README.md`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "kan-mcp",
  "version": "0.1.0",
  "main": "src/index.ts",
  "scripts": {
    "build": "bun build src/index.ts --compile --outfile kan-mcp",
    "test": "bun test"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

- [ ] **Step 2: Configure tsconfig.json (Strict Mode)**

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

- [ ] **Step 3: Initialize bunfig.toml**

```toml
[test]
preload = ["./tests/setup.ts"]
```

- [ ] **Step 4: Commit**
```bash
git add package.json tsconfig.json bunfig.toml README.md
git commit -m "feat: project scaffolding"
```

### Task 2: Type Definitions & Utilities

**Files:**
- Create: `src/types.ts`, `src/errors.ts`, `src/utils.ts`

- [ ] **Step 1: Create `src/types.ts` (Branded IDs)**

```typescript
export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };
export type BoardId = string & { readonly __brand: 'BoardId' };
export type CardId = string & { readonly __brand: 'CardId' };
// ... add others
```

- [ ] **Step 2: Create `src/errors.ts` (Error mapping)**

```typescript
export class KanApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
  static fromHttpStatus(status: number, message: string) {
    return new KanApiError(status, message);
  }
}
```

- [ ] **Step 3: Commit**
```bash
git add src/types.ts src/errors.ts src/utils.ts
git commit -m "feat: add type definitions and error handling"
```

### Task 3: Kan API Client

**Files:**
- Create: `src/client.ts`
- Test: `tests/client.test.ts`

- [ ] **Step 1: Implement `KanClient`**

```typescript
// Uses vanilla fetch as planned
export class KanClient {
  private readonly apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = process.env.KAN_API_KEY!;
  }
  async request<T>(path: string, options?: RequestInit): Promise<T> {
     // ... implementation
  }
}
```

- [ ] **Step 2: Implement Test**

```typescript
// Test API client
```

- [ ] **Step 3: Commit**
```bash
git add src/client.ts tests/client.test.ts
git commit -m "feat: implement kan api client"
```

### Task 4: MCP Server Setup

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Setup MCP Server instance**

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({ name: "kan-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });
// ... setup handlers
```

- [ ] **Step 2: Commit**
```bash
git add src/index.ts
git commit -m "feat: setup mcp server"
```

### Task 5: Implement Tools (Domain by Domain)

- [ ] **Task 5a: Workspace Tools**
- [ ] **Task 5b: Board Tools**
- [ ] **Task 5c: List Tools**
- [ ] **Task 5d: Card Tools**
- ... and so on.

(Each task follows the TDD pattern: Write Test -> Run/Fail -> Implement -> Pass -> Commit)
