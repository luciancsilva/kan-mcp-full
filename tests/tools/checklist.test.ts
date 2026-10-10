import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { KanClient } from '../../src/client';
import { Checklist, ChecklistItem } from '../../src/types';
import {
  checklistCreateTool,
  checklistUpdateTool,
  checklistDeleteTool,
  checklistAddItemTool,
  checklistUpdateItemTool,
  checklistDeleteItemTool,
} from '../../src/tools/checklist';

const TEST_API_KEY = 'test-api-key';
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockChecklist: Checklist = {
  publicId: 'checklist-1',
  cardPublicId: 'card-1',
  name: 'Test Checklist',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockChecklistItem: ChecklistItem = {
  publicId: 'checklist-item-1',
  checklistPublicId: 'checklist-1',
  title: 'Test Item',
  completed: false,
  index: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('checklist tools', () => {
  describe('checklist.create', () => {
    test('creates a checklist', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        cardPublicId: 'card-1',
        name: 'New Checklist',
      };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockChecklist), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await checklistCreateTool.handler(client, input);

      expect(receivedMethod).toBe('POST');
      expect(receivedUrl).toContain('/cards/card-1/checklists');
      expect(JSON.parse(receivedBody)).toEqual({ name: 'New Checklist' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockChecklist);
      }
    });

    test('returns error when cardPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await checklistCreateTool.handler(client, {
        name: 'Test',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('cardPublicId');
      }
    });

    test('returns error when name is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await checklistCreateTool.handler(client, {
        cardPublicId: 'card-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('name');
      }
    });
  });

  describe('checklist.update', () => {
    test('updates a checklist name', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'checklist-1', name: 'Updated Checklist' };
      const updatedChecklist = { ...mockChecklist, name: 'Updated Checklist' };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedChecklist), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await checklistUpdateTool.handler(client, input);

      expect(receivedMethod).toBe('PUT');
      expect(receivedUrl).toContain('/checklists/checklist-1');
      expect(JSON.parse(receivedBody)).toEqual({ name: 'Updated Checklist' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('Updated Checklist');
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await checklistUpdateTool.handler(client, { name: 'Test' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('checklist.delete', () => {
    test('deletes a checklist', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'checklist-1' };

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

      const result = await checklistDeleteTool.handler(client, input);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toContain('/checklists/checklist-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ success: true });
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await checklistDeleteTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('checklist.addItem', () => {
    test('adds an item to a checklist', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        checklistPublicId: 'checklist-1',
        title: 'New Item',
      };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockChecklistItem), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await checklistAddItemTool.handler(client, input);

      expect(receivedMethod).toBe('POST');
      expect(receivedUrl).toContain('/checklists/checklist-1/items');
      expect(JSON.parse(receivedBody)).toEqual({ title: 'New Item' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockChecklistItem);
      }
    });

    test('returns error when checklistPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await checklistAddItemTool.handler(client, {
        title: 'Test',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('checklistPublicId');
      }
    });

    test('returns error when title is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await checklistAddItemTool.handler(client, {
        checklistPublicId: 'checklist-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('title');
      }
    });
  });

  describe('checklist.updateItem', () => {
    test('updates a checklist item title', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'checklist-item-1', title: 'Updated Item' };
      const updatedItem = { ...mockChecklistItem, title: 'Updated Item' };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedItem), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await checklistUpdateItemTool.handler(client, input);

      expect(receivedMethod).toBe('PATCH');
      expect(receivedUrl).toContain('/checklists/items/checklist-item-1');
      expect(JSON.parse(receivedBody)).toEqual({ title: 'Updated Item' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.title).toBe('Updated Item');
      }
    });

    test('updates a checklist item completed status', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'checklist-item-1', completed: true };
      const updatedItem = { ...mockChecklistItem, completed: true };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedItem), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await checklistUpdateItemTool.handler(client, input);

      expect(JSON.parse(receivedBody)).toEqual({ completed: true });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.completed).toBe(true);
      }
    });

    test('updates multiple fields at once', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'checklist-item-1', title: 'New Title', completed: true };
      const updatedItem = { ...mockChecklistItem, title: 'New Title', completed: true };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedItem), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await checklistUpdateItemTool.handler(client, input);

      expect(JSON.parse(receivedBody)).toEqual({ title: 'New Title', completed: true });
      expect(result.ok).toBe(true);
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await checklistUpdateItemTool.handler(client, { title: 'Test' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('checklist.deleteItem', () => {
    test('deletes a checklist item', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'checklist-item-1' };

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

      const result = await checklistDeleteItemTool.handler(client, input);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toContain('/checklists/items/checklist-item-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ success: true });
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await checklistDeleteItemTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });
});
