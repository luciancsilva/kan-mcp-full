import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { KanClient } from '../src/client';
import { startHttpServer, MIN_TOKEN_LENGTH } from '../src/http';

const TOKEN = 'a-long-enough-test-token';

// A fake Kan so the MCP server runs for real, end to end, over HTTP.
const fakeKan = Bun.serve({
  port: 0,
  fetch: (req) =>
    req.headers.get('authorization') === 'Bearer kan-key'
      ? Response.json([{ role: 'admin', workspace: { publicId: 'w1', name: 'Alpha', slug: 'alpha' } }])
      : new Response('{"message":"UNAUTHORIZED"}', { status: 401, statusText: 'Unauthorized' }),
});

let http: ReturnType<typeof startHttpServer>;
let base: string;

beforeAll(() => {
  const client = new KanClient('kan-key', `http://localhost:${fakeKan.port}/api/v1`, 5000, 0);
  http = startHttpServer({ client, token: TOKEN, port: 0, maxBodyBytes: 1024 * 1024 });
  base = `http://localhost:${http.port}`;
});

afterAll(async () => {
  await http.stop(true);
  await fakeKan.stop(true);
});

async function connect(token = TOKEN) {
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    })
  );
  return client;
}

describe('HTTP transport', () => {
  test('serves the MCP protocol: lists tools and calls one against Kan', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.length).toBe(54);
    expect(tools.map((t) => t.name)).toContain('attachment.add');

    const result = (await client.callTool({ name: 'workspace.list', arguments: {} })) as {
      isError?: boolean;
      content: { text: string }[];
    };
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0]!.text)[0].workspace.slug).toBe('alpha');
    await client.close();
  });

  test('tool errors come back as MCP errors, not HTTP failures', async () => {
    const client = await connect();
    const result = (await client.callTool({ name: 'list.create', arguments: {} })) as { isError?: boolean };
    expect(result.isError).toBe(true);
    await client.close();
  });

  test('serves several clients at once (stateless)', async () => {
    const clients = await Promise.all([connect(), connect(), connect()]);
    const lists = await Promise.all(clients.map((c) => c.listTools()));
    expect(lists.every((l) => l.tools.length === 54)).toBe(true);
    await Promise.all(clients.map((c) => c.close()));
  });

  test('rejects missing and wrong tokens with 401', async () => {
    const call = (headers: Record<string, string>) =>
      fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}' });
    expect((await call({})).status).toBe(401);
    expect((await call({ authorization: 'Bearer nope' })).status).toBe(401);
    expect((await call({ authorization: `Basic ${TOKEN}` })).status).toBe(401);
    expect((await call({})).headers.get('www-authenticate')).toContain('Bearer');
    await expect(connect('wrong-token-wrong-token')).rejects.toThrow();
  });

  test('only POST is accepted on /mcp and unknown paths are 404', async () => {
    const auth = { authorization: `Bearer ${TOKEN}` };
    expect((await fetch(`${base}/mcp`, { headers: auth })).status).toBe(405);
    expect((await fetch(`${base}/mcp`, { method: 'DELETE', headers: auth })).status).toBe(405);
    expect((await fetch(`${base}/other`, { headers: auth })).status).toBe(404);
  });

  test('/health is open and reveals only status and version', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', version: expect.any(String) });
  });

  test('refuses bodies above the limit', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: 'x'.repeat(2 * 1024 * 1024),
    });
    expect(res.status).toBe(413);
  });

  test('refuses to start with a short token', () => {
    expect(() => startHttpServer({ client: new KanClient('k'), token: 'x'.repeat(MIN_TOKEN_LENGTH - 1), port: 0 })).toThrow('MCP_AUTH_TOKEN');
  });
});
