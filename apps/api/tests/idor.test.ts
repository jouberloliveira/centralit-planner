import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createFakePrisma, type FakePrismaState } from './fakePrisma.js';

interface UserCtx {
  token: string;
  userId: string;
}

async function register(app: FastifyInstance, email: string): Promise<UserCtx> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'password123', name: email.split('@')[0] },
  });
  const body = res.json() as { token: string; user: { id: string } };
  return { token: body.token, userId: body.user.id };
}

async function bootstrap(): Promise<{
  app: FastifyInstance;
  alice: UserCtx;
  bob: UserCtx;
  state: FakePrismaState;
}> {
  const { prisma, state } = createFakePrisma();
  const app = await buildApp({
    prisma,
    jwtSecret: 'test-secret-test-secret-test-secret',
    jwtExpiresIn: '1h',
    logLevel: 'silent',
  });
  await app.ready();
  const alice = await register(app, 'alice@example.com');
  const bob = await register(app, 'bob@example.com');
  return { app, alice, bob, state };
}

async function createProject(
  app: FastifyInstance,
  token: string,
  key: string,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/projects',
    headers: { authorization: `Bearer ${token}` },
    payload: { key, name: key },
  });
  expect(res.statusCode).toBe(201);
  return (res.json() as { id: string }).id;
}

describe('IDOR — projects', () => {
  let app: FastifyInstance;
  let alice: UserCtx;
  let bob: UserCtx;
  let aliceProject: string;

  beforeAll(async () => {
    const ctx = await bootstrap();
    app = ctx.app;
    alice = ctx.alice;
    bob = ctx.bob;
    aliceProject = await createProject(app, alice.token, 'ALICE');
  });

  it('grants OWNER membership to creator', async () => {
    // Alice can read her own project.
    const ok = await app.inject({
      method: 'GET',
      url: `/projects/${aliceProject}`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    expect(ok.statusCode).toBe(200);
  });

  it("blocks cross-tenant GET (Bob cannot read Alice's project)", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${aliceProject}`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("blocks cross-tenant PATCH (Bob cannot edit Alice's project)", async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/projects/${aliceProject}`,
      headers: { authorization: `Bearer ${bob.token}` },
      payload: { name: 'pwned' },
    });
    expect(res.statusCode).toBe(404);
  });

  it("blocks cross-tenant DELETE (Bob cannot delete Alice's project)", async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/projects/${aliceProject}`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('scopes GET /projects to caller memberships', async () => {
    const bobList = await app.inject({
      method: 'GET',
      url: '/projects',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(bobList.statusCode).toBe(200);
    expect((bobList.json() as { total: number; items: unknown[] }).total).toBe(0);

    const aliceList = await app.inject({
      method: 'GET',
      url: '/projects',
      headers: { authorization: `Bearer ${alice.token}` },
    });
    const aliceBody = aliceList.json() as { items: Array<{ id: string }> };
    expect(aliceBody.items.find((p) => p.id === aliceProject)).toBeTruthy();
  });
});

describe('IDOR — work items', () => {
  let app: FastifyInstance;
  let alice: UserCtx;
  let bob: UserCtx;
  let aliceProject: string;
  let bobProject: string;
  let aliceItem: string;

  beforeAll(async () => {
    const ctx = await bootstrap();
    app = ctx.app;
    alice = ctx.alice;
    bob = ctx.bob;
    aliceProject = await createProject(app, alice.token, 'ALICEWI');
    bobProject = await createProject(app, bob.token, 'BOBWI');

    const create = await app.inject({
      method: 'POST',
      url: '/work-items',
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { kind: 'epic', title: 'Secret epic', projectId: aliceProject },
    });
    expect(create.statusCode).toBe(201);
    aliceItem = (create.json() as { id: string }).id;
  });

  it("blocks cross-tenant POST /work-items targeting another project", async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/work-items',
      headers: { authorization: `Bearer ${bob.token}` },
      payload: { kind: 'epic', title: 'Squatter', projectId: aliceProject },
    });
    expect(res.statusCode).toBe(404);
  });

  it("blocks cross-tenant GET /work-items/:id", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/work-items/${aliceItem}`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("blocks cross-tenant PATCH /work-items/:id", async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/work-items/${aliceItem}`,
      headers: { authorization: `Bearer ${bob.token}` },
      payload: { title: 'pwned' },
    });
    expect(res.statusCode).toBe(404);
  });

  it("blocks cross-tenant DELETE /work-items/:id", async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/work-items/${aliceItem}`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("blocks cross-tenant move /work-items/:id/move", async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/work-items/${aliceItem}/move`,
      headers: { authorization: `Bearer ${bob.token}` },
      payload: { parentId: null },
    });
    expect(res.statusCode).toBe(404);
  });

  it('scopes GET /work-items to caller memberships', async () => {
    const bobList = await app.inject({
      method: 'GET',
      url: '/work-items',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(bobList.statusCode).toBe(200);
    expect((bobList.json() as { total: number }).total).toBe(0);
  });

  it("ignores projectId filter for non-member projects in GET /work-items", async () => {
    const bobList = await app.inject({
      method: 'GET',
      url: `/work-items?projectId=${aliceProject}`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(bobList.statusCode).toBe(200);
    const body = bobList.json() as { items: Array<{ id: string }>; total: number };
    expect(body.total).toBe(0);
    expect(body.items.find((i) => i.id === aliceItem)).toBeFalsy();
  });

  it('lets bob see only his own project items in GET /work-items', async () => {
    await app.inject({
      method: 'POST',
      url: '/work-items',
      headers: { authorization: `Bearer ${bob.token}` },
      payload: { kind: 'epic', title: 'Bob epic', projectId: bobProject },
    });
    const bobList = await app.inject({
      method: 'GET',
      url: '/work-items',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    const body = bobList.json() as { items: Array<{ id: string; projectId: string }> };
    expect(body.items.every((i) => i.projectId === bobProject)).toBe(true);
  });
});
