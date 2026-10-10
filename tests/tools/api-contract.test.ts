import { describe, test, expect } from 'bun:test';
import { tools } from '../../src/tools/mod';
import { useKanMock, run } from '../helpers';

// Each case is one tool call and the single request it must produce for Kan 0.6.0
// (verified against the real API by tests/integration/tools.test.ts).
type Case = [tool: string, input: object, method: string, path: string, body?: object];

const cases: Case[] = [
  // workspace
  ['workspace.create', { name: 'N', slug: 's', description: 'dddd' }, 'POST', '/workspaces', { name: 'N', slug: 's', description: 'dddd' }],
  ['workspace.create', { name: 'N' }, 'POST', '/workspaces', { name: 'N' }],
  ['workspace.getById', { publicId: 'w1' }, 'GET', '/workspaces/w1'],
  ['workspace.update', { publicId: 'w1', name: 'X', weekStartDay: 0 }, 'PUT', '/workspaces/w1', { name: 'X', weekStartDay: 0 }],
  ['workspace.delete', { publicId: 'w1' }, 'DELETE', '/workspaces/w1'],
  ['workspace.search', { workspacePublicId: 'w1', query: 'a b', limit: 5 }, 'GET', '/workspaces/w1/search?query=a+b&limit=5'],
  ['workspace.checkSlugAvailability', { slug: 'abc' }, 'GET', '/workspaces/check-slug-availability?workspaceSlug=abc'],
  // members and invite links
  ['member.invite', { workspacePublicId: 'w1', email: 'a@b.co' }, 'POST', '/workspaces/w1/members/invite', { email: 'a@b.co' }],
  ['member.remove', { workspacePublicId: 'w1', memberPublicId: 'm1' }, 'DELETE', '/workspaces/w1/members/m1'],
  ['member.updateRole', { workspacePublicId: 'w1', memberPublicId: 'm1', role: 'guest' }, 'PUT', '/workspaces/w1/members/m1/role', { role: 'guest' }],
  ['workspace.getInviteLink', { workspacePublicId: 'w1' }, 'GET', '/workspaces/w1/invite'],
  ['workspace.createInviteLink', { workspacePublicId: 'w1' }, 'POST', '/workspaces/w1/invites'],
  ['workspace.deactivateInviteLinks', { workspacePublicId: 'w1' }, 'DELETE', '/workspaces/w1/invites'],
  // board
  ['board.list', { workspacePublicId: 'w1' }, 'GET', '/workspaces/w1/boards'],
  ['board.list', { workspacePublicId: 'w1', type: 'template', archived: true }, 'GET', '/workspaces/w1/boards?type=template&archived=true'],
  ['board.create', { workspacePublicId: 'w1', name: 'B', lists: ['a'], labels: ['l'], type: 'template' }, 'POST', '/workspaces/w1/boards', { name: 'B', lists: ['a'], labels: ['l'], type: 'template' }],
  ['board.create', { workspacePublicId: 'w1', name: 'B' }, 'POST', '/workspaces/w1/boards', { name: 'B', lists: [], labels: [] }],
  ['board.getById', { publicId: 'b1' }, 'GET', '/boards/b1'],
  ['board.getById', { publicId: 'b1', labels: ['l1'], type: 'regular' }, 'GET', '/boards/b1?labels=l1&labels=l1&type=regular'],
  ['board.getById', { publicId: 'b1', members: ['m1', 'm2'], dueDateFilters: ['overdue', 'today'] }, 'GET', '/boards/b1?members=m1&members=m2&dueDateFilters=overdue&dueDateFilters=today'],
  ['board.getBySlug', { workspaceSlug: 'w', boardSlug: 'b', lists: ['l1'] }, 'GET', '/workspaces/w/boards/b?lists=l1&lists=l1'],
  ['board.update', { publicId: 'b1', name: 'N', slug: 's', visibility: 'public', favorite: true, isArchived: false }, 'PUT', '/boards/b1', { name: 'N', slug: 's', visibility: 'public', favorite: true, isArchived: false }],
  ['board.delete', { publicId: 'b1' }, 'DELETE', '/boards/b1'],
  ['board.checkSlugAvailability', { boardPublicId: 'b1', slug: 'x' }, 'GET', '/boards/b1/check-slug-availability?boardSlug=x'],
  // list
  ['list.create', { boardPublicId: 'b1', name: 'L' }, 'POST', '/lists', { boardPublicId: 'b1', name: 'L' }],
  ['list.update', { publicId: 'l1', name: 'N', index: 2 }, 'PUT', '/lists/l1', { name: 'N', index: 2 }],
  ['list.delete', { publicId: 'l1' }, 'DELETE', '/lists/l1'],
  // label
  ['label.create', { boardPublicId: 'b1', name: 'N', colourCode: '#fff' }, 'POST', '/labels', { boardPublicId: 'b1', name: 'N', colourCode: '#fff' }],
  ['label.getById', { publicId: 'x1' }, 'GET', '/labels/x1'],
  ['label.update', { publicId: 'x1', name: 'N', colourCode: '#000' }, 'PUT', '/labels/x1', { name: 'N', colourCode: '#000' }],
  ['label.delete', { publicId: 'x1' }, 'DELETE', '/labels/x1'],
  // card
  ['card.create', { listPublicId: 'l1', title: 'T' }, 'POST', '/cards', { listPublicId: 'l1', title: 'T', description: '', labelPublicIds: [], memberPublicIds: [], position: 'start' }],
  ['card.create', { listPublicId: 'l1', title: 'T', description: '<p>x</p>', dueDate: '2030-01-01', labelPublicIds: ['a'], memberPublicIds: ['b'], position: 'end' }, 'POST', '/cards', { listPublicId: 'l1', title: 'T', description: '<p>x</p>', labelPublicIds: ['a'], memberPublicIds: ['b'], position: 'end', dueDate: '2030-01-01' }],
  ['card.getById', { publicId: 'c1' }, 'GET', '/cards/c1'],
  ['card.update', { publicId: 'c1', title: 'T', dueDate: null, index: 1, listPublicId: 'l2' }, 'PUT', '/cards/c1', { title: 'T', dueDate: null, index: 1, listPublicId: 'l2' }],
  ['card.delete', { publicId: 'c1' }, 'DELETE', '/cards/c1'],
  ['card.listActivities', { cardPublicId: 'c1', limit: 5, cursor: '2030-01-01T00:00:00.000Z' }, 'GET', '/cards/c1/activities?limit=5&cursor=2030-01-01T00%3A00%3A00.000Z'],
  // checklist
  ['checklist.create', { cardPublicId: 'c1', name: 'N' }, 'POST', '/cards/c1/checklists', { name: 'N' }],
  ['checklist.update', { publicId: 'k1', name: 'N' }, 'PUT', '/checklists/k1', { name: 'N' }],
  ['checklist.delete', { publicId: 'k1' }, 'DELETE', '/checklists/k1'],
  ['checklist.addItem', { checklistPublicId: 'k1', title: 'T' }, 'POST', '/checklists/k1/items', { title: 'T' }],
  ['checklist.updateItem', { publicId: 'i1', title: 'T', completed: true, index: 0 }, 'PATCH', '/checklists/items/i1', { title: 'T', completed: true, index: 0 }],
  ['checklist.deleteItem', { publicId: 'i1' }, 'DELETE', '/checklists/items/i1'],
  // comment
  ['comment.add', { cardPublicId: 'c1', content: '<p>x</p>' }, 'POST', '/cards/c1/comments', { comment: '<p>x</p>' }],
  ['comment.update', { cardPublicId: 'c1', publicId: 'm1', content: '<p>y</p>' }, 'PUT', '/cards/c1/comments/m1', { comment: '<p>y</p>' }],
  ['comment.delete', { cardPublicId: 'c1', publicId: 'm1' }, 'DELETE', '/cards/c1/comments/m1'],
  // attachment
  ['attachment.remove', { attachmentPublicId: 'a1' }, 'DELETE', '/attachments/a1'],
];

describe('API contract (Kan 0.6.0)', () => {
  const kan = useKanMock();

  // Rows are padded: bun's test.each would otherwise pass its `done` callback as the missing 5th argument.
  const rows = cases.map((c) => [c[0], c[1], c[2], c[3], c[4] ?? null] as const);

  test.each(rows)('%s %j', async (name, input, method, path, body) => {
    const result = await run(name, input);
    expect(result.ok).toBe(true);
    expect(kan.calls).toHaveLength(1);
    expect(kan.calls[0]!.method).toBe(method);
    expect(kan.calls[0]!.path).toBe(path);
    if (body === null) expect(kan.calls[0]!.body).toBeUndefined();
    else expect(kan.calls[0]!.body).toEqual(body);
  });
});

describe('input validation', () => {
  const kan = useKanMock();
  const withRequired = tools.filter((t: any) => t.inputSchema.required.length > 0);

  test('there are tools with required fields to check', () => {
    expect(withRequired.length).toBeGreaterThan(40);
  });

  test.each(withRequired.map((t: any) => [t.name]))('%s rejects an empty input without calling the API', async (name) => {
    const result = await run(name as string, {});
    expect(result.ok).toBe(false);
    expect(kan.calls).toHaveLength(0);
  });

  test('every tool name follows domain.action and is unique', () => {
    const names = tools.map((t: any) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
  });
});
