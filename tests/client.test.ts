import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { KanClient } from '../src/client';
import { KanApiError } from '../src/errors';

const TEST_API_KEY = 'test-api-key';
const TEST_BASE_URL = 'https://kan.bn/api/v1';

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('KanClient', () => {
  describe('request', () => {
    test('successful request returns parsed JSON', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 0);
      const mockData = { id: '123', name: 'Test' };

      globalThis.fetch = async () =>
        new Response(JSON.stringify(mockData), {
          status: 200,
          ok: true,
        }) as Response;

      const result = await client.request<typeof mockData>('/test');

      expect(result).toEqual(mockData);
    });

    test('request with custom options passes correct method and body', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 0);
      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify({}), {
          status: 200,
          ok: true,
        }) as Response;
      };

      await client.request('/test', {
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
      });

      expect(receivedUrl).toBe(`${TEST_BASE_URL}/test`);
      expect(receivedMethod).toBe('POST');
    });

    test('throws KanApiError on 400 response', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 0);

      globalThis.fetch = async () =>
        new Response(null, {
          status: 400,
          statusText: 'Bad Request',
          ok: false,
        }) as Response;

      try {
        await client.request('/test');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.constructor.name).toBe('KanApiError');
        expect(err.status).toBe(400);
        expect(err.code).toBe('invalidInput');
      }
    });

    test('throws KanApiError on 401 response', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 0);

      globalThis.fetch = async () =>
        new Response(null, {
          status: 401,
          statusText: 'Unauthorized',
          ok: false,
        }) as Response;

      try {
        await client.request('/test');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.constructor.name).toBe('KanApiError');
        expect(err.status).toBe(401);
        expect(err.code).toBe('unauthorized');
      }
    });

    test('throws KanApiError on 403 response', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 0);

      globalThis.fetch = async () =>
        new Response(null, {
          status: 403,
          statusText: 'Forbidden',
          ok: false,
        }) as Response;

      try {
        await client.request('/test');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.constructor.name).toBe('KanApiError');
        expect(err.status).toBe(403);
        expect(err.code).toBe('forbidden');
      }
    });

    test('throws KanApiError on 404 response', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 0);

      globalThis.fetch = async () =>
        new Response(null, {
          status: 404,
          statusText: 'Not Found',
          ok: false,
        }) as Response;

      try {
        await client.request('/test');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.constructor.name).toBe('KanApiError');
        expect(err.status).toBe(404);
        expect(err.code).toBe('notFound');
      }
    });

    test('throws KanApiError on 500 response', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 0);

      globalThis.fetch = async () =>
        new Response(null, {
          status: 500,
          statusText: 'Internal Server Error',
          ok: false,
        }) as Response;

      try {
        await client.request('/test');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.constructor.name).toBe('KanApiError');
        expect(err.status).toBe(500);
        expect(err.code).toBe('internalError');
      }
    });

    test('throws KanApiError with unknownError for non-mapped status codes', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 0);

      globalThis.fetch = async () =>
        new Response(null, {
          status: 418,
          statusText: "I'm a teapot",
          ok: false,
        }) as Response;

      try {
        await client.request('/test');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.constructor.name).toBe('KanApiError');
        expect(err.status).toBe(418);
        expect(err.code).toBe('unknownError');
      }
    });

    test('does not retry on 400 client error', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 2);
      let attempts = 0;

      globalThis.fetch = async () => {
        attempts++;
        return new Response(null, {
          status: 400,
          statusText: 'Bad Request',
          ok: false,
        }) as Response;
      };

      try {
        await client.request('/test');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.constructor.name).toBe('KanApiError');
        expect(err.status).toBe(400);
      }
      expect(attempts).toBe(1);
    });

    test('retries on 429 rate limit error', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 2);
      let attempts = 0;

      globalThis.fetch = async () => {
        attempts++;
        if (attempts < 3) {
          return new Response(null, {
            status: 429,
            statusText: 'Too Many Requests',
            ok: false,
          }) as Response;
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await client.request<{ success: boolean }>('/test');
      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });

    test('retries on 5xx server error', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 2);
      let attempts = 0;

      globalThis.fetch = async () => {
        attempts++;
        if (attempts < 3) {
          return new Response(null, {
            status: 503,
            statusText: 'Service Unavailable',
            ok: false,
          }) as Response;
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await client.request<{ success: boolean }>('/test');
      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });

    test('does not retry on 400 client error', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 2);
      let attempts = 0;

      globalThis.fetch = async () => {
        attempts++;
        return new Response(null, {
          status: 400,
          statusText: 'Bad Request',
          ok: false,
        }) as Response;
      };

      try {
        await client.request('/test');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.constructor.name).toBe('KanApiError');
        expect(err.status).toBe(400);
      }
      expect(attempts).toBe(1);
    });

    test('retries on network TypeError', async () => {
      const client = new KanClient(TEST_API_KEY, TEST_BASE_URL, 5000, 2);
      let attempts = 0;

      globalThis.fetch = async () => {
        attempts++;
        if (attempts < 3) {
          throw new TypeError('Network error');
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await client.request<{ success: boolean }>('/test');
      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });
  });
});
