import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { KanClient } from '../../src/client';
import { Label } from '../../src/types';
import {
  labelCreateTool,
  labelGetByIdTool,
  labelUpdateTool,
  labelDeleteTool,
} from '../../src/tools/label';

const TEST_API_KEY = 'test-api-key';
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockLabel: Label = {
  publicId: 'label-1',
  boardPublicId: 'board-1',
  name: 'Test Label',
  colourCode: '#FF5733',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('label tools', () => {
  describe('label.create', () => {
    test('creates a label', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        boardPublicId: 'board-1',
        name: 'New Label',
        colourCode: '#FF5733',
      };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockLabel), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await labelCreateTool.handler(client, input);

      expect(receivedMethod).toBe('POST');
      expect(receivedUrl).toContain('/labels');
      expect(JSON.parse(receivedBody)).toEqual(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockLabel);
      }
    });

    test('returns error when boardPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await labelCreateTool.handler(client, {
        name: 'Test',
        colourCode: '#FF5733',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('boardPublicId');
      }
    });

    test('returns error when name is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await labelCreateTool.handler(client, {
        boardPublicId: 'board-1',
        colourCode: '#FF5733',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('name');
      }
    });

    test('returns error when colourCode is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await labelCreateTool.handler(client, {
        boardPublicId: 'board-1',
        name: 'Test',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('colourCode');
      }
    });
  });

  describe('label.getById', () => {
    test('gets a label by publicId', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'label-1' };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify(mockLabel), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await labelGetByIdTool.handler(client, input);

      expect(receivedMethod).toBe('GET');
      expect(receivedUrl).toContain('/labels/label-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockLabel);
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await labelGetByIdTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('label.update', () => {
    test('updates a label name', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'label-1', name: 'Updated Label' };
      const updatedLabel = { ...mockLabel, name: 'Updated Label' };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedLabel), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await labelUpdateTool.handler(client, input);

      expect(receivedMethod).toBe('PATCH');
      expect(receivedUrl).toContain('/labels/label-1');
      expect(JSON.parse(receivedBody)).toEqual({ name: 'Updated Label' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('Updated Label');
      }
    });

    test('updates label colourCode', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'label-1', colourCode: '#00FF00' };
      const updatedLabel = { ...mockLabel, colourCode: '#00FF00' };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedLabel), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await labelUpdateTool.handler(client, input);

      expect(JSON.parse(receivedBody)).toEqual({ colourCode: '#00FF00' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.colourCode).toBe('#00FF00');
      }
    });

    test('updates multiple fields at once', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'label-1', name: 'New Name', colourCode: '#0000FF' };
      const updatedLabel = { ...mockLabel, name: 'New Name', colourCode: '#0000FF' };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedLabel), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await labelUpdateTool.handler(client, input);

      expect(JSON.parse(receivedBody)).toEqual({ name: 'New Name', colourCode: '#0000FF' });
      expect(result.ok).toBe(true);
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await labelUpdateTool.handler(client, { name: 'Test' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('label.delete', () => {
    test('deletes a label', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'label-1' };

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

      const result = await labelDeleteTool.handler(client, input);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toContain('/labels/label-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ success: true });
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await labelDeleteTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });
});
