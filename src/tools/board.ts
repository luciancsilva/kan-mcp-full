import { KanClient } from '../client';
import { Board, Visibility, ToolResult, ROUTES } from '../types';
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

interface BoardListInput {
  workspacePublicId?: string;
  visibility?: Visibility;
}

interface BoardCreateInput {
  workspacePublicId: string;
  name: string;
  slug: string;
  visibility: Visibility;
}

interface BoardGetByIdInput {
  publicId: string;
  members?: string[];
  labels?: string[];
  lists?: string[];
  dueDateFilters?: DueDateFilter[];
  type?: 'regular' | 'template';
}

interface BoardGetBySlugInput {
  workspacePublicId: string;
  slug: string;
  members?: string[];
  labels?: string[];
  lists?: string[];
  dueDateFilters?: DueDateFilter[];
  type?: 'regular' | 'template';
}

interface BoardUpdateInput {
  publicId: string;
  name?: string;
  visibility?: Visibility;
}

interface BoardDeleteInput {
  publicId: string;
}

interface BoardCheckSlugInput {
  workspacePublicId: string;
  slug: string;
}

export const DUE_DATE_FILTERS = ['overdue', 'today', 'tomorrow', 'next-week', 'next-month', 'no-due-date'] as const;
export type DueDateFilter = (typeof DUE_DATE_FILTERS)[number];

export const boardListTool: Tool<BoardListInput, Board[]> = {
  name: 'board.list',
  description: 'Get all boards',
  inputSchema: {
    type: 'object',
    properties: {
      workspacePublicId: { type: 'string' },
      visibility: { type: 'string', enum: ['public', 'private'] },
    },
    required: [],
  },
  handler: async (client: KanClient, input: BoardListInput): Promise<ToolResult<Board[]>> => {
    try {
      const queryParams = new URLSearchParams();
      if (input.workspacePublicId) queryParams.set('workspacePublicId', input.workspacePublicId);
      if (input.visibility) queryParams.set('visibility', input.visibility);
      const query = queryParams.toString();
      const path = `${ROUTES.BOARDS}${query ? `?${query}` : ''}`;
      const data = await client.request<Board[]>(path);
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const boardCreateTool: Tool<BoardCreateInput, Board> = {
  name: 'board.create',
  description: 'Create a new board',
  inputSchema: {
    type: 'object',
    properties: {
      workspacePublicId: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      visibility: { type: 'string', enum: ['public', 'private'] },
    },
    required: ['workspacePublicId', 'name', 'slug', 'visibility'],
  },
  handler: async (client: KanClient, input: BoardCreateInput): Promise<ToolResult<Board>> => {
    try {
      assertString(input.workspacePublicId, 'workspacePublicId');
      assertString(input.name, 'name');
      assertString(input.slug, 'slug');
      assertString(input.visibility, 'visibility');
      const data = await client.request<Board>(ROUTES.BOARDS, {
        method: 'POST',
        body: JSON.stringify({
          workspacePublicId: input.workspacePublicId,
          name: input.name,
          slug: input.slug,
          visibility: input.visibility,
        }),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const boardGetByIdTool: Tool<BoardGetByIdInput, Board> = {
  name: 'board.getById',
  description: 'Get board by public ID',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
      members: { type: 'array', items: { type: 'string' } },
      labels: { type: 'array', items: { type: 'string' } },
      lists: { type: 'array', items: { type: 'string' } },
      dueDateFilters: { type: 'array', items: { type: 'string', enum: ['overdue', 'today', 'tomorrow', 'next-week', 'next-month', 'no-due-date'] } },
      type: { type: 'string', enum: ['regular', 'template'] },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: BoardGetByIdInput): Promise<ToolResult<Board>> => {
    try {
      assertString(input.publicId, 'publicId');
      const queryParams = new URLSearchParams();
      if (input.members?.length) queryParams.set('members', input.members.join(','));
      if (input.labels?.length) queryParams.set('labels', input.labels.join(','));
      if (input.lists?.length) queryParams.set('lists', input.lists.join(','));
      if (input.dueDateFilters?.length) queryParams.set('dueDateFilters', input.dueDateFilters.join(','));
      if (input.type) queryParams.set('type', input.type);
      const query = queryParams.toString();
      const path = `${ROUTES.BOARDS}/${input.publicId}${query ? `?${query}` : ''}`;
      const data = await client.request<Board>(path);
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const boardGetBySlugTool: Tool<BoardGetBySlugInput, Board> = {
  name: 'board.getBySlug',
  description: 'Get board by slug',
  inputSchema: {
    type: 'object',
    properties: {
      workspacePublicId: { type: 'string' },
      slug: { type: 'string' },
      members: { type: 'array', items: { type: 'string' } },
      labels: { type: 'array', items: { type: 'string' } },
      lists: { type: 'array', items: { type: 'string' } },
      dueDateFilters: { type: 'array', items: { type: 'string', enum: ['overdue', 'today', 'tomorrow', 'next-week', 'next-month', 'no-due-date'] } },
      type: { type: 'string', enum: ['regular', 'template'] },
    },
    required: ['workspacePublicId', 'slug'],
  },
  handler: async (client: KanClient, input: BoardGetBySlugInput): Promise<ToolResult<Board>> => {
    try {
      assertString(input.workspacePublicId, 'workspacePublicId');
      assertString(input.slug, 'slug');
      const queryParams = new URLSearchParams({
        workspacePublicId: input.workspacePublicId,
        slug: input.slug,
      });
      if (input.members?.length) queryParams.set('members', input.members.join(','));
      if (input.labels?.length) queryParams.set('labels', input.labels.join(','));
      if (input.lists?.length) queryParams.set('lists', input.lists.join(','));
      if (input.dueDateFilters?.length) queryParams.set('dueDateFilters', input.dueDateFilters.join(','));
      if (input.type) queryParams.set('type', input.type);
      const data = await client.request<Board>(`${ROUTES.BOARDS}/slug?${queryParams}`);
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const boardUpdateTool: Tool<BoardUpdateInput, Board> = {
  name: 'board.update',
  description: 'Update a board',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
      name: { type: 'string' },
      visibility: { type: 'string', enum: ['public', 'private'] },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: BoardUpdateInput): Promise<ToolResult<Board>> => {
    try {
      assertString(input.publicId, 'publicId');
      assertOptionalString(input.name, 'name');
      assertOptionalString(input.visibility, 'visibility');
      const body: Record<string, unknown> = {};
      if (input.name !== undefined) body.name = input.name;
      if (input.visibility !== undefined) body.visibility = input.visibility;
      const data = await client.request<Board>(`${ROUTES.BOARDS}/${input.publicId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const boardDeleteTool: Tool<BoardDeleteInput, { success: boolean }> = {
  name: 'board.delete',
  description: 'Delete a board',
  inputSchema: {
    type: 'object',
    properties: {
      publicId: { type: 'string' },
    },
    required: ['publicId'],
  },
  handler: async (client: KanClient, input: BoardDeleteInput): Promise<ToolResult<{ success: boolean }>> => {
    try {
      assertString(input.publicId, 'publicId');
      await client.request(`${ROUTES.BOARDS}/${input.publicId}`, {
        method: 'DELETE',
      });
      return success({ success: true });
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};

export const boardCheckSlugAvailabilityTool: Tool<BoardCheckSlugInput, { available: boolean }> = {
  name: 'board.checkSlugAvailability',
  description: 'Check if a board slug is available',
  inputSchema: {
    type: 'object',
    properties: {
      workspacePublicId: { type: 'string' },
      slug: { type: 'string' },
    },
    required: ['workspacePublicId', 'slug'],
  },
  handler: async (
    client: KanClient,
    input: BoardCheckSlugInput
  ): Promise<ToolResult<{ available: boolean }>> => {
    try {
      assertString(input.workspacePublicId, 'workspacePublicId');
      assertString(input.slug, 'slug');
      const queryParams = new URLSearchParams({
        workspacePublicId: input.workspacePublicId,
        slug: input.slug,
      });
      const data = await client.request<{ available: boolean }>(
        `${ROUTES.BOARDS}/slug-available?${queryParams}`
      );
      return success(data);
    } catch (err) {
      return error(toMcpError(err).message);
    }
  },
};
