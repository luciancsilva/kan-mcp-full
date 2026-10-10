import { KanClient } from '../client';
import { Checklist, ChecklistItem, ToolResult, ROUTES } from '../types';
import { success, error, assertString, assertOptionalString, assertBoolean } from '../utils';
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

interface ChecklistCreateInput {
  cardPublicId: string;
  name: string;
}

interface ChecklistUpdateInput {
  publicId: string;
  name?: string;
}

interface ChecklistDeleteInput {
  publicId: string;
}

interface ChecklistAddItemInput {
  checklistPublicId: string;
  title: string;
}

interface ChecklistUpdateItemInput {
  publicId: string;
  title?: string;
  completed?: boolean;
}

interface ChecklistDeleteItemInput {
  publicId: string;
}

export const checklistCreateTool: Tool<ChecklistCreateInput, Checklist> = {
  name: 'checklist.create',
  description: 'Create a new checklist on a card',
  inputSchema: {
    type: 'object',
    properties: {
      cardPublicId: { type: 'string' },
      name: { type: 'string' },
    },
    required: ['cardPublicId', 'name'],
  },
  handler: async (client: KanClient, input: ChecklistCreateInput): Promise<ToolResult<Checklist>> => {
    try {
      assertString(input.cardPublicId, 'cardPublicId');
      assertString(input.name, 'name');
      const body: Record<string, unknown> = {
        name: input.name,
      };
      const data = await client.request<Checklist>(`${ROUTES.CARDS}/${input.cardPublicId}/checklists`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const checklistUpdateTool: Tool<ChecklistUpdateInput, Checklist> = {
  name: 'checklist.update',
  description: 'Update a checklist',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
      name: { type: 'string' },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: ChecklistUpdateInput): Promise<ToolResult<Checklist>> => {
    try {
      assertString(input.publicId, 'publicId');
      assertOptionalString(input.name, 'name');
      const body: Record<string, unknown> = {};
      if (input.name !== undefined) body.name = input.name;
      const data = await client.request<Checklist>(`${ROUTES.CHECKLISTS}/${input.publicId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const checklistDeleteTool: Tool<ChecklistDeleteInput, { success: boolean }> = {
  name: 'checklist.delete',
  description: 'Delete a checklist',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: ChecklistDeleteInput): Promise<ToolResult<{ success: boolean }>> => {
    try {
      assertString(input.publicId, 'publicId');
      await client.request(`${ROUTES.CHECKLISTS}/${input.publicId}`, {
        method: 'DELETE',
      });
      return success({ success: true });
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const checklistAddItemTool: Tool<ChecklistAddItemInput, ChecklistItem> = {
  name: 'checklist.addItem',
  description: 'Add an item to a checklist',
  inputSchema: {
    type: 'object',
    properties: {
      checklistPublicId: { type: 'string' },
      title: { type: 'string' },
    },
    required: ['checklistPublicId', 'title'],
  },
  handler: async (client: KanClient, input: ChecklistAddItemInput): Promise<ToolResult<ChecklistItem>> => {
    try {
      assertString(input.checklistPublicId, 'checklistPublicId');
      assertString(input.title, 'title');
      const body: Record<string, unknown> = {
        title: input.title,
      };
      const data = await client.request<ChecklistItem>(
        `${ROUTES.CHECKLISTS}/${input.checklistPublicId}/items`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      );
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const checklistUpdateItemTool: Tool<ChecklistUpdateItemInput, ChecklistItem> = {
  name: 'checklist.updateItem',
  description: 'Update a checklist item',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
      title: { type: 'string' },
      completed: { type: 'boolean' },
    },
    required: ['publicId'],
  },
  handler: async (
    client: KanClient,
    input: ChecklistUpdateItemInput
  ): Promise<ToolResult<ChecklistItem>> => {
    try {
      assertString(input.publicId, 'publicId');
      assertOptionalString(input.title, 'title');
      if (input.completed !== undefined) {
        assertBoolean(input.completed, 'completed');
      }
      const body: Record<string, unknown> = {};
      if (input.title !== undefined) body.title = input.title;
      if (input.completed !== undefined) body.completed = input.completed;
      const data = await client.request<ChecklistItem>(`${ROUTES.CHECKLISTS}/items/${input.publicId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const checklistDeleteItemTool: Tool<ChecklistDeleteItemInput, { success: boolean }> = {
  name: 'checklist.deleteItem',
  description: 'Delete a checklist item',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
    },
    required: ['publicId'],
  },
  handler: async (
    client: KanClient,
    input: ChecklistDeleteItemInput
  ): Promise<ToolResult<{ success: boolean }>> => {
    try {
      assertString(input.publicId, 'publicId');
      await client.request(`${ROUTES.CHECKLISTS}/items/${input.publicId}`, {
        method: 'DELETE',
      });
      return success({ success: true });
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};
