import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { KanClient } from '../../src/client';
import { Board, ToolResult } from '../../src/types';
import {
  boardListTool,
  boardCreateTool,
  boardGetByIdTool,
  boardGetBySlugTool,
  boardUpdateTool,
  boardDeleteTool,
  boardCheckSlugAvailabilityTool,
} from '../../src/tools/board';

const TEST_API_KEY = 'test-api-key';
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockBoard: Board = {
  publicId: 'board-1',
  workspacePublicId: 'ws-1',
  name: 'Test Board',
  slug: 'test-board',
  visibility: 'public',
  type: 'regular',
  isArchived: false,
  favorite: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('board tools', () => {
  describe('board.list', () => {
    test('returns list of boards', async () => {
      const client = new KanClient(TEST_API_KEY);
      const mockBoards: Board[] = [mockBoard];

      globalThis.fetch = async () =>
        new Response(JSON.stringify(mockBoards), {
          status: 200,
          ok: true,
        }) as Response;

      const result = await boardListTool.handler(client, {});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockBoards);
      }
    });

    test('returns boards filtered by workspacePublicId', async () => {
      const client = new KanClient(TEST_API_KEY);
      const mockBoards: Board[] = [mockBoard];
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify(mockBoards), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await boardListTool.handler(client, { workspacePublicId: 'ws-1' });

      expect(receivedUrl).toContain('workspacePublicId=ws-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockBoards);
      }
    });

    test('returns boards filtered by visibility', async () => {
      const client = new KanClient(TEST_API_KEY);
      const mockBoards: Board[] = [mockBoard];
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify(mockBoards), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await boardListTool.handler(client, { visibility: 'public' });

      expect(receivedUrl).toContain('visibility=public');
      expect(result.ok).toBe(true);
    });

    test('returns error on API failure', async () => {
      const client = new KanClient(TEST_API_KEY, undefined, 5000, 0);

      globalThis.fetch = async () =>
        new Response(null, {
          status: 500,
          statusText: 'Internal Server Error',
          ok: false,
        }) as Response;

      const result = await boardListTool.handler(client, {});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe('board.create', () => {
    test('creates a board', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        workspacePublicId: 'ws-1',
        name: 'New Board',
        slug: 'new-board',
        visibility: 'public' as const,
      };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockBoard), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await boardCreateTool.handler(client, input);

      expect(receivedMethod).toBe('POST');
      expect(receivedUrl).toContain('/boards');
      expect(JSON.parse(receivedBody)).toEqual(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockBoard);
      }
    });

    test('returns error when workspacePublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await boardCreateTool.handler(client, {
        name: 'Test',
        slug: 'test',
        visibility: 'public',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('workspacePublicId');
      }
    });

    test('returns error when name is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await boardCreateTool.handler(client, {
        workspacePublicId: 'ws-1',
        slug: 'test',
        visibility: 'public',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('name');
      }
    });

    test('returns error when slug is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await boardCreateTool.handler(client, {
        workspacePublicId: 'ws-1',
        name: 'Test',
        visibility: 'public',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('slug');
      }
    });

    test('returns error when visibility is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await boardCreateTool.handler(client, {
        workspacePublicId: 'ws-1',
        name: 'Test',
        slug: 'test',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('visibility');
      }
    });
  });

  describe('board.getById', () => {
    test('returns board by public ID', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'board-1' };

      globalThis.fetch = async () =>
        new Response(JSON.stringify(mockBoard), {
          status: 200,
          ok: true,
        }) as Response;

      const result = await boardGetByIdTool.handler(client, input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockBoard);
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await boardGetByIdTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });

    test('passes dueDateFilters to API', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'board-1', dueDateFilters: ['overdue', 'today'] };
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify(mockBoard), { status: 200, ok: true }) as Response;
      };

      await boardGetByIdTool.handler(client, input);
      expect(decodeURIComponent(receivedUrl)).toContain('dueDateFilters=overdue,today');
    });

    test('passes members filter to API', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'board-1', members: ['user-1', 'user-2'] };
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify(mockBoard), { status: 200, ok: true }) as Response;
      };

      await boardGetByIdTool.handler(client, input);
      expect(decodeURIComponent(receivedUrl)).toContain('members=user-1,user-2');
    });

    test('passes labels filter to API', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'board-1', labels: ['label-1', 'label-2'] };
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify(mockBoard), { status: 200, ok: true }) as Response;
      };

      await boardGetByIdTool.handler(client, input);
      expect(decodeURIComponent(receivedUrl)).toContain('labels=label-1,label-2');
    });

    test('passes lists filter to API', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'board-1', lists: ['list-1', 'list-2'] };
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify(mockBoard), { status: 200, ok: true }) as Response;
      };

      await boardGetByIdTool.handler(client, input);
      expect(decodeURIComponent(receivedUrl)).toContain('lists=list-1,list-2');
    });

    test('passes type filter to API', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'board-1', type: 'template' as const };
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify(mockBoard), { status: 200, ok: true }) as Response;
      };

      await boardGetByIdTool.handler(client, input);
      expect(receivedUrl).toContain('type=template');
    });
  });

  describe('board.getBySlug', () => {
    test('returns board by slug', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { workspacePublicId: 'ws-1', slug: 'test-board' };
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify(mockBoard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await boardGetBySlugTool.handler(client, input);

      expect(receivedUrl).toContain('workspacePublicId=ws-1');
      expect(receivedUrl).toContain('slug=test-board');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockBoard);
      }
    });

    test('passes dueDateFilters to API', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { workspacePublicId: 'ws-1', slug: 'test-board', dueDateFilters: ['overdue'] };
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify(mockBoard), { status: 200, ok: true }) as Response;
      };

      await boardGetBySlugTool.handler(client, input);
      expect(decodeURIComponent(receivedUrl)).toContain('dueDateFilters=overdue');
    });

    test('passes members filter to API', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { workspacePublicId: 'ws-1', slug: 'test-board', members: ['user-1'] };
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify(mockBoard), { status: 200, ok: true }) as Response;
      };

      await boardGetBySlugTool.handler(client, input);
      expect(decodeURIComponent(receivedUrl)).toContain('members=user-1');
    });

    test('returns error when workspacePublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await boardGetBySlugTool.handler(client, { slug: 'test' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('workspacePublicId');
      }
    });

    test('returns error when slug is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await boardGetBySlugTool.handler(client, { workspacePublicId: 'ws-1' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('slug');
      }
    });
  });

  describe('board.update', () => {
    test('updates a board', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'board-1', name: 'Updated Name' };
      const updatedBoard = { ...mockBoard, name: 'Updated Name' };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify(updatedBoard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await boardUpdateTool.handler(client, input);

      expect(receivedMethod).toBe('PATCH');
      expect(receivedUrl).toContain('/boards/board-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('Updated Name');
      }
    });

    test('updates board visibility', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'board-1', visibility: 'private' as const };
      const updatedBoard = { ...mockBoard, visibility: 'private' as const };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedBoard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await boardUpdateTool.handler(client, input);

      expect(JSON.parse(receivedBody)).toEqual({ visibility: 'private' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.visibility).toBe('private');
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await boardUpdateTool.handler(client, { name: 'Test' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('board.delete', () => {
    test('deletes a board', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'board-1' };

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

      const result = await boardDeleteTool.handler(client, input);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toContain('/boards/board-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ success: true });
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await boardDeleteTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('board.checkSlugAvailability', () => {
    test('returns availability status', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { workspacePublicId: 'ws-1', slug: 'my-board' };
      const mockResponse = { available: true };
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await boardCheckSlugAvailabilityTool.handler(client, input);

      expect(receivedUrl).toContain('workspacePublicId=ws-1');
      expect(receivedUrl).toContain('slug=my-board');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.available).toBe(true);
      }
    });

    test('returns unavailable status', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { workspacePublicId: 'ws-1', slug: 'taken-board' };
      const mockResponse = { available: false };

      globalThis.fetch = async () =>
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          ok: true,
        }) as Response;

      const result = await boardCheckSlugAvailabilityTool.handler(client, input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.available).toBe(false);
      }
    });

    test('returns error when workspacePublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await boardCheckSlugAvailabilityTool.handler(client, { slug: 'test' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('workspacePublicId');
      }
    });

    test('returns error when slug is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await boardCheckSlugAvailabilityTool.handler(client, {
        workspacePublicId: 'ws-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('slug');
      }
    });
  });
});
