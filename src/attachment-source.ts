import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';

/** Kan rejects uploads above 50 MB (generateUploadUrl input schema). */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const URL_FETCH_TIMEOUT_MS = 60_000;

export interface AttachmentSourceInput {
  filePath?: string;
  url?: string;
  contentBase64?: string;
  filename?: string;
  contentType?: string;
}

export interface ResolvedAttachment {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

export function guessContentType(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext && ext !== filename.toLowerCase() ? MIME_BY_EXT[ext] : undefined;
}

/** Same sanitization Kan applies to the stored key, used for the `filename` field. */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex?.[1] && mappedHex[2]) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return (
      lower === '::' ||
      lower === '::1' ||
      /^f[cd]/.test(lower) ||
      /^fe[89ab]/.test(lower) ||
      lower.startsWith('ff')
    );
  }
  return true;
}

function allowPrivateUrls(): boolean {
  return process.env.KAN_MCP_ALLOW_PRIVATE_URLS === 'true';
}

async function assertUrlAllowed(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('url is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('url must use http or https');
  }
  if (allowPrivateUrls()) return url;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error(
      'url resolves to a private or internal address (set KAN_MCP_ALLOW_PRIVATE_URLS=true to allow)'
    );
  }
  return url;
}

function decodedBase64Size(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

async function readBodyWithLimit(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_ATTACHMENT_BYTES) {
    throw new Error(`file at url exceeds the ${MAX_ATTACHMENT_BYTES} byte limit`);
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ATTACHMENT_BYTES) {
      await reader.cancel();
      throw new Error(`file at url exceeds the ${MAX_ATTACHMENT_BYTES} byte limit`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fromFilePath(filePath: string): Promise<{ bytes: Uint8Array; filename: string }> {
  const rootEnv = process.env.KAN_MCP_UPLOAD_ROOT;
  if (!rootEnv) {
    throw new Error('filePath is disabled: set KAN_MCP_UPLOAD_ROOT to the directory files may be read from');
  }
  const root = await realpath(resolve(rootEnv));
  let real: string;
  try {
    real = await realpath(resolve(root, filePath));
  } catch {
    throw new Error('filePath not found or not readable');
  }
  const rel = relative(root, real);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('filePath is outside KAN_MCP_UPLOAD_ROOT');
  }
  const info = await stat(real);
  if (!info.isFile()) throw new Error('filePath is not a regular file');
  if (info.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`file exceeds the ${MAX_ATTACHMENT_BYTES} byte limit`);
  }
  return { bytes: await readFile(real), filename: basename(real) };
}

async function fromUrl(
  rawUrl: string
): Promise<{ bytes: Uint8Array; filename: string; contentType?: string }> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertUrlAllowed(current);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('url redirect without Location header');
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new Error(`could not download url: HTTP ${response.status}`);
    const bytes = await readBodyWithLimit(response);
    const last = url.pathname.split('/').filter(Boolean).pop();
    let filename = 'file';
    if (last) {
      try {
        filename = decodeURIComponent(last);
      } catch {
        filename = last;
      }
    }
    const headerType = response.headers.get('content-type')?.split(';')[0]?.trim();
    return {
      bytes,
      filename,
      ...(headerType && headerType !== 'application/octet-stream' ? { contentType: headerType } : {}),
    };
  }
  throw new Error(`url redirected more than ${MAX_REDIRECTS} times`);
}

export async function resolveAttachmentSource(
  input: AttachmentSourceInput
): Promise<ResolvedAttachment> {
  const provided = [input.filePath, input.url, input.contentBase64].filter((v) => v !== undefined);
  if (provided.length !== 1) {
    throw new Error('provide exactly one of filePath, url or contentBase64');
  }

  let bytes: Uint8Array;
  let filename: string | undefined = input.filename;
  let sourceType: string | undefined;

  if (input.filePath !== undefined) {
    const file = await fromFilePath(input.filePath);
    bytes = file.bytes;
    filename ??= file.filename;
  } else if (input.url !== undefined) {
    const remote = await fromUrl(input.url);
    bytes = remote.bytes;
    filename ??= remote.filename;
    sourceType = remote.contentType;
  } else {
    if (!input.filename) throw new Error('filename is required with contentBase64');
    const b64 = (input.contentBase64 as string).replace(/^data:[^;,]*;base64,/, '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw new Error('contentBase64 is not valid base64');
    if (decodedBase64Size(b64) > MAX_ATTACHMENT_BYTES) {
      throw new Error(`content exceeds the ${MAX_ATTACHMENT_BYTES} byte limit`);
    }
    bytes = Buffer.from(b64, 'base64');
  }

  if (bytes.byteLength === 0) throw new Error('file is empty');
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error(`file exceeds the ${MAX_ATTACHMENT_BYTES} byte limit`);
  }
  const name = (filename ?? 'file').trim();
  if (name.length < 1 || name.length > 255) throw new Error('filename must have 1 to 255 characters');

  return {
    bytes,
    filename: name,
    contentType:
      input.contentType ?? sourceType ?? guessContentType(name) ?? 'application/octet-stream',
  };
}
