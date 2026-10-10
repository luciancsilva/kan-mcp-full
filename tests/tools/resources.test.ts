import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { KanClient } from '../../src/client.js';
import { resourceList, handleResource } from '../../src/tools/resources.js';

const TEST_API_KEY = 'test-api-key';
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('resources', () => {
  describe('kan://stats', () => {
    test('returns stats data', async () => {
      const client = new KanClient(TEST_API_KEY);
      const mockStats = {
        users: 10,
        workspaces: 5,
        boards: 20,
        cards: 100,
        cardComments: 50,
        cardAttachments: 30,
        cardActivityLogs: 200,
        labels: 15,
        checklists: 25,
        checklistItems: 100,
        activeMembers: 8,
        activeInviteLinks: 3,
        imports: 2
      };

      globalThis.fetch = async () =>
        new Response(JSON.stringify(mockStats), { status: 200, ok: true }) as Response;

      const result = await handleResource('kan://stats', client);
      expect(result.contents[0].text).toContain('"users":10');
    });
  });

  describe('kan://board/{id}', () => {
    test('returns board data', async () => {
      const client = new KanClient(TEST_API_KEY);
      const mockBoard = { publicId: 'board-1', name: 'Test Board', slug: 'test-board' };

      globalThis.fetch = async () =>
        new Response(JSON.stringify(mockBoard), { status: 200, ok: true }) as Response;

      const result = await handleResource('kan://board/board-1', client);
      expect(result.contents[0].text).toContain('"name":"Test Board"');
    });

    test('throws for unknown resource', async () => {
      const client = new KanClient(TEST_API_KEY);

      globalThis.fetch = async () =>
        new Response(JSON.stringify({}), { status: 200, ok: true }) as Response;

      expect(() => handleResource('kan://unknown', client)).toThrow('Unknown resource URI');
    });
  });

  describe('resourceList', () => {
    test('has correct entries', () => {
      expect(resourceList.find(r => r.uri === 'kan://stats')).toBeDefined();
      expect(resourceList.find(r => r.uri === 'kan://board/{boardPublicId}')).toBeDefined();
      expect(resourceList.find(r => r.uri === 'kan://workspace/{workspaceSlug}/board/{boardSlug}')).toBeDefined();
    });

    test('stats resource has correct mimeType', () => {
      const statsResource = resourceList.find(r => r.uri === 'kan://stats');
      expect(statsResource?.mimeType).toBe('application/json');
    });
  });
});