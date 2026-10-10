import { describe, test, expect } from 'bun:test';

// Runs src/index.ts as the container does and checks how it validates its environment.
async function start(env: Record<string, string>) {
  const proc = Bun.spawn(['bun', 'run', 'src/index.ts'], {
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'ignore',
  });
  const timer = setTimeout(() => proc.kill(), 4000);
  const code = await proc.exited;
  clearTimeout(timer);
  return { code, stderr: await new Response(proc.stderr).text() };
}

describe('entrypoint environment validation', () => {
  test('requires KAN_API_KEY', async () => {
    const { code, stderr } = await start({});
    expect(code).toBe(1);
    expect(stderr).toContain('KAN_API_KEY');
  });

  test('http mode requires MCP_AUTH_TOKEN', async () => {
    const { code, stderr } = await start({ KAN_API_KEY: 'k', MCP_TRANSPORT: 'http' });
    expect(code).toBe(1);
    expect(stderr).toContain('MCP_AUTH_TOKEN');
  });

  test('http mode rejects a short token', async () => {
    const { code, stderr } = await start({ KAN_API_KEY: 'k', MCP_TRANSPORT: 'http', MCP_AUTH_TOKEN: 'short', MCP_PORT: '0' });
    expect(code).toBe(1);
    expect(stderr).toContain('at least');
  });

  test('rejects an unknown transport', async () => {
    const { code, stderr } = await start({ KAN_API_KEY: 'k', MCP_TRANSPORT: 'websocket' });
    expect(code).toBe(1);
    expect(stderr).toContain('MCP_TRANSPORT');
  });
});
