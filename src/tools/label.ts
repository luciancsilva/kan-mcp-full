import { ROUTES } from '../types';
import { assertString, assertOptionalString } from '../utils';
import { defineTool } from './tool';

interface LabelData {
  publicId: string;
  name: string;
  colourCode: string | null;
}

export const labelCreateTool = defineTool<{ boardPublicId: string; name: string; colourCode: string }, LabelData>({
  name: 'label.create',
  description: 'Create a label in a board. colourCode is a hex color such as #ff0000.',
  properties: { boardPublicId: { type: 'string' }, name: { type: 'string' }, colourCode: { type: 'string' } },
  required: ['boardPublicId', 'name', 'colourCode'],
  run: async (client, input) => {
    assertString(input.boardPublicId, 'boardPublicId');
    assertString(input.name, 'name');
    assertString(input.colourCode, 'colourCode');
    return client.request<LabelData>(ROUTES.LABELS, {
      method: 'POST',
      body: JSON.stringify({
        boardPublicId: input.boardPublicId,
        name: input.name,
        colourCode: input.colourCode,
      }),
    });
  },
});

export const labelGetByIdTool = defineTool<{ publicId: string }, LabelData>({
  name: 'label.getById',
  description: 'Get a label by public ID.',
  properties: { publicId: { type: 'string' } },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    return client.request<LabelData>(`${ROUTES.LABELS}/${input.publicId}`);
  },
});

export const labelUpdateTool = defineTool<{ publicId: string; name?: string; colourCode?: string }, LabelData>({
  name: 'label.update',
  description: 'Update the name and/or color of a label (the fields left out keep their current value).',
  properties: { publicId: { type: 'string' }, name: { type: 'string' }, colourCode: { type: 'string' } },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    assertOptionalString(input.name, 'name');
    assertOptionalString(input.colourCode, 'colourCode');
    // Kan's PUT requires both fields, so a partial update completes them from the current label.
    const path = `${ROUTES.LABELS}/${input.publicId}`;
    const current =
      input.name === undefined || input.colourCode === undefined
        ? await client.request<LabelData>(path)
        : undefined;
    return client.request<LabelData>(path, {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name ?? current?.name,
        colourCode: input.colourCode ?? current?.colourCode ?? '#000000',
      }),
    });
  },
});

export const labelDeleteTool = defineTool<{ publicId: string }, unknown>({
  name: 'label.delete',
  description: 'Delete a label.',
  properties: { publicId: { type: 'string' } },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    return client.request(`${ROUTES.LABELS}/${input.publicId}`, { method: 'DELETE' });
  },
});
