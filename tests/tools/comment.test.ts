import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { KanClient } from '../../src/client';
import { Comment } from '../../src/types';
import {
  commentAddTool,
  commentUpdateTool,
  commentDeleteTool,
} from '../../src/tools/comment';
import { sanitizeHtml } from '../../src/utils';

const TEST_API_KEY = 'test-api-key';
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockComment: Comment = {
  publicId: 'comment-1',
  cardPublicId: 'card-1',
  memberPublicId: 'member-1',
  content: 'Test comment',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('comment tools', () => {
  describe('comment.add', () => {
    test('adds a comment to a card', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        cardPublicId: 'card-1',
        content: 'New comment',
      };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockComment), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await commentAddTool.handler(client, input);

      expect(receivedMethod).toBe('POST');
      expect(receivedUrl).toContain('/cards/card-1/comments');
      expect(JSON.parse(receivedBody)).toEqual({ comment: 'New comment' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockComment);
      }
    });

    test('returns error when cardPublicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await commentAddTool.handler(client, {
        content: 'Test',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('cardPublicId');
      }
    });

    test('returns error when content is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await commentAddTool.handler(client, {
        cardPublicId: 'card-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('content');
      }
    });
  });

  describe('comment.update', () => {
    test('updates a comment', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { cardPublicId: 'card-1', publicId: 'comment-1', content: 'Updated comment' };
      const updatedComment = { ...mockComment, content: 'Updated comment' };

      let receivedUrl = '';
      let receivedMethod = '';
      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(updatedComment), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await commentUpdateTool.handler(client, input);

      expect(receivedMethod).toBe('PUT');
      expect(receivedUrl).toContain('/cards/card-1/comments/comment-1');
      expect(JSON.parse(receivedBody)).toEqual({ comment: 'Updated comment' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.content).toBe('Updated comment');
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await commentUpdateTool.handler(client, {
        cardPublicId: 'card-1',
        content: 'Test',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });

    test('returns error when content is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await commentUpdateTool.handler(client, {
        cardPublicId: 'card-1',
        publicId: 'comment-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('content');
      }
    });
  });

  describe('comment.delete', () => {
    test('deletes a comment', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = { cardPublicId: 'card-1', publicId: 'comment-1' };

      let receivedUrl = '';
      let receivedMethod = '';

      globalThis.fetch = async (url, init) => {
        receivedUrl = url as string;
        receivedMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          ok: true,
        }) as Response;
      };

      const result = await commentDeleteTool.handler(client, input);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toContain('/cards/card-1/comments/comment-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ success: true });
      }
    });

    test('returns error when publicId is missing', async () => {
      const client = new KanClient(TEST_API_KEY);

      const result = await commentDeleteTool.handler(client, {
        cardPublicId: 'card-1',
      } as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('publicId');
      }
    });
  });

  describe('HTML sanitization', () => {
    test('sanitizes dangerous HTML from comment content', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        cardPublicId: 'card-1',
        content: '<p>Hello</p><script>alert("xss")</script><p>World</p>',
      };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockComment), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await commentAddTool.handler(client, input);

      const body = JSON.parse(receivedBody);
      expect(body.comment).not.toContain('<script>');
      expect(body.comment).toContain('<p>Hello</p>');
      expect(body.comment).toContain('<p>World</p>');
    });

    test('sanitizes event handlers from comment content', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        cardPublicId: 'card-1',
        content: '<p onclick="alert(1)">Click me</p>',
      };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockComment), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await commentAddTool.handler(client, input);

      const body = JSON.parse(receivedBody);
      expect(body.comment).not.toContain('onclick');
      expect(body.comment).toContain('<p>Click me</p>');
    });

    test('allows safe HTML tags in comment content', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        cardPublicId: 'card-1',
        content: '<p>Line 1</p><br><p>Line 2</p><a href="https://example.com">Link</a>',
      };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockComment), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await commentAddTool.handler(client, input);

      const body = JSON.parse(receivedBody);
      expect(body.comment).toContain('<p>Line 1</p>');
      expect(body.comment).toContain('<br>');
      expect(body.comment).toContain('<a href="https://example.com">Link</a>');
    });

    test('blocks javascript: URLs in links', async () => {
      const client = new KanClient(TEST_API_KEY);
      const input = {
        cardPublicId: 'card-1',
        content: '<a href="javascript:alert(1)">Evil link</a>',
      };

      let receivedBody = '';

      globalThis.fetch = async (url, init) => {
        receivedBody = init?.body as string;
        return new Response(JSON.stringify(mockComment), {
          status: 201,
          ok: true,
        }) as Response;
      };

      const result = await commentAddTool.handler(client, input);

      const body = JSON.parse(receivedBody);
      expect(body.comment).toContain('href="#"');
      expect(body.comment).not.toContain('javascript:');
    });
  });
});
