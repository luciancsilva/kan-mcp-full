import { describe, test, expect, beforeAll } from 'bun:test';
import { config } from 'dotenv';
import { KanClient } from '../../src/client';

config({ path: '.env' });

const TEST_API_KEY = process.env.KAN_API_KEY || 'test-api-key';
const TEST_BASE_URL = process.env.KAN_API_BASE_URL || 'https://kan.bn/api/v1';

describe('Board Integration Tests', () => {
  let client: KanClient;
  let workspaceId: string | null = null;

  beforeAll(async () => {
    if (!process.env.KAN_API_KEY) {
      console.log('KAN_API_KEY not set, skipping integration tests');
      return;
    }
    client = new KanClient(TEST_API_KEY, TEST_BASE_URL);

    const workspaces = await client.request<any[]>('/workspaces');
    workspaceId = workspaces[0]?.workspace?.publicId;
  });

  describe('board.list', () => {
    test('should list boards in workspace', async () => {
      if (!client || !workspaceId) {
        expect(true).toBe(true);
        return;
      }

      const boards = await client.request<any[]>(`/workspaces/${workspaceId}/boards`);
      expect(Array.isArray(boards)).toBe(true);
    });
  });

  describe('board.getById', () => {
    test('should get board by ID (requires existing board)', async () => {
      if (!client || !workspaceId) {
        expect(true).toBe(true);
        return;
      }

      const boards = await client.request<any[]>(`/workspaces/${workspaceId}/boards`);
      
      if (boards.length === 0) {
        console.log('Skipping: No boards exist in workspace');
        expect(true).toBe(true);
        return;
      }

      const firstBoard = boards[0];
      const board = await client.request<any>(`/boards/${firstBoard.publicId}`);
      expect(board.publicId).toBe(firstBoard.publicId);
    });
  });
});
