import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { KanClient } from '../../src/client';
import { tools } from '../../src/tools/mod';

// Runs every tool except the attachment ones (see attachment.test.ts) against a real Kan.
// Start one with scripts/integration-up.sh, then:
//   set -a; . ./.env.integration; set +a
//   INTEGRATION_TEST=true bun test tests/integration/tools.test.ts
const enabled = process.env.INTEGRATION_TEST === 'true' && !!process.env.KAN_API_KEY;

describe.skipIf(!enabled)('Tool integration tests (Kan REST API)', () => {
  // Many retries: Kan rate limits API keys (100 requests/min) and the client backs off on 429.
  const client = new KanClient(
    process.env.KAN_API_KEY ?? '',
    process.env.KAN_API_BASE_URL ?? 'http://localhost:3000/api/v1',
    30_000,
    10
  );
  const suffix = Date.now().toString(36);
  const ids: Record<string, string> = {};

  // Kan answers requests above the key's rate limit with "401 Unauthorized: UNAUTHORIZED".
  // Wait for the window to reset and try again so the suite also works with the default limit.
  async function run(name: string, input: object) {
    const tool = tools.find((t: { name: string }) => t.name === name);
    if (!tool) throw new Error(`unknown tool ${name}`);
    for (let attempt = 0; ; attempt++) {
      const result = await tool.handler(client, input);
      const limited = !result.ok && /Unauthorized: UNAUTHORIZED/.test(result.error);
      if (!limited || attempt >= 3) return result;
      await new Promise((resolve) => setTimeout(resolve, 20_000));
    }
  }
  async function call(name: string, input: object = {}): Promise<any> {
    const result = await run(name, input);
    if (!result.ok) throw new Error(`${name}: ${result.error}`);
    return result.data;
  }
  async function callError(name: string, input: object = {}): Promise<string> {
    const result = await run(name, input);
    expect(result.ok).toBe(false);
    return (result as { error: string }).error;
  }
  const cardOf = async (id = ids.card!) => call('card.getById', { publicId: id });

  // A previous run may have used up the key's rate limit window: wait until the API accepts it.
  beforeAll(async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      if ((await run('workspace.list', {})).ok) return;
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }, 120_000);

  afterAll(async () => {
    if (ids.workspace) await call('workspace.delete', { publicId: ids.workspace }).catch(() => {});
  });

  test('server.health reports the API as reachable', async () => {
    const health = await call('server.health');
    expect(health).toMatchObject({ status: 'ok', apiReachable: true });
  });

  describe('workspace', () => {
    test('create, get, list, find and update', async () => {
      const ws = await call('workspace.create', { name: `IT ${suffix}`, slug: `it-${suffix}` });
      ids.workspace = ws.publicId;
      expect(ws.slug).toBe(`it-${suffix}`);

      expect((await call('workspace.getById', { publicId: ids.workspace })).members.length).toBe(1);
      expect((await call('workspace.getBySlug', { slug: `it-${suffix}` })).publicId).toBe(ids.workspace);

      const list = await call('workspace.list');
      expect(list.map((m: any) => m.workspace.publicId)).toContain(ids.workspace);
      expect(await call('workspace.list', { limit: 1 })).toHaveLength(1);
      expect((await call('workspace.findByName', { name: `it ${suffix}` })).workspace.publicId).toBe(ids.workspace);
      expect(await callError('workspace.findByName', { name: 'nao existe' })).toContain('Available workspaces');

      const updated = await call('workspace.update', {
        publicId: ids.workspace,
        name: `IT2 ${suffix}`,
        description: 'descricao',
        weekStartDay: 0,
      });
      expect(updated).toMatchObject({ name: `IT2 ${suffix}`, description: 'descricao', weekStartDay: 0 });
    });

    test('slug availability either answers or explains the upstream routing bug', async () => {
      const result = await run('workspace.checkSlugAvailability', { slug: `livre-${suffix}` });
      if (result.ok) expect(result.data).toHaveProperty('isAvailable');
      else expect((result as { error: string }).error).toContain('wrong handler');
    });

    test('search accepts a workspace and a query', async () => {
      expect(Array.isArray(await call('workspace.search', { workspacePublicId: ids.workspace, query: 'x' }))).toBe(true);
    });
  });

  describe('members and invite links', () => {
    test('invite, change role, remove', async () => {
      await call('member.invite', { workspacePublicId: ids.workspace, email: `novo-${suffix}@example.com` });
      const ws = await call('workspace.getById', { publicId: ids.workspace });
      const invited = ws.members.find((m: any) => (m.email ?? m.user?.email) === `novo-${suffix}@example.com`);
      expect(invited).toBeDefined();
      expect(await call('member.updateRole', { workspacePublicId: ids.workspace, memberPublicId: invited.publicId, role: 'guest' }))
        .toMatchObject({ success: true, role: 'guest' });
      expect(await call('member.remove', { workspacePublicId: ids.workspace, memberPublicId: invited.publicId }))
        .toEqual({ success: true });
      expect(await callError('member.updateRole', { workspacePublicId: ids.workspace, memberPublicId: 'x', role: 'boss' })).toContain('role must be');
    });

    test('invite link lifecycle', async () => {
      const created = await call('workspace.createInviteLink', { workspacePublicId: ids.workspace });
      expect(created.inviteLink).toContain(created.inviteCode);
      expect(await call('workspace.getInviteLink', { workspacePublicId: ids.workspace })).toMatchObject({ isActive: true });
      expect(await call('workspace.deactivateInviteLinks', { workspacePublicId: ids.workspace })).toEqual({ success: true });
    });
  });

  describe('board, list and label', () => {
    test('create a board with lists, labels and slug/visibility', async () => {
      const board = await call('board.create', {
        workspacePublicId: ids.workspace,
        name: `Board ${suffix}`,
        lists: ['Todo', 'Doing'],
        labels: ['bug'],
        slug: `board-${suffix}`,
        visibility: 'public',
      });
      ids.board = board.publicId;
      const full = await call('board.getById', { publicId: ids.board });
      expect(full).toMatchObject({ slug: `board-${suffix}`, visibility: 'public' });
      expect(full.lists.map((l: any) => l.name)).toEqual(['Todo', 'Doing']);
      ids.listA = full.lists[0].publicId;
      ids.listB = full.lists[1].publicId;
      ids.labelBug = full.labels[0].publicId;
    });

    test('board lookups: list, findByName, getBySlug (public) and slug check', async () => {
      const boards = await call('board.list', { workspacePublicId: ids.workspace });
      expect(boards.map((b: any) => b.publicId)).toContain(ids.board);
      expect((await call('board.findByName', { workspacePublicId: ids.workspace, name: `board ${suffix}` })).publicId).toBe(ids.board);
      expect(await callError('board.findByName', { workspacePublicId: ids.workspace, name: 'nope' })).toContain('Available boards');

      const bySlug = await call('board.getBySlug', { workspaceSlug: `it-${suffix}`, boardSlug: `board-${suffix}` });
      expect(bySlug.publicId).toBe(ids.board);
      expect(await call('board.checkSlugAvailability', { boardPublicId: ids.board, slug: `outro-${suffix}` })).toHaveProperty('isReserved');
    });

    test('a private board is not served by slug and says so', async () => {
      await call('board.update', { publicId: ids.board, visibility: 'private' });
      expect(await callError('board.getBySlug', { workspaceSlug: `it-${suffix}`, boardSlug: `board-${suffix}` })).toContain('private');
      await call('board.update', { publicId: ids.board, visibility: 'public', favorite: true });
      expect((await call('board.getById', { publicId: ids.board })).favorite).toBe(true);
    });

    test('lists: create, rename, reorder', async () => {
      const list = await call('list.create', { boardPublicId: ids.board, name: 'Done' });
      ids.listC = list.publicId;
      expect(await call('list.update', { publicId: ids.listC, name: 'Finished', index: 0 })).toMatchObject({ name: 'Finished' });
    });

    test('labels: create, get, partial update keeps the color', async () => {
      const label = await call('label.create', { boardPublicId: ids.board, name: 'feat', colourCode: '#00ff00' });
      ids.labelFeat = label.publicId;
      expect(await call('label.getById', { publicId: ids.labelFeat })).toMatchObject({ name: 'feat', colourCode: '#00ff00' });
      expect(await call('label.update', { publicId: ids.labelFeat, name: 'feature' })).toMatchObject({ name: 'feature', colourCode: '#00ff00' });
      expect(await call('label.update', { publicId: ids.labelFeat, colourCode: '#0000ff' })).toMatchObject({ name: 'feature', colourCode: '#0000ff' });
    });
  });

  describe('cards', () => {
    test('create with labels and position, then read back', async () => {
      const card = await call('card.create', {
        listPublicId: ids.listA,
        title: 'Primeiro',
        description: '<p>texto</p><script>x</script>',
        labelPublicIds: [ids.labelBug],
        position: 'end',
      });
      ids.card = card.publicId;
      const full = await cardOf();
      expect(full.title).toBe('Primeiro');
      expect(full.description).not.toContain('<script>');
      expect(full.labels.map((l: any) => l.publicId)).toEqual([ids.labelBug]);
    });

    test('update fields, clear the due date and move to another list', async () => {
      await call('card.update', { publicId: ids.card, title: 'Renomeado', dueDate: '2030-01-01T00:00:00.000Z' });
      expect((await cardOf()).dueDate).toContain('2030-01-01');
      await call('card.update', { publicId: ids.card, dueDate: null });
      expect((await cardOf()).dueDate).toBeNull();
      await call('card.update', { publicId: ids.card, listPublicId: ids.listB, index: 0 });
      expect((await cardOf()).list.publicId).toBe(ids.listB);
    });

    test('labels are added and removed idempotently', async () => {
      expect(await call('card.addLabel', { cardPublicId: ids.card, labelPublicId: ids.labelBug })).toMatchObject({ changed: false, present: true });
      expect(await call('card.addLabel', { cardPublicId: ids.card, labelPublicId: ids.labelFeat })).toMatchObject({ changed: true, present: true });
      expect(await call('card.addLabel', { cardPublicId: ids.card, labelPublicId: ids.labelFeat })).toMatchObject({ changed: false });
      expect((await cardOf()).labels).toHaveLength(2);
      expect(await call('card.removeLabel', { cardPublicId: ids.card, labelPublicId: ids.labelFeat })).toMatchObject({ changed: true, present: false });
      expect(await call('card.removeLabel', { cardPublicId: ids.card, labelPublicId: ids.labelFeat })).toMatchObject({ changed: false });
      expect((await cardOf()).labels).toHaveLength(1);
    });

    test('members are assigned and unassigned idempotently', async () => {
      const ws = await call('workspace.getById', { publicId: ids.workspace });
      const member = ws.members[0].publicId;
      expect(await call('card.addMember', { cardPublicId: ids.card, memberPublicId: member })).toMatchObject({ changed: true });
      expect(await call('card.addMember', { cardPublicId: ids.card, memberPublicId: member })).toMatchObject({ changed: false });
      expect((await cardOf()).members).toHaveLength(1);
      expect(await call('card.removeMember', { cardPublicId: ids.card, memberPublicId: member })).toMatchObject({ changed: true });
      expect((await cardOf()).members).toHaveLength(0);
    });

    test('board filters narrow the cards (a single value works)', async () => {
      await call('card.create', { listPublicId: ids.listA, title: 'Sem label' });
      const count = (b: any) => b.lists.reduce((n: number, l: any) => n + l.cards.length, 0);
      expect(count(await call('board.getById', { publicId: ids.board }))).toBe(2);
      expect(count(await call('board.getById', { publicId: ids.board, labels: [ids.labelBug] }))).toBe(1);
      expect(count(await call('board.getById', { publicId: ids.board, lists: [ids.listA] }))).toBe(1);
      expect(count(await call('board.getById', { publicId: ids.board, lists: [ids.listA, ids.listB] }))).toBe(2);
    });

    test('duplicate keeps the list by default and honours the copy flags', async () => {
      await call('checklist.create', { cardPublicId: ids.card, name: 'copiar' });
      const copy = await call('card.duplicate', { cardPublicId: ids.card, title: 'Copia' });
      const full = await cardOf(copy.publicId);
      expect(full.list.publicId).toBe(ids.listB);
      expect(full.labels).toHaveLength(1);
      expect(full.checklists).toHaveLength(1);
      const bare = await call('card.duplicate', { cardPublicId: ids.card, listPublicId: ids.listA, copyLabels: false, copyChecklists: false });
      const bareFull = await cardOf(bare.publicId);
      expect(bareFull.list.publicId).toBe(ids.listA);
      expect(bareFull.labels).toHaveLength(0);
      expect(bareFull.checklists).toHaveLength(0);
    });

    test('activities are paginated with a cursor', async () => {
      const first = await call('card.listActivities', { cardPublicId: ids.card, limit: 2 });
      expect(first.activities).toHaveLength(2);
      if (first.hasMore) {
        const next = await call('card.listActivities', { cardPublicId: ids.card, limit: 2, cursor: first.nextCursor });
        expect(next.activities[0].publicId).not.toBe(first.activities[0].publicId);
      }
    });
  });

  describe('checklists and comments', () => {
    test('checklist and item lifecycle', async () => {
      const checklist = await call('checklist.create', { cardPublicId: ids.card, name: 'Tarefas' });
      expect(await call('checklist.update', { publicId: checklist.publicId, name: 'Tarefas 2' })).toMatchObject({ name: 'Tarefas 2' });
      const item = await call('checklist.addItem', { checklistPublicId: checklist.publicId, title: 'item' });
      expect(item.completed).toBe(false);
      expect(await call('checklist.updateItem', { publicId: item.publicId, title: 'item 2', completed: true }))
        .toMatchObject({ title: 'item 2', completed: true });
      expect(await call('checklist.deleteItem', { publicId: item.publicId })).toEqual({ success: true });
      expect(await call('checklist.delete', { publicId: checklist.publicId })).toEqual({ success: true });
    });

    test('comment lifecycle', async () => {
      const comment = await call('comment.add', { cardPublicId: ids.card, content: '<p>oi</p>' });
      expect(await call('comment.update', { cardPublicId: ids.card, publicId: comment.publicId, content: '<p>oi 2</p>' }))
        .toMatchObject({ comment: '<p>oi 2</p>' });
      expect(await call('comment.delete', { cardPublicId: ids.card, publicId: comment.publicId })).toMatchObject({ publicId: comment.publicId });
    });
  });

  describe('errors carry the reason given by Kan', () => {
    test('unknown ids and invalid input', async () => {
      expect(await callError('card.getById', { publicId: 'zzzzzzzzzzzz' })).toMatch(/Not Found/i);
      expect(await callError('list.create', { boardPublicId: 'curto', name: 'x' })).toContain('boardPublicId');
    });
  });

  describe('cleanup', () => {
    test('delete card, list, label, board and workspace', async () => {
      expect(await call('card.delete', { publicId: ids.card })).toEqual({ success: true });
      expect(await call('label.delete', { publicId: ids.labelFeat })).toEqual({ success: true });
      expect(await call('list.delete', { publicId: ids.listC })).toEqual({ success: true });
      expect(await call('board.delete', { publicId: ids.board })).toEqual({ success: true });
      expect(await call('workspace.delete', { publicId: ids.workspace })).toEqual({ success: true });
      ids.workspace = '';
    });
  });
});
