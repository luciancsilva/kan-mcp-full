import { KanClient } from '../client';
import { ROUTES } from '../types';
import { assertString, assertOptionalString, sanitizeHtml } from '../utils';
import { defineTool, withQuery } from './tool';

const DESCRIPTION_HELP =
  'HTML content. Use <p> for paragraphs, <br> for line breaks, <a href="...">link</a> for links. Plain text with \n will NOT render correctly.';

interface CardData {
  publicId: string;
  labels?: { publicId: string }[];
  members?: { publicId: string }[];
  list?: { publicId: string };
  [key: string]: unknown;
}

export const cardCreateTool = defineTool<
  {
    listPublicId: string;
    title: string;
    description?: string;
    dueDate?: string;
    labelPublicIds?: string[];
    memberPublicIds?: string[];
    position?: 'start' | 'end';
  },
  unknown
>({
  name: 'card.create',
  description:
    'Create a new card in a list. The description field accepts HTML for rich text formatting. position places it at the start (default) or end of the list.',
  properties: {
    listPublicId: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', description: DESCRIPTION_HELP },
    dueDate: { type: 'string', description: 'ISO 8601 date-time.' },
    labelPublicIds: { type: 'array', items: { type: 'string' } },
    memberPublicIds: { type: 'array', items: { type: 'string' }, description: 'Workspace member public IDs.' },
    position: { type: 'string', enum: ['start', 'end'] },
  },
  required: ['listPublicId', 'title'],
  run: async (client, input) => {
    assertString(input.listPublicId, 'listPublicId');
    assertString(input.title, 'title');
    assertOptionalString(input.description, 'description');
    assertOptionalString(input.dueDate, 'dueDate');
    const body: Record<string, unknown> = {
      listPublicId: input.listPublicId,
      title: input.title,
      description: input.description ? sanitizeHtml(input.description) : '',
      labelPublicIds: input.labelPublicIds ?? [],
      memberPublicIds: input.memberPublicIds ?? [],
      position: input.position ?? 'start',
    };
    if (input.dueDate !== undefined) body.dueDate = input.dueDate;
    return client.request(ROUTES.CARDS, { method: 'POST', body: JSON.stringify(body) });
  },
});

export const cardGetByIdTool = defineTool<{ publicId: string }, CardData>({
  name: 'card.getById',
  description:
    'Get a card by public ID: labels, members, checklists, attachments, list and recent activities.',
  properties: { publicId: { type: 'string' } },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    return client.request<CardData>(`${ROUTES.CARDS}/${input.publicId}`);
  },
});

export const cardUpdateTool = defineTool<
  {
    publicId: string;
    title?: string;
    description?: string;
    dueDate?: string | null;
    index?: number;
    listPublicId?: string;
  },
  unknown
>({
  name: 'card.update',
  description:
    'Update a card. To move it to another list pass listPublicId (and index for the position). dueDate null clears the date. The description field accepts HTML.',
  properties: {
    publicId: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', description: DESCRIPTION_HELP },
    dueDate: { type: ['string', 'null'], description: 'ISO 8601 date-time, or null to clear.' },
    index: { type: 'number' },
    listPublicId: { type: 'string' },
  },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    assertOptionalString(input.title, 'title');
    assertOptionalString(input.description, 'description');
    assertOptionalString(input.listPublicId, 'listPublicId');
    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body.title = input.title;
    if (input.description !== undefined) body.description = sanitizeHtml(input.description);
    if (input.dueDate !== undefined) body.dueDate = input.dueDate;
    if (input.index !== undefined) body.index = input.index;
    if (input.listPublicId !== undefined) body.listPublicId = input.listPublicId;
    return client.request(`${ROUTES.CARDS}/${input.publicId}`, { method: 'PUT', body: JSON.stringify(body) });
  },
});

export const cardDeleteTool = defineTool<{ publicId: string }, unknown>({
  name: 'card.delete',
  description: 'Delete a card.',
  properties: { publicId: { type: 'string' } },
  required: ['publicId'],
  run: async (client, input) => {
    assertString(input.publicId, 'publicId');
    return client.request(`${ROUTES.CARDS}/${input.publicId}`, { method: 'DELETE' });
  },
});

export const cardDuplicateTool = defineTool<
  {
    cardPublicId: string;
    listPublicId?: string;
    title?: string;
    index?: number;
    copyLabels?: boolean;
    copyMembers?: boolean;
    copyChecklists?: boolean;
  },
  unknown
>({
  name: 'card.duplicate',
  description:
    'Duplicate a card into the same list (default) or another one. Labels, members and checklists are copied unless disabled.',
  properties: {
    cardPublicId: { type: 'string' },
    listPublicId: { type: 'string', description: 'Target list. Defaults to the list of the original card.' },
    title: { type: 'string' },
    index: { type: 'number' },
    copyLabels: { type: 'boolean' },
    copyMembers: { type: 'boolean' },
    copyChecklists: { type: 'boolean' },
  },
  required: ['cardPublicId'],
  run: async (client, input) => {
    assertString(input.cardPublicId, 'cardPublicId');
    let listPublicId = input.listPublicId;
    if (!listPublicId) {
      const card = await client.request<CardData>(`${ROUTES.CARDS}/${input.cardPublicId}`);
      listPublicId = card.list?.publicId;
      if (!listPublicId) throw new Error('Could not determine the list of the card; pass listPublicId');
    }
    const body: Record<string, unknown> = {
      listPublicId,
      copyLabels: input.copyLabels ?? true,
      copyMembers: input.copyMembers ?? true,
      copyChecklists: input.copyChecklists ?? true,
    };
    if (input.title !== undefined) body.title = input.title;
    if (input.index !== undefined) body.index = input.index;
    return client.request(`${ROUTES.CARDS}/${input.cardPublicId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
});

type Relation = 'labels' | 'members';

/**
 * Kan only exposes a toggle for labels/members of a card. These helpers make add/remove idempotent
 * by checking the card first, so calling add twice (or remove on something absent) changes nothing.
 */
async function setRelation(
  client: KanClient,
  relation: Relation,
  cardPublicId: string,
  targetPublicId: string,
  wanted: boolean
): Promise<{ changed: boolean; present: boolean }> {
  assertString(cardPublicId, 'cardPublicId');
  assertString(targetPublicId, relation === 'labels' ? 'labelPublicId' : 'memberPublicId');
  const card = await client.request<CardData>(`${ROUTES.CARDS}/${cardPublicId}`);
  const present = (card[relation] ?? []).some((x) => x.publicId === targetPublicId);
  if (present === wanted) return { changed: false, present };
  await client.request(`${ROUTES.CARDS}/${cardPublicId}/${relation}/${targetPublicId}`, { method: 'PUT' });
  return { changed: true, present: wanted };
}

const relationProps = (target: 'labelPublicId' | 'memberPublicId') => ({
  cardPublicId: { type: 'string' },
  [target]: { type: 'string', description: target === 'memberPublicId' ? 'Workspace member public ID.' : undefined },
});

export const cardAddLabelTool = defineTool<{ cardPublicId: string; labelPublicId: string }, unknown>({
  name: 'card.addLabel',
  description: 'Add a label to a card (no-op if it already has it).',
  properties: relationProps('labelPublicId'),
  required: ['cardPublicId', 'labelPublicId'],
  run: (client, i) => setRelation(client, 'labels', i.cardPublicId, i.labelPublicId, true),
});

export const cardRemoveLabelTool = defineTool<{ cardPublicId: string; labelPublicId: string }, unknown>({
  name: 'card.removeLabel',
  description: 'Remove a label from a card (no-op if it does not have it).',
  properties: relationProps('labelPublicId'),
  required: ['cardPublicId', 'labelPublicId'],
  run: (client, i) => setRelation(client, 'labels', i.cardPublicId, i.labelPublicId, false),
});

export const cardAddMemberTool = defineTool<{ cardPublicId: string; memberPublicId: string }, unknown>({
  name: 'card.addMember',
  description: 'Assign a workspace member to a card (no-op if already assigned).',
  properties: relationProps('memberPublicId'),
  required: ['cardPublicId', 'memberPublicId'],
  run: (client, i) => setRelation(client, 'members', i.cardPublicId, i.memberPublicId, true),
});

export const cardRemoveMemberTool = defineTool<{ cardPublicId: string; memberPublicId: string }, unknown>({
  name: 'card.removeMember',
  description: 'Unassign a workspace member from a card (no-op if not assigned).',
  properties: relationProps('memberPublicId'),
  required: ['cardPublicId', 'memberPublicId'],
  run: (client, i) => setRelation(client, 'members', i.cardPublicId, i.memberPublicId, false),
});

export const cardListActivitiesTool = defineTool<
  { cardPublicId: string; limit?: number; cursor?: string },
  unknown
>({
  name: 'card.listActivities',
  description:
    'List the activities of a card, newest first, with cursor pagination (limit 1 to 100, cursor is an ISO date-time).',
  properties: {
    cardPublicId: { type: 'string' },
    limit: { type: 'number' },
    cursor: { type: 'string' },
  },
  required: ['cardPublicId'],
  run: async (client, input) => {
    assertString(input.cardPublicId, 'cardPublicId');
    const params = new URLSearchParams();
    if (input.limit !== undefined) params.set('limit', String(input.limit));
    if (input.cursor !== undefined) params.set('cursor', input.cursor);
    return client.request(withQuery(`${ROUTES.CARDS}/${input.cardPublicId}/activities`, params));
  },
});
