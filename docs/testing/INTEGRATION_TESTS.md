# Integration Testing Guide

This document describes how to run integration tests against the real Kan.bn API.

> **Note for agents/IDEs:** Environment variables can typically be set via:
> - CLI: `INTEGRATION_TEST=true KAN_API_KEY=your_key bun test tests/integration`
> - MCP config: Add to `env` section of your MCP server configuration
> - IDE: Check your IDE's environment variable settings

## Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Set your credentials in `.env`:
```bash
KAN_API_KEY=your_test_api_key
KAN_API_BASE_URL=https://kan.bn/api/v1  # Optional, defaults to kan.bn
```

3. Run integration tests:
```bash
INTEGRATION_TEST=true bun test tests/integration
```

## Test Environments

### Clean Workspace (Recommended)
Create a dedicated test workspace to avoid affecting production data:
- Workspace slug: `kan-mcp-test`
- All tests create/update/delete resources in this workspace

### Data Cleanup
Integration tests attempt to clean up created resources, but may fail if:
- API key lacks permissions
- Network errors occur mid-test
- Tests are interrupted

Manual cleanup may be required.

## Tool Test Matrix

### Workspace Tools (8)

| Tool | Required Input | Optional Input | Filters/Options |
|------|---------------|---------------|-----------------|
| `workspace.list` | - | `limit`, `offset` | Pagination |
| `workspace.create` | `name`, `slug` | `description` | - |
| `workspace.getById` | `publicId` | - | - |
| `workspace.getBySlug` | `slug` | - | - |
| `workspace.update` | `publicId` | `name`, `description`, `showEmailsToMembers`, `weekStartDay` | - |
| `workspace.delete` | `publicId` | - | - |
| `workspace.search` | `query` | - | - |
| `workspace.checkSlugAvailability` | `slug` | - | - |

### Board Tools (7)

| Tool | Required Input | Optional Input | Filters/Options |
|------|---------------|---------------|-----------------|
| `board.list` | - | `workspacePublicId`, `visibility` | Filter by workspace/visibility |
| `board.create` | `workspacePublicId`, `name`, `slug`, `visibility` | - | - |
| `board.getById` | `publicId` | - | - |
| `board.getBySlug` | `workspacePublicId`, `slug` | - | - |
| `board.update` | `publicId` | `name`, `visibility` | - |
| `board.delete` | `publicId` | - | - |
| `board.checkSlugAvailability` | `workspacePublicId`, `slug` | - | - |

### List Tools (3)

| Tool | Required Input | Optional Input | Filters/Options |
|------|---------------|---------------|-----------------|
| `list.create` | `boardPublicId`, `name` | - | - |
| `list.update` | `publicId` | `name`, `index` | - |
| `list.delete` | `publicId` | - | - |

### Card Tools (9)

| Tool | Required Input | Optional Input | Filters/Options |
|------|---------------|---------------|-----------------|
| `card.create` | `listPublicId`, `title` | `description`, `dueDate` | - |
| `card.getById` | `publicId` | - | - |
| `card.update` | `publicId` | `title`, `description`, `dueDate`, `index` | - |
| `card.delete` | `publicId` | - | - |
| `card.addLabel` | `cardPublicId`, `labelPublicId` | - | - |
| `card.removeLabel` | `cardPublicId`, `labelPublicId` | - | - |
| `card.addMember` | `cardPublicId`, `memberPublicId` | - | - |
| `card.removeMember` | `cardPublicId`, `memberPublicId` | - | - |
| `card.listActivities` | `cardPublicId` | - | - |

### Label Tools (4)

| Tool | Required Input | Optional Input | Filters/Options |
|------|---------------|---------------|-----------------|
| `label.create` | `boardPublicId`, `name`, `colourCode` | - | - |
| `label.getById` | `publicId` | - | - |
| `label.update` | `publicId` | `name`, `colourCode` | - |
| `label.delete` | `publicId` | - | - |

### Checklist Tools (6)

| Tool | Required Input | Optional Input | Filters/Options |
|------|---------------|---------------|-----------------|
| `checklist.create` | `cardPublicId`, `name` | - | - |
| `checklist.update` | `publicId` | `name` | - |
| `checklist.delete` | `publicId` | - | - |
| `checklist.addItem` | `checklistPublicId`, `title` | - | - |
| `checklist.updateItem` | `publicId` | `title`, `completed` | Toggle completion |
| `checklist.deleteItem` | `publicId` | - | - |

### Comment Tools (3)

| Tool | Required Input | Optional Input | Filters/Options |
|------|---------------|---------------|-----------------|
| `comment.add` | `cardPublicId`, `content` | - | - |
| `comment.update` | `cardPublicId`, `publicId`, `content` | - | - |
| `comment.delete` | `cardPublicId`, `publicId` | - | - |

## Test Scenarios

### Workspace Lifecycle
1. Create workspace with unique slug
2. Get by ID
3. Get by slug
4. Update (change name, description)
5. Search (query by name)
6. Check slug availability
7. Delete

### Board Lifecycle
1. Create board in test workspace
2. List boards (filter by workspace)
3. Get by ID
4. Get by slug
5. Update (change name, visibility)
6. Check slug availability
7. Delete

### Card Lifecycle with Labels & Checklists
1. Create card in list
2. Create label on board
3. Add label to card
4. Create checklist on card
5. Add items to checklist
6. Toggle item completion
7. Update card (title, dueDate)
8. List card activities
9. Remove label from card
10. Delete checklist item
11. Delete checklist
12. Delete card

### Comment Lifecycle
1. Add comment to card
2. Update comment
3. Delete comment

## Debugging Failed Tests

If tests fail, check:
1. `.env` has valid `KAN_API_KEY`
2. API key has workspace admin permissions
3. Network connectivity
4. Test workspace exists (for filtered tests)

Run with verbose output:
```bash
INTEGRATION_TEST=true bun test tests/integration --reporter=verbose
```
