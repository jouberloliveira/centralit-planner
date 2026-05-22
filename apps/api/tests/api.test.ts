import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createFakePrisma } from './fakePrisma.js';

async function setup(): Promise<{ app: FastifyInstance; token: string; userId: string }> {
  const { prisma } = createFakePrisma();
  const app = await buildApp({
    prisma,
    jwtSecret: 'test-secret-test-secret-test-secret',
    jwtExpiresIn: '1h',
    corsOrigin: ['http://localhost:5173'],
    logLevel: 'silent',
  });
  await app.ready();

  const reg = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email: 'alice@example.com', password: 'password123', name: 'Alice' },
  });
  const body = reg.json() as { token: string; user: { id: string } };
  return { app, token: body.token, userId: body.user.id };
}

describe('health', () => {
  it('returns ok', async () => {
    const { prisma } = createFakePrisma();
    const app = await buildApp({
      prisma,
      jwtSecret: 'x'.repeat(32),
      corsOrigin: ['http://localhost:5173'],
      logLevel: 'silent',
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
    await app.close();
  });
});

describe('auth', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const ctx = await setup();
    app = ctx.app;
  });

  it('rejects login with bad password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'wrongwrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('logs in with correct credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { token: string; user: { email: string } };
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe('alice@example.com');
  });

  it('blocks /auth/me without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects duplicate registration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'alice@example.com', password: 'password123', name: 'Alice' },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('projects', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    const ctx = await setup();
    app = ctx.app;
    token = ctx.token;
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects' });
    expect(res.statusCode).toBe(401);
  });

  it('creates, reads, updates, lists, deletes a project', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'ACME', name: 'Acme', description: 'demo' },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json() as { id: string; key: string };
    expect(created.key).toBe('ACME');

    const get = await app.inject({
      method: 'GET',
      url: `/projects/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/projects/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Acme Inc' },
    });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { name: string }).name).toBe('Acme Inc');

    const list = await app.inject({
      method: 'GET',
      url: '/projects',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as { total: number }).total).toBe(1);

    const del = await app.inject({
      method: 'DELETE',
      url: `/projects/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);
  });

  it('rejects duplicate project key', async () => {
    await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'DUPE', name: 'Dupe' },
    });
    const dupe = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'DUPE', name: 'Dupe 2' },
    });
    expect(dupe.statusCode).toBe(409);
  });

  it('validates invalid key format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'lowercase', name: 'Bad' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('work-items', () => {
  let app: FastifyInstance;
  let token: string;
  let projectId: string;
  let otherProjectId: string;

  beforeAll(async () => {
    const ctx = await setup();
    app = ctx.app;
    token = ctx.token;

    const p1 = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'WKA', name: 'Work A' },
    });
    projectId = (p1.json() as { id: string }).id;

    const p2 = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'WKB', name: 'Work B' },
    });
    otherProjectId = (p2.json() as { id: string }).id;
  });

  async function create(payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/work-items',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
  }

  it('creates an EPIC with no parent', async () => {
    const res = await create({ kind: 'epic', title: 'Big epic', projectId });
    expect(res.statusCode).toBe(201);
    const item = res.json() as { kind: string; parentId: string | null };
    expect(item.kind).toBe('epic');
    expect(item.parentId).toBeNull();
  });

  it('rejects EPIC with a parent (400)', async () => {
    const epic = await create({ kind: 'epic', title: 'Epic A', projectId });
    const child = await create({
      kind: 'epic',
      title: 'Epic B',
      projectId,
      parentId: (epic.json() as { id: string }).id,
    });
    expect(child.statusCode).toBe(400);
    expect((child.json() as { error: { code: string } }).error.code).toBe('BAD_REQUEST');
  });

  it('builds full hierarchy and rejects invalid parents', async () => {
    const epic = (await create({ kind: 'epic', title: 'E', projectId })).json() as { id: string };
    const feature = (
      await create({ kind: 'feature', title: 'F', projectId, parentId: epic.id })
    ).json() as { id: string };
    const story = (
      await create({ kind: 'story', title: 'S', projectId, parentId: feature.id })
    ).json() as { id: string };
    const task = (
      await create({ kind: 'task', title: 'T', projectId, parentId: story.id })
    ).json() as { id: string; kind: string };
    expect(task.kind).toBe('task');

    const badTask = await create({ kind: 'task', title: 'TT', projectId, parentId: task.id });
    expect(badTask.statusCode).toBe(400);

    const badStory = await create({ kind: 'story', title: 'SS', projectId, parentId: task.id });
    expect(badStory.statusCode).toBe(400);

    const badFeature = await create({
      kind: 'feature',
      title: 'FF',
      projectId,
      parentId: story.id,
    });
    expect(badFeature.statusCode).toBe(400);
  });

  it('rejects parent from a different project', async () => {
    const epicA = (await create({ kind: 'epic', title: 'EA', projectId })).json() as { id: string };
    const res = await create({
      kind: 'feature',
      title: 'FB',
      projectId: otherProjectId,
      parentId: epicA.id,
    });
    expect(res.statusCode).toBe(400);
  });

  it('moves a task between valid parents and rejects invalid moves', async () => {
    const epic = (await create({ kind: 'epic', title: 'ME', projectId })).json() as { id: string };
    const featA = (
      await create({ kind: 'feature', title: 'MFA', projectId, parentId: epic.id })
    ).json() as { id: string };
    const featB = (
      await create({ kind: 'feature', title: 'MFB', projectId, parentId: epic.id })
    ).json() as { id: string };
    const story = (
      await create({ kind: 'story', title: 'MS', projectId, parentId: featA.id })
    ).json() as { id: string };
    const task = (
      await create({ kind: 'task', title: 'MT', projectId, parentId: story.id })
    ).json() as { id: string };

    const moveOk = await app.inject({
      method: 'POST',
      url: `/work-items/${task.id}/move`,
      headers: { authorization: `Bearer ${token}` },
      payload: { parentId: featB.id },
    });
    expect(moveOk.statusCode).toBe(200);
    expect((moveOk.json() as { parentId: string }).parentId).toBe(featB.id);

    const moveToTask = await app.inject({
      method: 'POST',
      url: `/work-items/${story.id}/move`,
      headers: { authorization: `Bearer ${token}` },
      payload: { parentId: task.id },
    });
    expect(moveToTask.statusCode).toBe(400);

    const moveToSelf = await app.inject({
      method: 'POST',
      url: `/work-items/${task.id}/move`,
      headers: { authorization: `Bearer ${token}` },
      payload: { parentId: task.id },
    });
    expect(moveToSelf.statusCode).toBe(400);
  });

  it('lists with filters and updates a work item', async () => {
    const item = (await create({ kind: 'epic', title: 'Filterable', projectId })).json() as {
      id: string;
    };

    const patch = await app.inject({
      method: 'PATCH',
      url: `/work-items/${item.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'in_progress', priority: 'high' },
    });
    expect(patch.statusCode).toBe(200);
    const updated = patch.json() as { status: string; priority: string };
    expect(updated.status).toBe('in_progress');
    expect(updated.priority).toBe('high');

    const list = await app.inject({
      method: 'GET',
      url: `/work-items?projectId=${projectId}&kind=epic&status=in_progress`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ id: string }>; total: number };
    expect(body.items.find((i) => i.id === item.id)).toBeTruthy();
  });
});
