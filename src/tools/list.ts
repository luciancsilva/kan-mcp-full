import { ROUTES } from '../types';
import { assertString, assertOptionalString } from '../utils';
import { defineTool } from './tool';

export const listCreateTool = defineTool<{ boardPublicId: string; name: string }, unknown>({
  name: 'list.create',
  description: 'Create a list (column) in a board.',
  properties: { boardPublicId: { type: 'string' }, name: { type: 'string' } },
  required: ['boardPublicId', 'name'],
  run: async (client, input) => {
    assertString(input.boardPublicId, 'boardPublicId');
    assertString(input.name, 'name');
    return client.request(ROUTES.LISTS, {
      method: 'POST',
      body: JSON.stringify({ boardPublicId: input.boardPublicId, name: input.name }),
    });
  },
});

export const listUpdateTool = defineTool<{ publicId: string; name?: string; index?: number }, unknown>({
  name: 'list.update',
  description: 'Rename a list or change its position (index) in the board.',
  properties: { publicId: { type: 'string' }, name: { type: 'string' }, index: { type: 'number' } },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    assertOptionalString(input.name, 'name');
    const body: Record<string, unknown> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.index !== undefined) body.index = input.index;
    return client.request(`${ROUTES.LISTS}/${input.publicId}`, { method: 'PUT', body: JSON.stringify(body) });
  },
});

export const listDeleteTool = defineTool<{ publicId: string }, unknown>({
  name: 'list.delete',
  description: 'Delete a list.',
  properties: { publicId: { type: 'string' } },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    return client.request(`${ROUTES.LISTS}/${input.publicId}`, { method: 'DELETE' });
  },
});
