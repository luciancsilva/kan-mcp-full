import { KanClient } from '../client';
import { Attachment, Card, ToolResult, ROUTES, UploadUrlResponse } from '../types';
import { success, error, assertString, assertOptionalString } from '../utils';
import { toMcpError } from '../errors';
import { resolveAttachmentSource, sanitizeFilename } from '../attachment-source';

interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  handler: (client: KanClient, input: TInput) => Promise<ToolResult<TOutput>>;
}

const STORAGE_UPLOAD_TIMEOUT_MS = 120_000;

interface AttachmentAddInput {
  cardPublicId: string;
  filePath?: string;
  url?: string;
  contentBase64?: string;
  filename?: string;
  contentType?: string;
}

interface AttachmentListInput {
  cardPublicId: string;
}

interface AttachmentRemoveInput {
  attachmentPublicId: string;
}

interface AttachmentSummary {
  publicId: string;
  filename?: string;
  contentType?: string;
  size?: number;
  createdAt?: string;
}

export const attachmentAddTool: Tool<AttachmentAddInput, unknown> = {
  name: 'attachment.add',
  description:
    'Attach a file to a card (max 50 MB). Provide exactly one source: filePath (inside KAN_MCP_UPLOAD_ROOT), url (http/https) or contentBase64 (requires filename). The file is uploaded to the Kan storage with a presigned URL and then registered on the card.',
  inputSchema: {
    type: 'object',
    properties: {
      cardPublicId: { type: 'string' },
      filePath: {
        type: 'string',
        description: 'Path of a local file, relative to KAN_MCP_UPLOAD_ROOT (or absolute inside it).',
      },
      url: { type: 'string', description: 'http(s) URL to download the file from.' },
      contentBase64: { type: 'string', description: 'File content in base64. Requires filename.' },
      filename: {
        type: 'string',
        description: 'Name shown in Kan. Defaults to the file name or the last segment of the URL.',
      },
      contentType: {
        type: 'string',
        description: 'MIME type. Detected from the source or file extension when omitted.',
      },
    },
    required: ['cardPublicId'],
  },
  handler: async (client: KanClient, input: AttachmentAddInput): Promise<ToolResult<unknown>> => {
    try {
      assertString(input.cardPublicId, 'cardPublicId');
      assertOptionalString(input.filePath, 'filePath');
      assertOptionalString(input.url, 'url');
      assertOptionalString(input.contentBase64, 'contentBase64');
      assertOptionalString(input.filename, 'filename');
      assertOptionalString(input.contentType, 'contentType');

      const file = await resolveAttachmentSource({
        ...(input.filePath !== undefined ? { filePath: input.filePath } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.contentBase64 !== undefined ? { contentBase64: input.contentBase64 } : {}),
        ...(input.filename !== undefined ? { filename: input.filename } : {}),
        ...(input.contentType !== undefined ? { contentType: input.contentType } : {}),
      });
      const size = file.bytes.byteLength;
      const base = `${ROUTES.CARDS}/${input.cardPublicId}/attachments`;

      const upload = await client.request<UploadUrlResponse>(`${base}/upload-url`, {
        method: 'POST',
        body: JSON.stringify({ filename: file.filename, contentType: file.contentType, size }),
      });

      // Direct PUT to the storage: no Kan credentials, no retries (presigned URL is single purpose).
      const put = await fetch(upload.url, {
        method: 'PUT',
        headers: { 'Content-Type': file.contentType },
        body: new Blob([file.bytes as BlobPart], { type: file.contentType }),
        signal: AbortSignal.timeout(STORAGE_UPLOAD_TIMEOUT_MS),
      });
      if (!put.ok) {
        return error(
          `Upload to storage failed (HTTP ${put.status}). The attachment was NOT registered on the card.`
        );
      }

      // Kan does not verify the object exists, so confirm only after a successful PUT.
      // retries: 0 so a transient error cannot register the same attachment twice.
      try {
        const attachment = await client.request<unknown>(`${base}/confirm`, {
          method: 'POST',
          retries: 0,
          body: JSON.stringify({
            s3Key: upload.key,
            filename: sanitizeFilename(file.filename),
            originalFilename: file.filename,
            contentType: file.contentType,
            size,
          }),
        });
        return success(attachment);
      } catch (err) {
        return error(
          `File was uploaded to storage but could not be registered on the card: ${toMcpError(err).message}. Retry attachment.add.`
        );
      }
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const attachmentListTool: Tool<AttachmentListInput, AttachmentSummary[]> = {
  name: 'attachment.list',
  description:
    'List the attachments of a card (publicId, filename, contentType, size, createdAt). Use the publicId with attachment.remove.',
  inputSchema: {
    type: 'object',
    properties: { cardPublicId: { type: 'string' } },
    required: ['cardPublicId'],
  },
  handler: async (client: KanClient, input: AttachmentListInput): Promise<ToolResult<AttachmentSummary[]>> => {
    try {
      assertString(input.cardPublicId, 'cardPublicId');
      const card = await client.request<Card>(`${ROUTES.CARDS}/${input.cardPublicId}`);
      const attachments: Attachment[] | undefined = card.attachments;
      if (!Array.isArray(attachments)) {
        return error(
          'This Kan version does not return attachments with the card (GET /cards/{id} has no "attachments" field).'
        );
      }
      return success(
        attachments
          .filter((a) => !a.deletedAt)
          .map((a) => ({
            publicId: a.publicId,
            ...((a.originalFilename ?? a.filename) !== undefined
              ? { filename: (a.originalFilename ?? a.filename) as string }
              : {}),
            ...(a.contentType !== undefined ? { contentType: a.contentType } : {}),
            ...(a.size !== undefined ? { size: a.size } : {}),
            ...(a.createdAt !== undefined ? { createdAt: a.createdAt } : {}),
          }))
      );
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const attachmentRemoveTool: Tool<AttachmentRemoveInput, unknown> = {
  name: 'attachment.remove',
  description:
    'Remove an attachment from a card (soft delete in Kan; the stored file is deleted on a best-effort basis). Get the attachmentPublicId from attachment.list.',
  inputSchema: {
    type: 'object',
    properties: { attachmentPublicId: { type: 'string' } },
    required: ['attachmentPublicId'],
  },
  handler: async (client: KanClient, input: AttachmentRemoveInput): Promise<ToolResult<unknown>> => {
    try {
      assertString(input.attachmentPublicId, 'attachmentPublicId');
      if (input.attachmentPublicId.trim() === '') throw new Error('attachmentPublicId must not be empty');
      const data = await client.request<unknown>(
        `${ROUTES.ATTACHMENTS}/${encodeURIComponent(input.attachmentPublicId)}`,
        { method: 'DELETE' }
      );
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};
