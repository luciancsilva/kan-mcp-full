import { ROUTES, VISIBILITY, type Visibility } from '../types';
import { assertString, assertOptionalString } from '../utils';
import { defineTool, appendArray, withQuery } from './tool';

export const DUE_DATE_FILTERS = ['overdue', 'today', 'tomorrow', 'next-week', 'next-month', 'no-due-date'] as const;
export type DueDateFilter = (typeof DUE_DATE_FILTERS)[number];
type BoardType = 'regular' | 'template';

const filterProperties = {
  members: { type: 'array', items: { type: 'string' }, description: 'Only cards with these members (workspace member public IDs).' },
  labels: { type: 'array', items: { type: 'string' }, description: 'Only cards with these labels.' },
  lists: { type: 'array', items: { type: 'string' }, description: 'Only these lists.' },
  dueDateFilters: { type: 'array', items: { type: 'string', enum: [...DUE_DATE_FILTERS] } },
};

interface BoardFilters {
  members?: string[];
  labels?: string[];
  lists?: string[];
  dueDateFilters?: DueDateFilter[];
}

function filterParams(input: BoardFilters & { type?: BoardType }): URLSearchParams {
  const params = new URLSearchParams();
  appendArray(params, 'members', input.members);
  appendArray(params, 'labels', input.labels);
  appendArray(params, 'lists', input.lists);
  appendArray(params, 'dueDateFilters', input.dueDateFilters);
  if (input.type) params.set('type', input.type);
  return params;
}

export const boardListTool = defineTool<
  { workspacePublicId: string; type?: BoardType; archived?: boolean },
  unknown
>({
  name: 'board.list',
  description: 'List the boards of a workspace, with their lists and labels.',
  properties: {
    workspacePublicId: { type: 'string' },
    type: { type: 'string', enum: ['regular', 'template'] },
    archived: { type: 'boolean' },
  },
  required: ['workspacePublicId'],
  run: async (client, input) => {
    assertString(input.workspacePublicId, 'workspacePublicId');
    const params = new URLSearchParams();
    if (input.type) params.set('type', input.type);
    if (input.archived !== undefined) params.set('archived', String(input.archived));
    return client.request(withQuery(`${ROUTES.WORKSPACES}/${input.workspacePublicId}/boards`, params));
  },
});

export const boardFindByNameTool = defineTool<{ workspacePublicId: string; name: string }, unknown>({
  name: 'board.findByName',
  description: 'Find a board by name (case-insensitive) inside a workspace.',
  properties: { workspacePublicId: { type: 'string' }, name: { type: 'string' } },
  required: ['workspacePublicId', 'name'],
  run: async (client, input) => {
    assertString(input.workspacePublicId, 'workspacePublicId');
    assertString(input.name, 'name');
    const boards = await client.request<{ name: string }[]>(
      `${ROUTES.WORKSPACES}/${input.workspacePublicId}/boards`
    );
    const found = boards.find((b) => b.name.toLowerCase() === input.name.toLowerCase());
    if (!found) {
      throw new Error(
        `No board found with name "${input.name}". Available boards: ${boards.map((b) => b.name).join(', ')}`
      );
    }
    return found;
  },
});

export const boardCreateTool = defineTool<
  {
    workspacePublicId: string;
    name: string;
    lists?: string[];
    labels?: string[];
    type?: BoardType;
    sourceBoardPublicId?: string;
    slug?: string;
    visibility?: Visibility;
  },
  unknown
>({
  name: 'board.create',
  description:
    'Create a board in a workspace, optionally with initial lists and labels (names) or from a template board (sourceBoardPublicId). slug and visibility are applied right after creation.',
  properties: {
    workspacePublicId: { type: 'string' },
    name: { type: 'string' },
    lists: { type: 'array', items: { type: 'string' }, description: 'Names of the initial lists.' },
    labels: { type: 'array', items: { type: 'string' }, description: 'Names of the initial labels.' },
    type: { type: 'string', enum: ['regular', 'template'] },
    sourceBoardPublicId: { type: 'string' },
    slug: { type: 'string' },
    visibility: { type: 'string', enum: [...VISIBILITY] },
  },
  required: ['workspacePublicId', 'name'],
  run: async (client, input) => {
    assertString(input.workspacePublicId, 'workspacePublicId');
    assertString(input.name, 'name');
    assertOptionalString(input.slug, 'slug');
    const body: Record<string, unknown> = {
      name: input.name,
      lists: input.lists ?? [],
      labels: input.labels ?? [],
    };
    if (input.type) body.type = input.type;
    if (input.sourceBoardPublicId) body.sourceBoardPublicId = input.sourceBoardPublicId;
    const created = await client.request<{ publicId: string; name: string }>(
      `${ROUTES.WORKSPACES}/${input.workspacePublicId}/boards`,
      { method: 'POST', body: JSON.stringify(body) }
    );
    const wanted: Record<string, unknown> = {};
    if (input.slug !== undefined) wanted.slug = input.slug;
    if (input.visibility !== undefined) wanted.visibility = input.visibility;
    if (Object.keys(wanted).length === 0) return created;

    // Kan generates a slug from the name and rejects re-setting a slug a board already has,
    // so only the fields that differ from the created board are updated.
    const current = await client.request<{ slug?: string; visibility?: string }>(
      `${ROUTES.BOARDS}/${created.publicId}`
    );
    const changes = Object.fromEntries(
      Object.entries(wanted).filter(([key, value]) => (current as Record<string, unknown>)[key] !== value)
    );
    if (Object.keys(changes).length > 0) {
      try {
        await client.request(`${ROUTES.BOARDS}/${created.publicId}`, {
          method: 'PUT',
          body: JSON.stringify(changes),
        });
      } catch (err) {
        throw new Error(
          `Board created (publicId ${created.publicId}) but applying ${Object.keys(changes).join(' and ')} failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    return { ...created, ...wanted };
  },
});

export const boardGetByIdTool = defineTool<BoardFilters & { publicId: string; type?: BoardType }, unknown>({
  name: 'board.getById',
  description:
    'Get a board by public ID with its lists and cards. Optional filters narrow the cards (by member, label, list or due date).',
  properties: {
    publicId: { type: 'string' },
    ...filterProperties,
    type: { type: 'string', enum: ['regular', 'template'] },
  },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    return client.request(withQuery(`${ROUTES.BOARDS}/${input.publicId}`, filterParams(input)));
  },
});

export const boardGetBySlugTool = defineTool<
  BoardFilters & { workspaceSlug: string; boardSlug: string },
  unknown
>({
  name: 'board.getBySlug',
  description: 'Get a PUBLIC board by workspace slug and board slug, with its lists and cards (Kan returns nothing for private boards; use board.getById for those). Accepts the same card filters as board.getById.',
  properties: {
    workspaceSlug: { type: 'string' },
    boardSlug: { type: 'string' },
    ...filterProperties,
  },
  required: ['workspaceSlug', 'boardSlug'],
  run: async (client, input) => {
    assertString(input.workspaceSlug, 'workspaceSlug');
    assertString(input.boardSlug, 'boardSlug');
    const path = `${ROUTES.WORKSPACES}/${encodeURIComponent(input.workspaceSlug)}/boards/${encodeURIComponent(input.boardSlug)}`;
    const board = await client.request<unknown>(withQuery(path, filterParams(input)));
    if (board === null) {
      throw new Error(
        `Board "${input.boardSlug}" not found in workspace "${input.workspaceSlug}", or it is private. Kan only serves public boards by slug; use board.getById for private ones.`
      );
    }
    return board;
  },
});

export const boardUpdateTool = defineTool<
  {
    publicId: string;
    name?: string;
    slug?: string;
    visibility?: Visibility;
    favorite?: boolean;
    isArchived?: boolean;
  },
  unknown
>({
  name: 'board.update',
  description: 'Update a board: name, slug, visibility, favorite or archived state.',
  properties: {
    publicId: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    visibility: { type: 'string', enum: [...VISIBILITY] },
    favorite: { type: 'boolean' },
    isArchived: { type: 'boolean' },
  },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    const { publicId, ...fields } = input;
    return client.request(`${ROUTES.BOARDS}/${publicId}`, { method: 'PUT', body: JSON.stringify(fields) });
  },
});

export const boardDeleteTool = defineTool<{ publicId: string }, unknown>({
  name: 'board.delete',
  description: 'Delete a board.',
  properties: { publicId: { type: 'string' } },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    return client.request(`${ROUTES.BOARDS}/${input.publicId}`, { method: 'DELETE' });
  },
});

export const boardCheckSlugAvailabilityTool = defineTool<{ boardPublicId: string; slug: string }, unknown>({
  name: 'board.checkSlugAvailability',
  description: 'Check whether a slug can be used for the given board (isReserved tells if it is reserved).',
  properties: { boardPublicId: { type: 'string' }, slug: { type: 'string' } },
  required: ['boardPublicId', 'slug'],
  run: async (client, input) => {
    assertString(input.boardPublicId, 'boardPublicId');
    assertString(input.slug, 'slug');
    const params = new URLSearchParams({ boardSlug: input.slug });
    return client.request(withQuery(`${ROUTES.BOARDS}/${input.boardPublicId}/check-slug-availability`, params));
  },
});
