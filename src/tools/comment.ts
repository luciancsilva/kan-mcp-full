import { KanClient } from '../client';
import { Comment, ToolResult, ROUTES } from '../types';
import { success, error, assertString, sanitizeHtml } from '../utils';
import { toMcpError } from '../errors';

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

interface CommentAddInput {
  cardPublicId: string;
  content: string;
}

interface CommentUpdateInput {
  cardPublicId: string;
  publicId: string;
  content: string;
}

interface CommentDeleteInput {
  cardPublicId: string;
  publicId: string;
}

export const commentAddTool: Tool<CommentAddInput, Comment> = {
  name: 'comment.add',
  description: 'Add a comment to a card. The content field accepts HTML for rich text formatting.',
  inputSchema: {
    type: 'object',
    properties: {
      cardPublicId: { type: 'string' },
      content: { 
        type: 'string',
        description: 'HTML content. Use <p> for paragraphs, <br> for line breaks, <a href="...">link</a> for links. Plain text with \n will NOT render correctly.'
      },
    },
    required: ['cardPublicId', 'content'],
  },
  handler: async (client: KanClient, input: CommentAddInput): Promise<ToolResult<Comment>> => {
    try {
      assertString(input.cardPublicId, 'cardPublicId');
      assertString(input.content, 'content');
      const body: Record<string, unknown> = {
        comment: sanitizeHtml(input.content),
      };
      const data = await client.request<Comment>(`${ROUTES.CARDS}/${input.cardPublicId}/comments`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const commentUpdateTool: Tool<CommentUpdateInput, Comment> = {
  name: 'comment.update',
  description: 'Update a comment. The content field accepts HTML for rich text formatting.',
  inputSchema: {
    type: 'object',
    properties: {
      cardPublicId: { type: 'string' },
      publicId: { type: 'string' },
      content: { 
        type: 'string',
        description: 'HTML content. Use <p> for paragraphs, <br> for line breaks, <a href="...">link</a> for links. Plain text with \n will NOT render correctly.'
      },
    },
    required: ['cardPublicId', 'publicId', 'content'],
  },
  handler: async (client: KanClient, input: CommentUpdateInput): Promise<ToolResult<Comment>> => {
    try {
      assertString(input.cardPublicId, 'cardPublicId');
      assertString(input.publicId, 'publicId');
      assertString(input.content, 'content');
      const body: Record<string, unknown> = {
        comment: sanitizeHtml(input.content),
      };
      const data = await client.request<Comment>(`${ROUTES.CARDS}/${input.cardPublicId}/comments/${input.publicId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const commentDeleteTool: Tool<CommentDeleteInput, { success: boolean }> = {
  name: 'comment.delete',
  description: 'Delete a comment',
  inputSchema: {
    type: 'object',
    properties: {
      cardPublicId: { type: 'string' },
      publicId: { type: 'string' },
    },
    required: ['cardPublicId', 'publicId'],
  },
  handler: async (client: KanClient, input: CommentDeleteInput): Promise<ToolResult<{ success: boolean }>> => {
    try {
      assertString(input.cardPublicId, 'cardPublicId');
      assertString(input.publicId, 'publicId');
      await client.request(`${ROUTES.CARDS}/${input.cardPublicId}/comments/${input.publicId}`, {
        method: 'DELETE',
      });
      return success({ success: true });
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};
