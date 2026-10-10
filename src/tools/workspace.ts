import { KanClient } from '../client';
import { Workspace, ToolResult, Board, Card } from '../types';
import { success, error, assertString, assertOptionalString } from '../utils';
import { toMcpError } from '../errors';
import { ROUTES } from '../types';

export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  handler: (client: KanClient, input: TInput) => Promise<ToolResult<TOutput>>;
}

interface WorkspaceListInput {
  limit?: number;
  offset?: number;
}

interface WorkspaceCreateInput {
  name: string;
  slug: string;
  description?: string;
}

interface WorkspaceGetByIdInput {
  publicId: string;
}

interface WorkspaceGetBySlugInput {
  slug: string;
}

interface WorkspaceUpdateInput {
  publicId: string;
  name?: string;
  description?: string;
  showEmailsToMembers?: boolean;
  weekStartDay?: string;
}

interface WorkspaceDeleteInput {
  publicId: string;
}

interface WorkspaceSearchInput {
  query: string;
}

interface WorkspaceCheckSlugInput {
  slug: string;
}

interface SearchResult {
  boards: Board[];
  cards: Card[];
}

export const workspaceListTool: Tool<WorkspaceListInput, Workspace[]> = {
  name: 'workspace.list',
  description: 'Get all workspaces',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number' },
      offset: { type: 'number' },
    },
    required: [],
  },
  handler: async (client: KanClient, input: WorkspaceListInput): Promise<ToolResult<Workspace[]>> => {
    try {
      const queryParams = new URLSearchParams();
      if (input.limit !== undefined) queryParams.set('limit', String(input.limit));
      if (input.offset !== undefined) queryParams.set('offset', String(input.offset));
      const query = queryParams.toString();
      const path = `${ROUTES.WORKSPACES}${query ? `?${query}` : ''}`;
      const data = await client.request<Workspace[]>(path);
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const workspaceCreateTool: Tool<WorkspaceCreateInput, Workspace> = {
  name: 'workspace.create',
  description: 'Create a new workspace',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['name', 'slug'],
  },
  handler: async (client: KanClient, input: WorkspaceCreateInput): Promise<ToolResult<Workspace>> => {
    try {
      assertString(input.name, 'name');
      assertString(input.slug, 'slug');
      assertOptionalString(input.description, 'description');
      const data = await client.request<Workspace>(ROUTES.WORKSPACES, {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          slug: input.slug,
          description: input.description,
        }),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const workspaceGetByIdTool: Tool<WorkspaceGetByIdInput, Workspace> = {
  name: 'workspace.getById',
  description: 'Get workspace by public ID',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: WorkspaceGetByIdInput): Promise<ToolResult<Workspace>> => {
    try {
      assertString(input.publicId, 'publicId');
      const data = await client.request<Workspace>(`${ROUTES.WORKSPACES}/${input.publicId}`);
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const workspaceGetBySlugTool: Tool<WorkspaceGetBySlugInput, Workspace> = {
  name: 'workspace.getBySlug',
  description: 'Get workspace by slug',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string' },
    },
    required: ['slug'],
  },
  handler: async (client: KanClient, input: WorkspaceGetBySlugInput): Promise<ToolResult<Workspace>> => {
    try {
      assertString(input.slug, 'slug');
      const data = await client.request<Workspace>(`${ROUTES.WORKSPACES}/slug/${input.slug}`);
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const workspaceUpdateTool: Tool<WorkspaceUpdateInput, Workspace> = {
  name: 'workspace.update',
  description: 'Update a workspace',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      showEmailsToMembers: { type: 'boolean' },
      weekStartDay: { type: 'string' },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: WorkspaceUpdateInput): Promise<ToolResult<Workspace>> => {
    try {
      assertString(input.publicId, 'publicId');
      assertOptionalString(input.name, 'name');
      assertOptionalString(input.description, 'description');
      assertOptionalString(input.weekStartDay, 'weekStartDay');
      const body: Record<string, unknown> = {};
      if (input.name !== undefined) body.name = input.name;
      if (input.description !== undefined) body.description = input.description;
      if (input.showEmailsToMembers !== undefined) body.showEmailsToMembers = input.showEmailsToMembers;
      if (input.weekStartDay !== undefined) body.weekStartDay = input.weekStartDay;
      const data = await client.request<Workspace>(`${ROUTES.WORKSPACES}/${input.publicId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const workspaceDeleteTool: Tool<WorkspaceDeleteInput, { success: boolean }> = {
  name: 'workspace.delete',
  description: 'Delete a workspace',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: WorkspaceDeleteInput): Promise<ToolResult<{ success: boolean }>> => {
    try {
      assertString(input.publicId, 'publicId');
      await client.request(`${ROUTES.WORKSPACES}/${input.publicId}`, {
        method: 'DELETE',
      });
      return success({ success: true });
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const workspaceSearchTool: Tool<WorkspaceSearchInput, SearchResult> = {
  name: 'workspace.search',
  description: 'Search boards and cards within a workspace',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
    },
    required: ['query'],
  },
  handler: async (client: KanClient, input: WorkspaceSearchInput): Promise<ToolResult<SearchResult>> => {
    try {
      assertString(input.query, 'query');
      const queryParams = new URLSearchParams({ q: input.query });
      const data = await client.request<SearchResult>(`${ROUTES.WORKSPACES}/search?${queryParams}`);
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const workspaceCheckSlugAvailabilityTool: Tool<WorkspaceCheckSlugInput, { available: boolean }> = {
  name: 'workspace.checkSlugAvailability',
  description: 'Check if a workspace slug is available',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string' },
    },
    required: ['slug'],
  },
  handler: async (
    client: KanClient,
    input: WorkspaceCheckSlugInput
  ): Promise<ToolResult<{ available: boolean }>> => {
    try {
      assertString(input.slug, 'slug');
      const queryParams = new URLSearchParams({ slug: input.slug });
      const data = await client.request<{ available: boolean }>(
        `${ROUTES.WORKSPACES}/slug-available?${queryParams}`
      );
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};
