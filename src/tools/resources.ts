import { KanClient } from '../client.js';
import { Stats } from '../types.js';

export interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const resourceList: Resource[] = [
  {
    uri: 'kan://stats',
    name: 'Application Statistics',
    description: 'Global statistics about the Kan application (users, workspaces, cards, ...). Kan only serves them to an admin API key (KAN_ADMIN_API_KEY of the server).',
    mimeType: 'application/json',
  },
  {
    uri: 'kan://workspace/{workspaceSlug}/board/{boardSlug}',
    name: 'Board by Slug',
    description: 'Get a PUBLIC board by its workspace slug and board slug (Kan returns nothing for private boards; use the board by public ID resource for those).',
    mimeType: 'application/json',
  },
  {
    uri: 'kan://board/{boardPublicId}',
    name: 'Board by Public ID',
    description: 'Get a board by its public ID, with its lists and cards.',
    mimeType: 'application/json',
  },
];

export async function handleResource(uri: string, client: KanClient): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  if (uri === 'kan://stats') {
    const stats = await client.request<Stats>('/stats');
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(stats),
      }],
    };
  }

  const workspaceSlugMatch = uri.match(/^kan:\/\/workspace\/([^/]+)\/board\/([^/]+)$/);
  if (workspaceSlugMatch) {
    const [, workspaceSlug, boardSlug] = workspaceSlugMatch;
    const board = await client.request(`/workspaces/${workspaceSlug}/boards/${boardSlug}`);
    if (board === null) {
      throw new Error(`Board "${boardSlug}" not found in workspace "${workspaceSlug}", or it is private`);
    }
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(board),
      }],
    };
  }

  const boardIdMatch = uri.match(/^kan:\/\/board\/([^/]+)$/);
  if (boardIdMatch) {
    const [, boardPublicId] = boardIdMatch;
    const board = await client.request(`/boards/${boardPublicId}`);
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(board),
      }],
    };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}