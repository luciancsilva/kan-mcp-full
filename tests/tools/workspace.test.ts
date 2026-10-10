import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { KanClient } from '../../src/client';
import { Workspace, ToolResult } from '../../src/types';
import {
  workspaceListTool,
  workspaceCreateTool,
  workspaceGetByIdTool,
  workspaceGetBySlugTool,
  workspaceUpdateTool,
  workspaceDeleteTool,
  workspaceSearchTool,
  workspaceCheckSlugAvailabilityTool,
} from '../../src/tools/workspace';

const TEST_API_KEY = 'test-api-key';
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('workspace tools', () => {
  describe('workspace.list', () => {
    test('returns list of workspaces', async () => {
      const client = new KanClient(TEST_API_KEY);
      const mockWorkspaces: Workspace[] = [
        {
          publicId: 'ws-1',
          name: 'Workspace 1',
          slug: 'workspace-1',
          description: 'Test workspace',
          showEmailsToMembers: false,
          weekStartDay: 'monday',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      globalThis.fetch = async () =>
        new Response(JSON.stringify(mockWorkspaces), {
          status: 200,
          ok: true,
        }) as Response;

      const result = await workspaceListTool.handler(client, {});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockWorkspaces);
      }
    });

    test('returns error on API failure', async () => {
      const client = new KanClient(TEST_API_KEY, undefined, 5000, 0);

      globalThis.fetch = async () =>
        new Response(null, {
          status: 500,
          statusText: 'Internal Server Error',
          ok: false,
        }) as Response;

      const result = await workspaceListTool.handler(client, {});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe('workspace.create', () => {
    test('creates a workspace', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { name: 'New Workspace', slug: 'new-workspace' };
      const mockWorkspace: Workspace = {
        publicId: 'ws-new',
        name: 'New Workspace',
        slug: 'new-workspace',
        showEmailsToMembers: false,
        weekStartDay: 'monday',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockWorkspace), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await workspaceCreateTool.handler(client, input);

      expect(receivedMethod).toBe('POST');
      expect(receivedUrl).toContain('/workspaces');
      expect(JSON.parse(receivedBody)).toEqual(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockWorkspace);
      }
    });

    test('returns error when name is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await workspaceCreateTool.handler(client, { slug: 'test' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('name');
      }
    });

    test('returns error when slug is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await workspaceCreateTool.handler(client, { name: 'Test' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('slug');
      }
    });
  });

  describe('workspace.getById', () => {
    test('returns workspace by public ID', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'ws-123' };
      const mockWorkspace: Workspace = {
        publicId: 'ws-123',
        name: 'Test Workspace',
        slug: 'test-workspace',
        showEmailsToMembers: false,
        weekStartDay: 'monday',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      globalThis.fetch = async () =>
        new Response(JSON.stringify(mockWorkspace), {
          status: 200,
          ok: true,
        }) as Response;

      const result = await workspaceGetByIdTool.handler(client, input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockWorkspace);
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await workspaceGetByIdTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('workspace.getBySlug', () => {
    test('returns workspace by slug', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { slug: 'my-workspace' };
      const mockWorkspace: Workspace = {
        publicId: 'ws-456',
        name: 'My Workspace',
        slug: 'my-workspace',
        showEmailsToMembers: true,
        weekStartDay: 'sunday',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      globalThis.fetch = async () =>
        new Response(JSON.stringify(mockWorkspace), {
          status: 200,
          ok: true,
        }) as Response;

      const result = await workspaceGetBySlugTool.handler(client, input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockWorkspace);
      }
    });

    test('returns error when slug is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await workspaceGetBySlugTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('slug');
      }
    });
  });

  describe('workspace.update', () => {
    test('updates a workspace', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'ws-123', name: 'Updated Name' };
      const mockWorkspace: Workspace = {
        publicId: 'ws-123',
        name: 'Updated Name',
        slug: 'test-workspace',
        showEmailsToMembers: false,
        weekStartDay: 'monday',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify(mockWorkspace), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await workspaceUpdateTool.handler(client, input);

      expect(receivedMethod).toBe('PATCH');
      expect(receivedUrl).toContain('/workspaces/ws-123');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('Updated Name');
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await workspaceUpdateTool.handler(client, { name: 'Test' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('workspace.delete', () => {
    test('deletes a workspace', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'ws-123' };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await workspaceDeleteTool.handler(client, input);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toContain('/workspaces/ws-123');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ success: true });
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await workspaceDeleteTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('workspace.search', () => {
    test('searches boards and cards', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { query: 'test' };
      const mockResponse = {
        boards: [
          {
            publicId: 'board-1',
            workspacePublicId: 'ws-1',
            name: 'Test Board',
            slug: 'test-board',
            visibility: 'public' as const,
            type: 'regular' as const,
            isArchived: false,
            favorite: false,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        cards: [
          {
            publicId: 'card-1',
            listPublicId: 'list-1',
            title: 'Test Card',
            index: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      globalThis.fetch = async () =>
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          ok: true,
        }) as Response;

      const result = await workspaceSearchTool.handler(client, input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.boards).toHaveLength(1);
        expect(result.data.cards).toHaveLength(1);
      }
    });

    test('returns error when query is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await workspaceSearchTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('query');
      }
    });
  });

  describe('workspace.checkSlugAvailability', () => {
    test('returns availability status', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { slug: 'my-workspace' };
      const mockResponse = { available: true };

      globalThis.fetch = async () =>
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          ok: true,
        }) as Response;

      const result = await workspaceCheckSlugAvailabilityTool.handler(client, input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.available).toBe(true);
      }
    });

    test('returns error when slug is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await workspaceCheckSlugAvailabilityTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('slug');
      }
    });
  });
});
