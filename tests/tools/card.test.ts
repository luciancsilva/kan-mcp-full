import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { KanClient } from '../../src/client';
import { Card } from '../../src/types';
import {
  cardCreateTool,
  cardGetByIdTool,
  cardUpdateTool,
  cardDeleteTool,
  cardAddLabelTool,
  cardRemoveLabelTool,
  cardAddMemberTool,
  cardRemoveMemberTool,
  cardListActivitiesTool,
} from '../../src/tools/card';

const TEST_API_KEY = 'test-api-key';
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockCard: Card = {
  publicId: 'card-1',
  listPublicId: 'list-1',
  title: 'Test Card',
  description: 'Test description',
  index: 0,
  dueDate: '2024-12-31T23:59:59Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockActivities = [
  {
    publicId: 'activity-1',
    cardPublicId: 'card-1',
    memberPublicId: 'member-1',
    action: 'created',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    publicId: 'activity-2',
    cardPublicId: 'card-1',
    memberPublicId: 'member-1',
    action: 'updated',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

describe('card tools', () => {
  describe('card.create', () => {
    test('creates a card', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        listPublicId: 'list-1',
        title: 'New Card',
        description: 'New description',
        dueDate: '2024-12-31T23:59:59Z',
      };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockCard), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await cardCreateTool.handler(client, input);

      expect(receivedMethod).toBe('POST');
      expect(receivedUrl).toContain('/cards');
      expect(JSON.parse(receivedBody)).toEqual({
        listPublicId: 'list-1',
        title: 'New Card',
        description: 'New description',
        dueDate: '2024-12-31T23:59:59Z',
        labelPublicIds: [],
        memberPublicIds: [],
        position: 'start',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockCard);
      }
    });

    test('creates a card without optional fields', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        listPublicId: 'list-1',
        title: 'New Card',
      };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockCard), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await cardCreateTool.handler(client, input);

      const body = JSON.parse(receivedBody);
      expect(body.listPublicId).toBe('list-1');
      expect(body.title).toBe('New Card');
      expect(body.description).toBe('');
      expect(body.dueDate).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    test('returns error when listPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardCreateTool.handler(client, {
        title: 'Test',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('listPublicId');
      }
    });

    test('returns error when title is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardCreateTool.handler(client, {
        listPublicId: 'list-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('title');
      }
    });
  });

  describe('card.getById', () => {
    test('gets a card by publicId', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'card-1' };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify(mockCard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await cardGetByIdTool.handler(client, input);

      expect(receivedMethod).toBe('GET');
      expect(receivedUrl).toContain('/cards/card-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockCard);
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardGetByIdTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('card.update', () => {
    test('updates a card title', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'card-1', title: 'Updated Card' };
      const updatedCard = { ...mockCard, title: 'Updated Card' };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedCard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await cardUpdateTool.handler(client, input);

      expect(receivedMethod).toBe('PUT');
      expect(receivedUrl).toContain('/cards/card-1');
      expect(JSON.parse(receivedBody)).toEqual({ title: 'Updated Card' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.title).toBe('Updated Card');
      }
    });

    test('updates card description', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'card-1', description: 'Updated description' };
      const updatedCard = { ...mockCard, description: 'Updated description' };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedCard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await cardUpdateTool.handler(client, input);

      expect(JSON.parse(receivedBody)).toEqual({ description: 'Updated description' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.description).toBe('Updated description');
      }
    });

    test('updates card dueDate', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'card-1', dueDate: '2025-01-15T12:00:00Z' };
      const updatedCard = { ...mockCard, dueDate: '2025-01-15T12:00:00Z' };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedCard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await cardUpdateTool.handler(client, input);

      expect(JSON.parse(receivedBody)).toEqual({ dueDate: '2025-01-15T12:00:00Z' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.dueDate).toBe('2025-01-15T12:00:00Z');
      }
    });

    test('updates card index', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'card-1', index: 5 };
      const updatedCard = { ...mockCard, index: 5 };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedCard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await cardUpdateTool.handler(client, input);

      expect(JSON.parse(receivedBody)).toEqual({ index: 5 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.index).toBe(5);
      }
    });

    test('updates multiple fields at once', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'card-1', title: 'New Title', description: 'New desc', index: 3 };
      const updatedCard = { ...mockCard, title: 'New Title', description: 'New desc', index: 3 };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedCard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await cardUpdateTool.handler(client, input);

      expect(JSON.parse(receivedBody)).toEqual({ title: 'New Title', description: 'New desc', index: 3 });
      expect(result.ok).toBe(true);
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardUpdateTool.handler(client, { title: 'Test' } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('card.delete', () => {
    test('deletes a card', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { publicId: 'card-1' };

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

      const result = await cardDeleteTool.handler(client, input);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toContain('/cards/card-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ success: true });
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardDeleteTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('card.addLabel', () => {
    test('adds a label to a card', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { cardPublicId: 'card-1', labelPublicId: 'label-1' };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify(mockCard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await cardAddLabelTool.handler(client, input);

      expect(receivedMethod).toBe('PUT');
      expect(receivedUrl).toContain('/cards/card-1/labels/label-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockCard);
      }
    });

    test('returns error when cardPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardAddLabelTool.handler(client, {
        labelPublicId: 'label-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('cardPublicId');
      }
    });

    test('returns error when labelPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardAddLabelTool.handler(client, {
        cardPublicId: 'card-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('labelPublicId');
      }
    });
  });

  describe('card.removeLabel', () => {
    test('removes a label from a card', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { cardPublicId: 'card-1', labelPublicId: 'label-1' };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify(mockCard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await cardRemoveLabelTool.handler(client, input);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toContain('/cards/card-1/labels/label-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockCard);
      }
    });

    test('returns error when cardPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardRemoveLabelTool.handler(client, {
        labelPublicId: 'label-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('cardPublicId');
      }
    });

    test('returns error when labelPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardRemoveLabelTool.handler(client, {
        cardPublicId: 'card-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('labelPublicId');
      }
    });
  });

  describe('card.addMember', () => {
    test('adds a member to a card', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { cardPublicId: 'card-1', memberPublicId: 'member-1' };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify(mockCard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await cardAddMemberTool.handler(client, input);

      expect(receivedMethod).toBe('PUT');
      expect(receivedUrl).toContain('/cards/card-1/members/member-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockCard);
      }
    });

    test('returns error when cardPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardAddMemberTool.handler(client, {
        memberPublicId: 'member-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('cardPublicId');
      }
    });

    test('returns error when memberPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardAddMemberTool.handler(client, {
        cardPublicId: 'card-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('memberPublicId');
      }
    });
  });

  describe('card.removeMember', () => {
    test('removes a member from a card', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { cardPublicId: 'card-1', memberPublicId: 'member-1' };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify(mockCard), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await cardRemoveMemberTool.handler(client, input);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toContain('/cards/card-1/members/member-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockCard);
      }
    });

    test('returns error when cardPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardRemoveMemberTool.handler(client, {
        memberPublicId: 'member-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('cardPublicId');
      }
    });

    test('returns error when memberPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardRemoveMemberTool.handler(client, {
        cardPublicId: 'card-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('memberPublicId');
      }
    });
  });

  describe('card.listActivities', () => {
    test('lists card activities', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { cardPublicId: 'card-1' };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify({ activities: mockActivities, hasMore: false, nextCursor: null }), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await cardListActivitiesTool.handler(client, input);

      expect(receivedMethod).toBe('GET');
      expect(receivedUrl).toContain('/cards/card-1/activities');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.activities).toEqual(mockActivities);
      }
    });

    test('passes limit parameter', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { cardPublicId: 'card-1', limit: 50 };
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify({ activities: [], hasMore: false, nextCursor: null }), {
          status: 200, ok: true,
        }) as Response;
      };

      await cardListActivitiesTool.handler(client, input);
      expect(receivedUrl).toContain('limit=50');
    });

    test('passes cursor parameter', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { cardPublicId: 'card-1', cursor: '2024-01-01T00:00:00Z' };
      let receivedUrl = '';

      globalThis.fetch = async (url) => {
        receivedUrl = url as string;
        return new Response(JSON.stringify({ activities: [], hasMore: true, nextCursor: '2024-01-02T00:00:00Z' }), {
          status: 200, ok: true,
        }) as Response;
      };

      await cardListActivitiesTool.handler(client, input);
      expect(receivedUrl).toContain('cursor=2024-01-01T00%3A00%3A00Z');
    });

    test('returns error when cardPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await cardListActivitiesTool.handler(client, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('cardPublicId');
      }
    });
  });
});
