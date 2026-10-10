import { ROUTES } from '../types';
import { assertString } from '../utils';
import { defineTool } from './tool';

const ROLES = ['admin', 'member', 'guest'] as const;
const ws = (id: string) => `${ROUTES.WORKSPACES}/${id}`;

export const memberInviteTool = defineTool<{ workspacePublicId: string; email: string }, unknown>({
  name: 'member.invite',
  description: 'Invite a person to a workspace by e-mail.',
  properties: { workspacePublicId: { type: 'string' }, email: { type: 'string' } },
  required: ['workspacePublicId', 'email'],
  run: async (client, input) => {
    assertString(input.workspacePublicId, 'workspacePublicId');
    assertString(input.email, 'email');
    return client.request(`${ws(input.workspacePublicId)}/members/invite`, {
      method: 'POST',
      body: JSON.stringify({ email: input.email }),
    });
  },
});

export const memberRemoveTool = defineTool<{ workspacePublicId: string; memberPublicId: string }, unknown>({
  name: 'member.remove',
  description: 'Remove a member from a workspace.',
  properties: { workspacePublicId: { type: 'string' }, memberPublicId: { type: 'string' } },
  required: ['workspacePublicId', 'memberPublicId'],
  run: async (client, input) => {
    assertString(input.workspacePublicId, 'workspacePublicId');
    assertString(input.memberPublicId, 'memberPublicId');
    return client.request(`${ws(input.workspacePublicId)}/members/${input.memberPublicId}`, {
      method: 'DELETE',
    });
  },
});

export const memberUpdateRoleTool = defineTool<
  { workspacePublicId: string; memberPublicId: string; role: (typeof ROLES)[number] },
  unknown
>({
  name: 'member.updateRole',
  description: 'Change the role of a workspace member (admin, member or guest).',
  properties: {
    workspacePublicId: { type: 'string' },
    memberPublicId: { type: 'string' },
    role: { type: 'string', enum: [...ROLES] },
  },
  required: ['workspacePublicId', 'memberPublicId', 'role'],
  run: async (client, input) => {
    assertString(input.workspacePublicId, 'workspacePublicId');
    assertString(input.memberPublicId, 'memberPublicId');
    if (!ROLES.includes(input.role)) throw new Error(`role must be one of: ${ROLES.join(', ')}`);
    return client.request(`${ws(input.workspacePublicId)}/members/${input.memberPublicId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: input.role }),
    });
  },
});

export const workspaceGetInviteLinkTool = defineTool<{ workspacePublicId: string }, unknown>({
  name: 'workspace.getInviteLink',
  description: 'Get the active invite link of a workspace (isActive is false when there is none).',
  properties: { workspacePublicId: { type: 'string' } },
  required: ['workspacePublicId'],
  run: async (client, input) => {
    assertString(input.workspacePublicId, 'workspacePublicId');
    return client.request(`${ws(input.workspacePublicId)}/invite`);
  },
});

export const workspaceCreateInviteLinkTool = defineTool<{ workspacePublicId: string }, unknown>({
  name: 'workspace.createInviteLink',
  description: 'Create an invite link for a workspace.',
  properties: { workspacePublicId: { type: 'string' } },
  required: ['workspacePublicId'],
  run: async (client, input) => {
    assertString(input.workspacePublicId, 'workspacePublicId');
    return client.request(`${ws(input.workspacePublicId)}/invites`, { method: 'POST' });
  },
});

export const workspaceDeactivateInviteLinksTool = defineTool<{ workspacePublicId: string }, unknown>({
  name: 'workspace.deactivateInviteLinks',
  description: 'Deactivate the invite link of a workspace.',
  properties: { workspacePublicId: { type: 'string' } },
  required: ['workspacePublicId'],
  run: async (client, input) => {
    assertString(input.workspacePublicId, 'workspacePublicId');
    return client.request(`${ws(input.workspacePublicId)}/invites`, { method: 'DELETE' });
  },
});
