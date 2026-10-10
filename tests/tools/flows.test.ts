import { describe, test, expect } from 'bun:test';
import { useKanMock, run, errorReply } from '../helpers';

// Tools that need more than one request, or that add behavior on top of Kan's API.
describe('multi-request flows', () => {
  const kan = useKanMock();
  const paths = () => kan.calls.map((c) => `${c.method} ${c.path}`);

  describe('workspace lookups', () => {
    const memberships = [
      { role: 'admin', workspace: { publicId: 'w1', name: 'Alpha', slug: 'alpha' } },
      { role: 'member', workspace: { publicId: 'w2', name: 'Beta', slug: 'beta' } },
    ];

    test('workspace.list paginates on the client', async () => {
      kan.handler = () => memberships;
      const result = await run('workspace.list', { limit: 1, offset: 1 });
      expect(result).toMatchObject({ ok: true, data: [{ workspace: { publicId: 'w2' } }] });
      expect(paths()).toEqual(['GET /workspaces']);
    });

    test('workspace.findByName is case-insensitive and lists the options when missing', async () => {
      kan.handler = () => memberships;
      expect(await run('workspace.findByName', { name: 'BETA' })).toMatchObject({ ok: true, data: { role: 'member' } });
      const missing = await run('workspace.findByName', { name: 'Gamma' });
      expect(missing).toMatchObject({ ok: false });
      expect((missing as { error: string }).error).toContain('Alpha, Beta');
    });

    test('workspace.getBySlug resolves the slug itself, then reads the workspace by ID', async () => {
      kan.handler = (c) => (c.path === '/workspaces' ? memberships : { publicId: 'w2', slug: 'beta' });
      expect(await run('workspace.getBySlug', { slug: 'beta' })).toMatchObject({ ok: true, data: { publicId: 'w2' } });
      expect(paths()).toEqual(['GET /workspaces', 'GET /workspaces/w2']);
      kan.calls.length = 0;
      expect(await run('workspace.getBySlug', { slug: 'nope' })).toMatchObject({ ok: false });
    });

    test('workspace.checkSlugAvailability explains the upstream routing bug', async () => {
      kan.handler = () => errorReply(404, 'Workspace not found');
      const result = await run('workspace.checkSlugAvailability', { slug: 'abc' });
      expect(result).toMatchObject({ ok: false });
      expect((result as { error: string }).error).toContain('wrong handler');
    });
  });

  describe('board', () => {
    test('board.findByName matches case-insensitively inside the workspace', async () => {
      kan.handler = () => [{ publicId: 'b1', name: 'Roadmap' }];
      expect(await run('board.findByName', { workspacePublicId: 'w1', name: 'roadmap' })).toMatchObject({ ok: true, data: { publicId: 'b1' } });
      expect(await run('board.findByName', { workspacePublicId: 'w1', name: 'x' })).toMatchObject({ ok: false });
    });

    test('board.create without slug/visibility is a single request', async () => {
      kan.handler = () => ({ publicId: 'b1', name: 'B' });
      expect(await run('board.create', { workspacePublicId: 'w1', name: 'B' })).toMatchObject({ ok: true, data: { publicId: 'b1' } });
      expect(paths()).toEqual(['POST /workspaces/w1/boards']);
    });

    test('board.create only updates the slug/visibility that differ from the generated board', async () => {
      kan.handler = (c) => {
        if (c.method === 'POST') return { publicId: 'b1', name: 'B' };
        if (c.method === 'GET') return { slug: 'b', visibility: 'private' };
        return {};
      };
      const result = await run('board.create', { workspacePublicId: 'w1', name: 'B', slug: 'b', visibility: 'public' });
      expect(result).toMatchObject({ ok: true, data: { publicId: 'b1', slug: 'b', visibility: 'public' } });
      expect(paths()).toEqual(['POST /workspaces/w1/boards', 'GET /boards/b1', 'PUT /boards/b1']);
      expect(kan.calls[2]!.body).toEqual({ visibility: 'public' });
    });

    test('board.create reports the created board when applying the slug fails', async () => {
      kan.handler = (c) => {
        if (c.method === 'POST') return { publicId: 'b1', name: 'B' };
        if (c.method === 'GET') return { slug: 'auto', visibility: 'private' };
        return errorReply(400, 'Board slug taken');
      };
      const result = await run('board.create', { workspacePublicId: 'w1', name: 'B', slug: 'mine' });
      expect(result).toMatchObject({ ok: false });
      expect((result as { error: string }).error).toContain('publicId b1');
      expect((result as { error: string }).error).toContain('Board slug taken');
    });

    test('board.getBySlug turns Kan\'s null (private board) into an explanation', async () => {
      kan.handler = () => null;
      const result = await run('board.getBySlug', { workspaceSlug: 'w', boardSlug: 'b' });
      expect(result).toMatchObject({ ok: false });
      expect((result as { error: string }).error).toContain('private');
    });
  });

  describe('label.update', () => {
    test('completes the missing field from the current label', async () => {
      kan.handler = (c) => (c.method === 'GET' ? { publicId: 'x1', name: 'old', colourCode: '#123456' } : {});
      await run('label.update', { publicId: 'x1', name: 'new' });
      expect(kan.calls[1]!.body).toEqual({ name: 'new', colourCode: '#123456' });
      kan.calls.length = 0;
      await run('label.update', { publicId: 'x1', colourCode: '#fff' });
      expect(kan.calls[1]!.body).toEqual({ name: 'old', colourCode: '#fff' });
    });

    test('does not read the label when both fields are given', async () => {
      await run('label.update', { publicId: 'x1', name: 'a', colourCode: '#fff' });
      expect(paths()).toEqual(['PUT /labels/x1']);
    });
  });

  describe('card labels and members are idempotent', () => {
    const card = { publicId: 'c1', labels: [{ publicId: 'l1' }], members: [{ publicId: 'm1' }], list: { publicId: 'list1' } };

    test.each([
      ['card.addLabel', { cardPublicId: 'c1', labelPublicId: 'l1' }, false],
      ['card.addLabel', { cardPublicId: 'c1', labelPublicId: 'l2' }, true],
      ['card.removeLabel', { cardPublicId: 'c1', labelPublicId: 'l1' }, true],
      ['card.removeLabel', { cardPublicId: 'c1', labelPublicId: 'l2' }, false],
      ['card.addMember', { cardPublicId: 'c1', memberPublicId: 'm1' }, false],
      ['card.addMember', { cardPublicId: 'c1', memberPublicId: 'm2' }, true],
      ['card.removeMember', { cardPublicId: 'c1', memberPublicId: 'm1' }, true],
      ['card.removeMember', { cardPublicId: 'c1', memberPublicId: 'm2' }, false],
    ] as const)('%s %j toggles only when needed (%p)', async (name, input, toggles) => {
      kan.handler = (c) => (c.method === 'GET' ? card : { ok: true });
      const result = await run(name, input);
      expect(result).toMatchObject({ ok: true, data: { changed: toggles } });
      const target = 'labelPublicId' in input ? `labels/${input.labelPublicId}` : `members/${input.memberPublicId}`;
      expect(paths()).toEqual(toggles ? ['GET /cards/c1', `PUT /cards/c1/${target}`] : ['GET /cards/c1']);
    });
  });

  describe('card.duplicate', () => {
    const card = { publicId: 'c1', list: { publicId: 'list1' } };

    test('defaults to the same list and copies everything', async () => {
      kan.handler = (c) => (c.method === 'GET' ? card : { publicId: 'c2' });
      await run('card.duplicate', { cardPublicId: 'c1' });
      expect(paths()).toEqual(['GET /cards/c1', 'POST /cards/c1/duplicate']);
      expect(kan.calls[1]!.body).toEqual({ listPublicId: 'list1', copyLabels: true, copyMembers: true, copyChecklists: true });
    });

    test('an explicit list skips the lookup and the flags can be turned off', async () => {
      await run('card.duplicate', { cardPublicId: 'c1', listPublicId: 'list9', title: 'T', index: 0, copyLabels: false, copyMembers: false, copyChecklists: false });
      expect(paths()).toEqual(['POST /cards/c1/duplicate']);
      expect(kan.calls[0]!.body).toEqual({ listPublicId: 'list9', title: 'T', index: 0, copyLabels: false, copyMembers: false, copyChecklists: false });
    });
  });

  test('card.create strips dangerous HTML from the description', async () => {
    await run('card.create', { listPublicId: 'l1', title: 'T', description: '<p onclick="x()">a</p><script>alert(1)</script>' });
    const sent = kan.calls[0]!.body.description as string;
    expect(sent).not.toContain('<script');
    expect(sent).not.toContain('onclick');
  });

  test('member.updateRole rejects unknown roles before calling the API', async () => {
    const result = await run('member.updateRole', { workspacePublicId: 'w', memberPublicId: 'm', role: 'owner' });
    expect(result).toMatchObject({ ok: false });
    expect(kan.calls).toHaveLength(0);
  });

  test('array filters send a single value twice, because Kan rejects a lone value', async () => {
    await run('board.getById', { publicId: 'b1', lists: ['only'] });
    expect(kan.calls[0]!.path).toBe('/boards/b1?lists=only&lists=only');
  });
});

describe('API error messages', () => {
  const kan = useKanMock();

  test('include Kan\'s message and the invalid fields', async () => {
    kan.handler = () => errorReply(400, 'Input validation failed', { boardPublicId: ['String must contain at least 12 character(s)'] });
    const result = await run('list.create', { boardPublicId: 'x', name: 'n' });
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toBe(
      'Bad Request: Input validation failed (boardPublicId: String must contain at least 12 character(s))'
    );
  });

  test('fall back to the status text when the body is empty or not JSON', async () => {
    kan.handler = () => new Response('', { status: 404, statusText: 'Not Found' });
    expect(await run('card.getById', { publicId: 'c1' })).toMatchObject({ ok: false, error: 'Not Found' });
    kan.handler = () => new Response('<html>oops</html>', { status: 500, statusText: 'Server Error' });
    expect(await run('card.getById', { publicId: 'c1' })).toMatchObject({ ok: false, error: 'Server Error: <html>oops</html>' });
  });
});

describe('server.health', () => {
  const kan = useKanMock();

  test('is ok when the API answers and reports the package version', async () => {
    kan.handler = () => [];
    const result = await run('server.health');
    expect(result).toMatchObject({ ok: true, data: { status: 'ok', apiReachable: true, version: '0.3.0' } });
  });

  test('is unhealthy when the API fails', async () => {
    kan.handler = () => errorReply(401, 'Unauthorized');
    const result = await run('server.health');
    expect(result).toMatchObject({ ok: true, data: { status: 'unhealthy', apiReachable: false } });
  });
});
