import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, writeFile, symlink, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KanClient } from '../../src/client';
import {
  attachmentAddTool,
  attachmentListTool,
  attachmentRemoveTool,
  attachmentDownloadTool,
} from '../../src/tools/attachment';
import { isPrivateAddress, resolveAttachmentSource } from '../../src/attachment-source';

const BASE = 'https://kan.test/api/v1';
const STORAGE = 'https://storage.test/bucket/key?sig=abc';
let originalFetch: typeof fetch;
let calls: { url: string; method: string; headers: Record<string, string>; body?: unknown }[];
let root: string;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

function newClient() {
  return new KanClient('test-key', BASE, 5000, 0);
}

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({
      url,
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body,
    });
    return handler(url, init);
  }) as typeof fetch;
}

beforeEach(async () => {
  originalFetch = globalThis.fetch;
  calls = [];
  root = await mkdtemp(join(tmpdir(), 'kan-mcp-upload-'));
  process.env.KAN_MCP_UPLOAD_ROOT = root;
  delete process.env.KAN_MCP_ALLOW_PRIVATE_URLS;
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  delete process.env.KAN_MCP_UPLOAD_ROOT;
  delete process.env.KAN_MCP_ALLOW_PRIVATE_URLS;
  delete process.env.KAN_MCP_DOWNLOAD_DIR;
  await rm(root, { recursive: true, force: true });
});

function happyPath() {
  mockFetch((url, init) => {
    if (url.endsWith('/attachments/upload-url')) return json({ url: STORAGE, key: 'ws/card/uid-a.txt' });
    if (url === STORAGE) return new Response(null, { status: 200 });
    if (url.endsWith('/attachments/confirm')) return json({ publicId: 'att-1', filename: 'a.txt' });
    return new Response('unexpected ' + url + init.method, { status: 500 });
  });
}

describe('attachment.add', () => {
  test('uploads a local file: upload-url, PUT to storage, then confirm', async () => {
    await writeFile(join(root, 'a.txt'), 'hello');
    happyPath();

    const result = await attachmentAddTool.handler(newClient(), {
      cardPublicId: 'card123456789',
      filePath: 'a.txt',
    });

    expect(result).toEqual({ ok: true, data: { publicId: 'att-1', filename: 'a.txt' } });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST ${BASE}/cards/card123456789/attachments/upload-url`,
      `PUT ${STORAGE}`,
      `POST ${BASE}/cards/card123456789/attachments/confirm`,
    ]);
    expect(JSON.parse(calls[0]!.body as string)).toEqual({
      filename: 'a.txt',
      contentType: 'text/plain',
      size: 5,
    });
    // storage PUT must not carry the Kan credentials
    expect(calls[1]!.headers['Authorization']).toBeUndefined();
    expect(calls[1]!.headers['Content-Type']).toBe('text/plain');
    expect(JSON.parse(calls[2]!.body as string)).toEqual({
      s3Key: 'ws/card/uid-a.txt',
      filename: 'a.txt',
      originalFilename: 'a.txt',
      contentType: 'text/plain',
      size: 5,
    });
  });

  test('uploads base64 content and sanitizes the stored filename', async () => {
    happyPath();
    const result = await attachmentAddTool.handler(newClient(), {
      cardPublicId: 'card123456789',
      contentBase64: Buffer.from('conteudo').toString('base64'),
      filename: 'relatório final.pdf',
    });
    expect(result.ok).toBe(true);
    const confirm = JSON.parse(calls[2]!.body as string);
    expect(confirm.filename).toBe('relat_rio_final.pdf');
    expect(confirm.originalFilename).toBe('relatório final.pdf');
    expect(confirm.contentType).toBe('application/pdf');
  });

  test('does not confirm when the storage PUT fails', async () => {
    mockFetch((url) => {
      if (url.endsWith('/upload-url')) return json({ url: STORAGE, key: 'k' });
      if (url === STORAGE) return new Response('denied', { status: 403 });
      return json({});
    });
    const result = await attachmentAddTool.handler(newClient(), {
      cardPublicId: 'card123456789',
      contentBase64: Buffer.from('x').toString('base64'),
      filename: 'x.txt',
    });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain('NOT registered');
    expect(calls.some((c) => c.url.endsWith('/confirm'))).toBe(false);
  });

  test('reports an orphaned upload when confirm fails', async () => {
    mockFetch((url) => {
      if (url.endsWith('/upload-url')) return json({ url: STORAGE, key: 'k' });
      if (url === STORAGE) return new Response(null, { status: 200 });
      return new Response('boom', { status: 500 });
    });
    const result = await attachmentAddTool.handler(newClient(), {
      cardPublicId: 'card123456789',
      contentBase64: Buffer.from('x').toString('base64'),
      filename: 'x.txt',
    });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain('uploaded to storage but could not be registered');
  });

  test('requires exactly one source', async () => {
    const none = await attachmentAddTool.handler(newClient(), { cardPublicId: 'c' });
    const two = await attachmentAddTool.handler(newClient(), {
      cardPublicId: 'c',
      filePath: 'a',
      url: 'https://x.test/a',
    });
    expect(none.ok).toBe(false);
    expect(two.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test('rejects content above 50 MB before decoding', async () => {
    await expect(
      resolveAttachmentSource({ contentBase64: 'A'.repeat(70_000_000), filename: 'big.bin' })
    ).rejects.toThrow('limit');
  });

  test('rejects invalid base64', async () => {
    await expect(
      resolveAttachmentSource({ contentBase64: 'not base64!!', filename: 'x.bin' })
    ).rejects.toThrow('base64');
  });

  test('base64 requires filename', async () => {
    const result = await attachmentAddTool.handler(newClient(), {
      cardPublicId: 'c',
      contentBase64: 'aGk=',
    });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain('filename is required');
  });
});

describe('filePath safety', () => {
  test('is disabled without KAN_MCP_UPLOAD_ROOT', async () => {
    delete process.env.KAN_MCP_UPLOAD_ROOT;
    await expect(resolveAttachmentSource({ filePath: '/etc/hostname' })).rejects.toThrow('disabled');
  });

  test('rejects paths outside the root (traversal and absolute)', async () => {
    await expect(resolveAttachmentSource({ filePath: '../../etc/hostname' })).rejects.toThrow();
    await expect(resolveAttachmentSource({ filePath: '/etc/hostname' })).rejects.toThrow('outside');
  });

  test('rejects a symlink that escapes the root', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'kan-mcp-outside-'));
    try {
      await writeFile(join(outside, 'secret.txt'), 'secret');
      await symlink(join(outside, 'secret.txt'), join(root, 'link.txt'));
      await expect(resolveAttachmentSource({ filePath: 'link.txt' })).rejects.toThrow('outside');
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  test('rejects directories and empty files', async () => {
    await mkdir(join(root, 'dir'));
    await writeFile(join(root, 'empty.txt'), '');
    await expect(resolveAttachmentSource({ filePath: 'dir' })).rejects.toThrow('regular file');
    await expect(resolveAttachmentSource({ filePath: 'empty.txt' })).rejects.toThrow('empty');
  });
});

describe('url safety', () => {
  test('classifies private addresses', () => {
    for (const ip of [
      '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254',
      '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1',
    ]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });

  test('blocks private addresses and non-http schemes', async () => {
    await expect(resolveAttachmentSource({ url: 'http://169.254.169.254/latest' })).rejects.toThrow('private');
    await expect(resolveAttachmentSource({ url: 'file:///etc/passwd' })).rejects.toThrow('http');
  });

  test('blocks redirects to private addresses', async () => {
    mockFetch(() => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }));
    await expect(resolveAttachmentSource({ url: 'http://8.8.8.8/file' })).rejects.toThrow('private');
  });

  test('downloads from a public address, deriving name and type', async () => {
    mockFetch(
      () => new Response('pdfdata', { status: 200, headers: { 'content-type': 'application/pdf; charset=x' } })
    );
    const file = await resolveAttachmentSource({ url: 'https://8.8.8.8/files/relat%C3%B3rio' });
    expect(file.filename).toBe('relatório');
    expect(file.contentType).toBe('application/pdf');
    expect(Buffer.from(file.bytes).toString()).toBe('pdfdata');
  });

  test('allows private addresses only when explicitly enabled', async () => {
    process.env.KAN_MCP_ALLOW_PRIVATE_URLS = 'true';
    mockFetch(() => new Response('ok', { status: 200 }));
    const file = await resolveAttachmentSource({ url: 'http://127.0.0.1/a.txt' });
    expect(file.filename).toBe('a.txt');
    expect(file.contentType).toBe('text/plain');
  });
});

describe('attachment.list', () => {
  test('lists attachments of a card without signed urls and skips deleted ones', async () => {
    mockFetch(() =>
      json({
        publicId: 'card123456789',
        attachments: [
          { publicId: 'a1', filename: 'x_y.pdf', originalFilename: 'x y.pdf', contentType: 'application/pdf', size: 10, createdAt: 't', url: 'https://signed' },
          { publicId: 'a2', filename: 'old.txt', deletedAt: '2024-01-01' },
        ],
      })
    );
    const result = await attachmentListTool.handler(newClient(), { cardPublicId: 'card123456789' });
    expect(result).toEqual({
      ok: true,
      data: [{ publicId: 'a1', filename: 'x y.pdf', contentType: 'application/pdf', size: 10, createdAt: 't' }],
    });
  });

  test('errors clearly when the card has no attachments field', async () => {
    mockFetch(() => json({ publicId: 'card123456789' }));
    const result = await attachmentListTool.handler(newClient(), { cardPublicId: 'card123456789' });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain('attachments');
  });
});

describe('attachment.remove', () => {
  test('deletes by publicId', async () => {
    mockFetch(() => json({ success: true }));
    const result = await attachmentRemoveTool.handler(newClient(), { attachmentPublicId: 'att123456789' });
    expect(result).toEqual({ ok: true, data: { success: true } });
    expect(calls[0]!.method).toBe('DELETE');
    expect(calls[0]!.url).toBe(`${BASE}/attachments/att123456789`);
  });

  test('maps API errors', async () => {
    mockFetch(() => new Response('', { status: 404, statusText: 'Not Found' }));
    const result = await attachmentRemoveTool.handler(newClient(), { attachmentPublicId: 'nope' });
    expect(result.ok).toBe(false);
  });
});

describe('attachment.download', () => {
  const card = (extra: Record<string, unknown> = {}) => ({
    publicId: 'card123456789',
    attachments: [
      { publicId: 'att000000001', originalFilename: 'relatório.txt', contentType: 'text/plain', size: 5, url: 'https://storage.test/f', ...extra },
    ],
  });

  test('is disabled without KAN_MCP_DOWNLOAD_DIR', async () => {
    mockFetch(() => json(card()));
    const result = await attachmentDownloadTool.handler(newClient(), {
      cardPublicId: 'card123456789',
      attachmentPublicId: 'att000000001',
    });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain('KAN_MCP_DOWNLOAD_DIR');
  });

  test('saves the file with a sanitized name and no Kan credentials', async () => {
    const dir = join(root, 'downloads');
    process.env.KAN_MCP_DOWNLOAD_DIR = dir;
    mockFetch((url) => (url === 'https://storage.test/f' ? new Response('hello') : json(card())));
    const result = await attachmentDownloadTool.handler(newClient(), {
      cardPublicId: 'card123456789',
      attachmentPublicId: 'att000000001',
    });
    expect(result.ok).toBe(true);
    const data = (result as { data: { path: string; size: number } }).data;
    expect(data.path).toBe(join(dir, 'att000000001-relat_rio.txt'));
    expect(data.size).toBe(5);
    expect(await Bun.file(data.path).text()).toBe('hello');
    expect(calls[1]!.headers['Authorization']).toBeUndefined();
  });

  test('errors when the attachment is not on the card, deleted or has no url', async () => {
    process.env.KAN_MCP_DOWNLOAD_DIR = join(root, 'downloads');
    const run = async (c: unknown, id = 'att000000001') => {
      mockFetch(() => json(c));
      return attachmentDownloadTool.handler(newClient(), { cardPublicId: 'card123456789', attachmentPublicId: id });
    };
    expect((await run(card(), 'other')).ok).toBe(false);
    expect((await run(card({ deletedAt: 'x' }))).ok).toBe(false);
    expect((await run(card({ url: null }))).ok).toBe(false);
  });

  test('fails on storage errors', async () => {
    process.env.KAN_MCP_DOWNLOAD_DIR = join(root, 'downloads');
    mockFetch((url) => (url === 'https://storage.test/f' ? new Response('', { status: 403 }) : json(card())));
    const result = await attachmentDownloadTool.handler(newClient(), {
      cardPublicId: 'card123456789',
      attachmentPublicId: 'att000000001',
    });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain('403');
  });
});
