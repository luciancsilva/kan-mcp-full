import { ROUTES } from '../types';
import { assertString, assertOptionalString } from '../utils';
import { defineTool } from './tool';

export const checklistCreateTool = defineTool<{ cardPublicId: string; name: string }, unknown>({
  name: 'checklist.create',
  description: 'Add a checklist to a card.',
  properties: { cardPublicId: { type: 'string' }, name: { type: 'string' } },
  required: ['cardPublicId', 'name'],
  run: async (client, input) => {
    assertString(input.cardPublicId, 'cardPublicId');
    assertString(input.name, 'name');
    return client.request(`${ROUTES.CARDS}/${input.cardPublicId}/checklists`, {
      method: 'POST',
      body: JSON.stringify({ name: input.name }),
    });
  },
});

export const checklistUpdateTool = defineTool<{ publicId: string; name: string }, unknown>({
  name: 'checklist.update',
  description: 'Rename a checklist.',
  properties: { publicId: { type: 'string' }, name: { type: 'string' } },
  required: ['publicId', 'name'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    assertString(input.name, 'name');
    return client.request(`${ROUTES.CHECKLISTS}/${input.publicId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: input.name }),
    });
  },
});

export const checklistDeleteTool = defineTool<{ publicId: string }, unknown>({
  name: 'checklist.delete',
  description: 'Delete a checklist.',
  properties: { publicId: { type: 'string' } },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    return client.request(`${ROUTES.CHECKLISTS}/${input.publicId}`, { method: 'DELETE' });
  },
});

export const checklistAddItemTool = defineTool<{ checklistPublicId: string; title: string }, unknown>({
  name: 'checklist.addItem',
  description: 'Add an item to a checklist.',
  properties: { checklistPublicId: { type: 'string' }, title: { type: 'string' } },
  required: ['checklistPublicId', 'title'],
  run: async (client, input) => {
    assertString(input.checklistPublicId, 'checklistPublicId');
    assertString(input.title, 'title');
    return client.request(`${ROUTES.CHECKLISTS}/${input.checklistPublicId}/items`, {
      method: 'POST',
      body: JSON.stringify({ title: input.title }),
    });
  },
});

export const checklistUpdateItemTool = defineTool<
  { publicId: string; title?: string; completed?: boolean; index?: number },
  unknown
>({
  name: 'checklist.updateItem',
  description: 'Update a checklist item: title, completed state or position (index).',
  properties: {
    publicId: { type: 'string' },
    title: { type: 'string' },
    completed: { type: 'boolean' },
    index: { type: 'number' },
  },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    assertOptionalString(input.title, 'title');
    const { publicId, ...fields } = input;
    return client.request(`${ROUTES.CHECKLISTS}/items/${publicId}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
  },
});

export const checklistDeleteItemTool = defineTool<{ publicId: string }, unknown>({
  name: 'checklist.deleteItem',
  description: 'Delete a checklist item.',
  properties: { publicId: { type: 'string' } },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    return client.request(`${ROUTES.CHECKLISTS}/items/${input.publicId}`, { method: 'DELETE' });
  },
});
