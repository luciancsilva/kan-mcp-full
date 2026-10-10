import { KanClient } from '../client';
import { List, ToolResult, ROUTES } from '../types';
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

interface ListCreateInput {
  boardPublicId: string;
  name: string;
}

interface ListUpdateInput {
  publicId: string;
  name?: string;
  index?: number;
}

interface ListDeleteInput {
  publicId: string;
}

export const listCreateTool: Tool<ListCreateInput, List> = {
  name: 'list.create',
  description: 'Create a new list',
  inputSchema: {
    type: 'object',
    properties: {
      boardPublicId: { type: 'string' },
      name: { type: 'string' },
    },
    required: ['boardPublicId', 'name'],
  },
  handler: async (client: KanClient, input: ListCreateInput): Promise<ToolResult<List>> => {
    try {
      assertString(input.boardPublicId, 'boardPublicId');
      assertString(input.name, 'name');
      const data = await client.request<List>(ROUTES.LISTS, {
        method: 'POST',
        body: JSON.stringify({
          boardPublicId: input.boardPublicId,
          name: input.name,
        }),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const listUpdateTool: Tool<ListUpdateInput, List> = {
  name: 'list.update',
  description: 'Update a list',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
      name: { type: 'string' },
      index: { type: 'number' },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: ListUpdateInput): Promise<ToolResult<List>> => {
    try {
      assertString(input.publicId, 'publicId');
      assertOptionalString(input.name, 'name');
      const body: Record<string, unknown> = {};
      if (input.name !== undefined) body.name = input.name;
      if (input.index !== undefined) body.index = input.index;
      const data = await client.request<List>(`${ROUTES.LISTS}/${input.publicId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const listDeleteTool: Tool<ListDeleteInput, { success: boolean }> = {
  name: 'list.delete',
  description: 'Delete a list',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: ListDeleteInput): Promise<ToolResult<{ success: boolean }>> => {
    try {
      assertString(input.publicId, 'publicId');
      await client.request(`${ROUTES.LISTS}/${input.publicId}`, {
        method: 'DELETE',
      });
      return success({ success: true });
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};
