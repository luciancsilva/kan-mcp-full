import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { KanClient } from '../../src/client';
import { serverHealthTool } from '../../src/tools/server';

const TEST_API_KEY = 'test-api-key';

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('server.health', () => {
  test('returns ok status when API is reachable', async () => {
    const client = new KanClient(TEST_API_KEY, undefined, 5000, 0);

    globalThis.fetch = async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        ok: true,
      }) as Response;

    const result = await serverHealthTool.handler(client, {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('ok');
      expect(result.data.apiReachable).toBe(true);
      expect(result.data.version).toBe('0.1.0');
      expect(result.data.timestamp).toBeTruthy();
    }
  });

  test('returns unhealthy status when API fails', async () => {
    const client = new KanClient(TEST_API_KEY, undefined, 5000, 0);

    globalThis.fetch = async () => {
      throw new Error('Connection refused');
    };

    const result = await serverHealthTool.handler(client, {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('unhealthy');
      expect(result.data.apiReachable).toBe(false);
      expect(result.data.error).toBe('Connection refused');
    }
  });

  test('returns degraded status when API is slow', async () => {
    const client = new KanClient(TEST_API_KEY, undefined, 5000, 0);

    globalThis.fetch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return new Response(JSON.stringify([]), {
        status: 200,
        ok: true,
      }) as Response;
    };

    const result = await serverHealthTool.handler(client, {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('degraded');
      expect(result.data.apiReachable).toBe(true);
      expect(result.data.apiLatencyMs).toBeGreaterThan(2000);
    }
  });

  test('returns unhealthy when API returns error', async () => {
    const client = new KanClient(TEST_API_KEY, undefined, 5000, 0);

    globalThis.fetch = async () =>
      new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
        ok: false,
      }) as Response;

    const result = await serverHealthTool.handler(client, {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('unhealthy');
      expect(result.data.apiReachable).toBe(false);
    }
  });
});