import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { KanClient } from '../../src/client';
import { List } from '../../src/types';
import {
  listCreateTool,
  listUpdateTool,
  listDeleteTool,
} from '../../src/tools/list';

const TEST_API_KEY = 'test-api-key';
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockList: List = {
  publicId: 'list-1',
  boardPublicId: 'board-1',
  name: 'Test List',
  index: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('list tools', () => {
  describe('list.create', () => {
    test('creates a list', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        boardPublicId: 'board-1',
        name: 'New List',
      };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockList), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await listCreateTool.handler(client, input);

      expect(receivedMethod).toBe('POST');
      expect(receivedUrl).toContain('/lists');
      expect(JSON.parse(receivedBody)).toEqual(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockList);
      }
    });

    test('returns error when boardPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await listCreateTool.handler(client, {
        name: 'Test',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('boardPublicId');
      }
    });

    test('returns error when name is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await listCreateTool.handler(client, {
        boardPublicId: 'board-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('name');
      }
    });
  });

  describe('list.update', () => {
    test('updates a list name', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'list-1', name: 'Updated List' };
      const updatedList = { ...mockList, name: 'Updated List' };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify(updatedList), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await listUpdateTool.handler(client, input);

      expect(receivedMethod).toBe('PATCH');
      expect(receivedUrl).toContain('/lists/list-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('Updated List');
      }
    });

    test('updates list index', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'list-1', index: 5 };
      const updatedList = { ...mockList, index: 5 };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedList), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await listUpdateTool.handler(client, input);

      expect(JSON.parse(receivedBody)).toEqual({ index: 5 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.index).toBe(5);
      }
    });

    test('updates both name and index', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'list-1', name: 'Updated', index: 3 };
      const updatedList = { ...mockList, name: 'Updated', index: 3 };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedList), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await listUpdateTool.handler(client, input);

      expect(JSON.parse(receivedBody)).toEqual({ name: 'Updated', index: 3 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('Updated');
        expect(result.data.index).toBe(3);
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await listUpdateTool.handler(client, { name: 'Test' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('list.delete', () => {
    test('deletes a list', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'list-1' };

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

      const result = await listDeleteTool.handler(client, input);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toContain('/lists/list-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ success: true });
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await listDeleteTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });
});
