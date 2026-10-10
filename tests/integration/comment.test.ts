import { describe, test, expect, beforeAll } from 'bun:test';
import { config } from 'dotenv';
import { KanClient } from '../../src/client';

config({ path: '.env' });

const TEST_API_KEY = process.env.KAN_API_KEY || 'test-api-key';
const TEST_BASE_URL = process.env.KAN_API_BASE_URL || 'https://kan.bn/api/v1';

describe('Comment Integration Tests', () => {
  let client: KanClient;
  let workspaceId: string | null = null;
  let cardId: string | null = null;

  beforeAll(async () => {
    if (!process.env.KAN_API_KEY) {
      console.log('KAN_API_KEY not set, skipping integration tests');
      return;
    }
    client = new KanClient(TEST_API_KEY, TEST_BASE_URL);

    const workspaces = await client.request<any[]>('/workspaces');
    workspaceId = workspaces[0]?.workspace?.publicId;

    if (workspaceId) {
      const boards = await client.request<any[]>(`/workspaces/${workspaceId}/boards`);
      const board = boards[0];
      if (board?.lists?.length > 0) {
        const listId = board.lists[0].publicId;
        const card = await client.request<any>('/cards', {
          method: 'POST',
          body: JSON.stringify({
            title: `Comment Test ${Date.now()}`,
            description: 'Test',
            listPublicId: listId,
            labelPublicIds: [],
            memberPublicIds: [],
            position: 'start'
          })
        });
        cardId = card.publicId;
      }
    }
  });

  describe('comment operations', () => {
    test('should add comment to card', async () => {
      if (!client || !cardId) {
        expect(true).toBe(true);
        return;
      }

      const comment = await client.request<any>(`/cards/${cardId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          comment: 'Test comment'
        })
      });

      expect(comment.publicId).toBeDefined();
    });
  });
});
