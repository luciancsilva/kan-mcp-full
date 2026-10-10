import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KanClient } from '../../src/client';
import {
  attachmentAddTool,
  attachmentDownloadTool,
  attachmentListTool,
  attachmentRemoveTool,
} from '../../src/tools/attachment';

// Needs a Kan with S3 storage. Start one with scripts/integration-up.sh, then:
//   set -a; . ./.env.integration; set +a
//   INTEGRATION_TEST=true bun test tests/integration/attachment.test.ts
const enabled =
  process.env.INTEGRATION_TEST === 'true' &&
  !!process.env.KAN_API_KEY &&
  !!process.env.KAN_TEST_CARD_ID;

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const MB = 1024 * 1024;

describe.skipIf(!enabled)('Attachment integration tests', () => {
  const card = process.env.KAN_TEST_CARD_ID as string;
  let client: KanClient;
  let root: string;
  let downloads: string;

  const list = async () => {
    const result = await attachmentListTool.handler(client, { cardPublicId: card });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  };

  const removeAll = async () => {
    for (const a of await list()) {
      await attachmentRemoveTool.handler(client, { attachmentPublicId: a.publicId });
    }
  };

  beforeAll(async () => {
    client = new KanClient(
      process.env.KAN_API_KEY as string,
      process.env.KAN_API_BASE_URL ?? 'http://localhost:3000/api/v1'
    );
    // Another suite may have used up the key's rate limit window (Kan answers with 401): wait for it.
    for (let attempt = 0; attempt < 8; attempt++) {
      if ((await attachmentListTool.handler(client, { cardPublicId: card })).ok) break;
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
    root = await mkdtemp(join(tmpdir(), 'kan-mcp-it-'));
    downloads = join(root, 'downloads');
    await mkdir(downloads);
    process.env.KAN_MCP_UPLOAD_ROOT = root;
    process.env.KAN_MCP_DOWNLOAD_DIR = downloads;
    await removeAll();
  }, 120_000);

  afterAll(async () => {
    await removeAll();
    delete process.env.KAN_MCP_UPLOAD_ROOT;
    delete process.env.KAN_MCP_DOWNLOAD_DIR;
    await rm(root, { recursive: true, force: true });
  });

  test('add, list, download and remove a binary file', async () => {
    const original = crypto.getRandomValues(new Uint8Array(300_000));
    await writeFile(join(root, 'dados.bin'), original);

    const added = await attachmentAddTool.handler(client, { cardPublicId: card, filePath: 'dados.bin' });
    expect(added.ok).toBe(true);
    const publicId = (added as { data: { publicId: string } }).data.publicId;

    const attachments = await list();
    expect(attachments.map((a) => a.publicId)).toContain(publicId);
    expect(attachments.find((a) => a.publicId === publicId)).toMatchObject({
      filename: 'dados.bin',
      size: 300_000,
    });

    const downloaded = await attachmentDownloadTool.handler(client, {
      cardPublicId: card,
      attachmentPublicId: publicId,
    });
    expect(downloaded.ok).toBe(true);
    const saved = await readFile((downloaded as { data: { path: string } }).data.path);
    expect(sha256(saved)).toBe(sha256(original));

    // The storage must really lose the object: Kan only logs (and ignores) S3 delete failures.
    const rawCard = await client.request<{ attachments: { publicId: string; url: string }[] }>(
      `/cards/${card}`
    );
    const storageUrl = rawCard.attachments.find((a) => a.publicId === publicId)?.url as string;
    expect((await fetch(storageUrl)).status).toBe(200);

    const removed = await attachmentRemoveTool.handler(client, { attachmentPublicId: publicId });
    expect(removed).toEqual({ ok: true, data: { success: true } });
    expect((await fetch(storageUrl)).status).toBe(404);
    expect((await list()).map((a) => a.publicId)).not.toContain(publicId);

    const again = await attachmentRemoveTool.handler(client, { attachmentPublicId: publicId });
    expect(again.ok).toBe(false);
  });

  test('keeps accented names and honours filename/contentType overrides', async () => {
    const added = await attachmentAddTool.handler(client, {
      cardPublicId: card,
      contentBase64: Buffer.from('conteúdo').toString('base64'),
      filename: 'relatório final.txt',
      contentType: 'application/x-custom',
    });
    expect(added.ok).toBe(true);
    expect((added as { data: unknown }).data).toMatchObject({
      originalFilename: 'relatório final.txt',
      contentType: 'application/x-custom',
    });
    await removeAll();
  });

  test('accepts exactly 50 MB and rejects 50 MB + 1 byte before uploading', async () => {
    await writeFile(join(root, 'exato.bin'), new Uint8Array(50 * MB));
    await writeFile(join(root, 'passou.bin'), new Uint8Array(50 * MB + 1));

    const ok = await attachmentAddTool.handler(client, { cardPublicId: card, filePath: 'exato.bin' });
    expect(ok.ok).toBe(true);

    const tooBig = await attachmentAddTool.handler(client, { cardPublicId: card, filePath: 'passou.bin' });
    expect(tooBig.ok).toBe(false);
    expect((tooBig as { error: string }).error).toContain('limit');
    expect(await list()).toHaveLength(1);
    await removeAll();
  }, 180_000); // 50 MB over a real network connection exceeds bun's default 5 s timeout

  test('reports an unknown card and refuses to leave the upload root', async () => {
    const unknown = await attachmentAddTool.handler(client, {
      cardPublicId: 'zzzzzzzzzzzz',
      contentBase64: 'aGk=',
      filename: 'x.txt',
    });
    expect(unknown.ok).toBe(false);

    const traversal = await attachmentAddTool.handler(client, {
      cardPublicId: card,
      filePath: '../../../etc/hostname',
    });
    expect(traversal.ok).toBe(false);
    expect(await list()).toHaveLength(0);
  });
});
