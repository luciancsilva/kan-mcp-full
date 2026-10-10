import { describe, test, expect, beforeAll } from 'bun:test';
import { config } from 'dotenv';
import { KanClient } from '../../src/client';

config({ path: '.env' });

const TEST_API_KEY = process.env.KAN_API_KEY || 'test-api-key';
const TEST_BASE_URL = process.env.KAN_API_BASE_URL || 'https://kan.bn/api/v1';

describe('Workspace Integration Tests', () => {
  let client: KanClient;
  let testSlug = `test-${Date.now()}`;

  beforeAll(async () => {
    if (!process.env.KAN_API_KEY) {
      console.log('KAN_API_KEY not set, skipping integration tests');
      return;
    }
    client = new KanClient(TEST_API_KEY, TEST_BASE_URL);
  });

  describe('workspace.list', () => {
    test('should list all workspaces', async () => {
      if (!client) {
        expect(true).toBe(true);
        return;
      }
      const response = await client.request<any[]>('/workspaces');
      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBeGreaterThan(0);
      expect(response[0].workspace).toBeDefined();
    });
  });
});
