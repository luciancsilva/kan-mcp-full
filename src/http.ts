import { createHash, timingSafeEqual } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { KanClient } from './client.js';
import { createKanServer } from './server.js';
import { VERSION } from './version.js';

/** Largest request body: a 50 MB attachment sent as base64 is about 67 MB. */
export const MAX_BODY_BYTES = 80 * 1024 * 1024;
export const MIN_TOKEN_LENGTH = 16;

export interface HttpOptions {
  client: KanClient;
  token: string;
  host?: string;
  port?: number;
  maxBodyBytes?: number;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest();

function authorized(request: Request, token: string): boolean {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer (.+)$/i.exec(header);
  // Compare digests so the check takes the same time whatever the length of the given token.
  return match?.[1] !== undefined && timingSafeEqual(sha256(match[1]), sha256(token));
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/**
 * Serves the MCP over Streamable HTTP (POST /mcp), protected by a bearer token.
 * Stateless: every request gets its own server and transport, so there are no sessions to expire.
 * GET /health is open (for container health checks) and reveals nothing but the version.
 */
export function startHttpServer(options: HttpOptions) {
  if (options.token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`MCP_AUTH_TOKEN must have at least ${MIN_TOKEN_LENGTH} characters`);
  }

  return Bun.serve({
    hostname: options.host ?? '127.0.0.1',
    port: options.port ?? 3333,
    maxRequestBodySize: options.maxBodyBytes ?? MAX_BODY_BYTES,
    async fetch(request) {
      const { pathname } = new URL(request.url);

      if (pathname === '/health') {
        return request.method === 'GET' ? json(200, { status: 'ok', version: VERSION }) : json(405, { error: 'Method Not Allowed' });
      }
      if (pathname !== '/mcp') return json(404, { error: 'Not Found' });

      if (!authorized(request, options.token)) {
        return json(401, { error: 'Unauthorized' }, { 'www-authenticate': 'Bearer realm="kan-mcp-full"' });
      }
      if (request.method !== 'POST') {
        return json(405, { error: 'Method Not Allowed: this server is stateless, use POST' }, { allow: 'POST' });
      }

      const server = createKanServer(options.client);
      // No sessionIdGenerator: stateless mode (the SDK documents `undefined` for it).
      const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
      await server.connect(transport);
      try {
        return await transport.handleRequest(request);
      } finally {
        // The response is complete (JSON mode), so the per-request server can be released.
        void transport.close().catch(() => {});
      }
    },
    error(error) {
      console.error('HTTP error:', error.message);
      return json(500, { error: 'Internal Server Error' });
    },
  });
}
