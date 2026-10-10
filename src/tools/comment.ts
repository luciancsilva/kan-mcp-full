import { ROUTES } from '../types';
import { assertString, sanitizeHtml } from '../utils';
import { defineTool } from './tool';

const CONTENT_HELP =
  'HTML content. Use <p> for paragraphs, <br> for line breaks, <a href="...">link</a> for links. Plain text with \n will NOT render correctly.';

export const commentAddTool = defineTool<{ cardPublicId: string; content: string }, unknown>({
  name: 'comment.add',
  description: 'Add a comment to a card. The content field accepts HTML for rich text formatting.',
  properties: { cardPublicId: { type: 'string' }, content: { type: 'string', description: CONTENT_HELP } },
  required: ['cardPublicId', 'content'],
  run: async (client, input) => {
    assertString(input.cardPublicId, 'cardPublicId');
    assertString(input.content, 'content');
    return client.request(`${ROUTES.CARDS}/${input.cardPublicId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment: sanitizeHtml(input.content) }),
    });
  },
});

export const commentUpdateTool = defineTool<
  { cardPublicId: string; publicId: string; content: string },
  unknown
>({
  name: 'comment.update',
  description: 'Update a comment. The content field accepts HTML for rich text formatting.',
  properties: {
    cardPublicId: { type: 'string' },
    publicId: { type: 'string' },
    content: { type: 'string', description: CONTENT_HELP },
  },
  required: ['cardPublicId', 'publicId', 'content'],
  run: async (client, input) => {
    assertString(input.cardPublicId, 'cardPublicId');
    assertString(input.publicId, 'publicId');
    assertString(input.content, 'content');
    return client.request(`${ROUTES.CARDS}/${input.cardPublicId}/comments/${input.publicId}`, {
      method: 'PUT',
      body: JSON.stringify({ comment: sanitizeHtml(input.content) }),
    });
  },
});

export const commentDeleteTool = defineTool<{ cardPublicId: string; publicId: string }, unknown>({
  name: 'comment.delete',
  description: 'Delete a comment.',
  properties: { cardPublicId: { type: 'string' }, publicId: { type: 'string' } },
  required: ['cardPublicId', 'publicId'],
  run: async (client, input) => {
    assertString(input.cardPublicId, 'cardPublicId');
    assertString(input.publicId, 'publicId');
    return client.request(`${ROUTES.CARDS}/${input.cardPublicId}/comments/${input.publicId}`, {
      method: 'DELETE',
    });
  },
});
