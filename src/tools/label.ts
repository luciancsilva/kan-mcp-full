import { KanClient } from '../client';
import { Label, ToolResult, ROUTES } from '../types';
import { success, error, assertString, assertOptionalString } from '../utils';
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

interface LabelCreateInput {
  boardPublicId: string;
  name: string;
  colourCode: string;
}

interface LabelGetByIdInput {
  publicId: string;
}

interface LabelUpdateInput {
  publicId: string;
  name?: string;
  colourCode?: string;
}

interface LabelDeleteInput {
  publicId: string;
}

export const labelCreateTool: Tool<LabelCreateInput, Label> = {
  name: 'label.create',
  description: 'Create a new label',
  inputSchema: {
    type: 'object',
    properties: {
      boardPublicId: { type: 'string' },
      name: { type: 'string' },
      colourCode: { type: 'string' },
    },
    required: ['boardPublicId', 'name', 'colourCode'],
  },
  handler: async (client: KanClient, input: LabelCreateInput): Promise<ToolResult<Label>> => {
    try {
      assertString(input.boardPublicId, 'boardPublicId');
      assertString(input.name, 'name');
      assertString(input.colourCode, 'colourCode');
      const body: Record<string, unknown> = {
        boardPublicId: input.boardPublicId,
        name: input.name,
        colourCode: input.colourCode,
      };
      const data = await client.request<Label>(ROUTES.LABELS, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const labelGetByIdTool: Tool<LabelGetByIdInput, Label> = {
  name: 'label.getById',
  description: 'Get label by public ID',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: LabelGetByIdInput): Promise<ToolResult<Label>> => {
    try {
      assertString(input.publicId, 'publicId');
      const data = await client.request<Label>(`${ROUTES.LABELS}/${input.publicId}`);
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const labelUpdateTool: Tool<LabelUpdateInput, Label> = {
  name: 'label.update',
  description: 'Update a label',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
      name: { type: 'string' },
      colourCode: { type: 'string' },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: LabelUpdateInput): Promise<ToolResult<Label>> => {
    try {
      assertString(input.publicId, 'publicId');
      assertOptionalString(input.name, 'name');
      assertOptionalString(input.colourCode, 'colourCode');
      const body: Record<string, unknown> = {};
      if (input.name !== undefined) body.name = input.name;
      if (input.colourCode !== undefined) body.colourCode = input.colourCode;
      const data = await client.request<Label>(`${ROUTES.LABELS}/${input.publicId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const labelDeleteTool: Tool<LabelDeleteInput, { success: boolean }> = {
  name: 'label.delete',
  description: 'Delete a label',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: LabelDeleteInput): Promise<ToolResult<{ success: boolean }>> => {
    try {
      assertString(input.publicId, 'publicId');
      await client.request(`${ROUTES.LABELS}/${input.publicId}`, {
        method: 'DELETE',
      });
      return success({ success: true });
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};
