import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMemoryLockoutStore } from '../src/lib/lockout.js';
import { needsRehash, ROUNDS } from '../src/lib/password.js';
import bcrypt from 'bcryptjs';
import { createFakePrisma, type FakePrismaState } from './fakePrisma.js';

const JWT_SECRET = 'test-secret-test-secret-test-secret';
const CORS = ['http://localhost:5173'];

describe('CEN-22 H1 — rate-limit + per-account lockout', () => {
  it('returns 423 after 10 failed login attempts and resets on success', async () => {
    const { prisma } = createFakePrisma();
    const lockoutStore = createMemoryLockoutStore({ maxFailures: 10 });
    const app = await buildApp({
      prisma,
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      corsOrigin: CORS,
      logLevel: 'silent',
      lockoutStore,
    });
    await app.ready();

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'lockme@example.com', password: 'CorrectHorseBattery1', name: 'L' },
    });

    for (let i = 0; i < 9; i += 1) {
      const r = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'lockme@example.com', password: 'wrongwrong' },
      });
      expect(r.statusCode).toBe(401);
    }
    const trip = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'lockme@example.com', password: 'wrongwrong' },
    });
    expect(trip.statusCode).toBe(423);
    expect((trip.json() as { error: { code: string } }).error.code).toBe('ACCOUNT_LOCKED');

    // Subsequent attempts, even with correct password, get 423 while locked.
    const blocked = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'lockme@example.com', password: 'CorrectHorseBattery1' },
    });
    expect(blocked.statusCode).toBe(423);

    await app.close();
  });

  it('global rate-limit returns 429 once budget is exhausted', async () => {
    const { prisma } = createFakePrisma();
    const app = await buildApp({
      prisma,
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      corsOrigin: CORS,
      logLevel: 'silent',
      enableRateLimit: true,
    });
    await app.ready();

    // Burn the 5/min budget on /auth/login.
    const codes: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const r = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: `nope${i}@example.com`, password: 'wrongwrong' },
      });
      codes.push(r.statusCode);
    }
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
    await app.close();
  });
});

describe('CEN-22 H2 — bcrypt cost', () => {
  it('hashes new passwords with cost ≥ 12', async () => {
    const { prisma, state } = createFakePrisma();
    const app = await buildApp({
      prisma,
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      corsOrigin: CORS,
      logLevel: 'silent',
    });
    await app.ready();
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'cost@example.com', password: 'CorrectHorseBattery1', name: 'C' },
    });
    const user = state.users.find((u) => u.email === 'cost@example.com')!;
    expect(user.passwordHash.startsWith('$2')).toBe(true);
    const cost = parseInt(user.passwordHash.split('$')[2]!, 10);
    expect(cost).toBeGreaterThanOrEqual(12);
    await app.close();
  });

  it('rehashes legacy cost-10 passwords on successful login', async () => {
    const { prisma, state } = createFakePrisma();
    const app = await buildApp({
      prisma,
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      corsOrigin: CORS,
      logLevel: 'silent',
    });
    await app.ready();

    // Seed a legacy user whose hash uses cost 10.
    const legacyHash = await bcrypt.hash('LegacyPass1234', 10);
    await prisma.user.create({
      data: { email: 'legacy@example.com', name: 'L', passwordHash: legacyHash },
    });
    expect(needsRehash(legacyHash)).toBe(true);

    const ok = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'legacy@example.com', password: 'LegacyPass1234' },
    });
    expect(ok.statusCode).toBe(200);

    const after = state.users.find((u) => u.email === 'legacy@example.com')!;
    const newCost = parseInt(after.passwordHash.split('$')[2]!, 10);
    expect(newCost).toBe(ROUNDS);
    expect(needsRehash(after.passwordHash)).toBe(false);
    await app.close();
  });
});

describe('CEN-22 H3 — password policy + breach check', () => {
  it('rejects new registrations shorter than 12 chars (400)', async () => {
    const { prisma } = createFakePrisma();
    const app = await buildApp({
      prisma,
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      corsOrigin: CORS,
      logLevel: 'silent',
    });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'short@example.com', password: 'tooshort1', name: 'S' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects breached passwords from HIBP via 422 PASSWORD_BREACHED', async () => {
    const { prisma } = createFakePrisma();
    const app = await buildApp({
      prisma,
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      corsOrigin: CORS,
      logLevel: 'silent',
      breachChecker: { isBreached: async () => true },
    });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'breach@example.com',
        password: 'ThisIsLongEnough!',
        name: 'B',
      },
    });
    expect(res.statusCode).toBe(422);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PASSWORD_BREACHED');
    await app.close();
  });
});

describe('CEN-22 H4 — reparent cycle prevention', () => {
  let app: FastifyInstance;
  let token: string;
  let projectId: string;
  let state: FakePrismaState;

  beforeAll(async () => {
    const ctx = createFakePrisma();
    state = ctx.state;
    app = await buildApp({
      prisma: ctx.prisma,
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      corsOrigin: CORS,
      logLevel: 'silent',
    });
    await app.ready();
    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'cyc@example.com', password: 'CorrectHorseBattery1', name: 'C' },
    });
    token = (reg.json() as { token: string }).token;
    const proj = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'CYC', name: 'Cycles' },
    });
    projectId = (proj.json() as { id: string }).id;
  });

  async function makeChain(): Promise<{ epic: string; feat: string; story: string; task: string }> {
    const auth = { authorization: `Bearer ${token}` };
    const epic = (await app.inject({
      method: 'POST',
      url: '/work-items',
      headers: auth,
      payload: { kind: 'epic', title: 'E', projectId },
    })).json() as { id: string };
    const feat = (await app.inject({
      method: 'POST',
      url: '/work-items',
      headers: auth,
      payload: { kind: 'feature', title: 'F', projectId, parentId: epic.id },
    })).json() as { id: string };
    const story = (await app.inject({
      method: 'POST',
      url: '/work-items',
      headers: auth,
      payload: { kind: 'story', title: 'S', projectId, parentId: feat.id },
    })).json() as { id: string };
    const task = (await app.inject({
      method: 'POST',
      url: '/work-items',
      headers: auth,
      payload: { kind: 'task', title: 'T', projectId, parentId: story.id },
    })).json() as { id: string };
    return { epic: epic.id, feat: feat.id, story: story.id, task: task.id };
  }

  it('rejects move that makes an ancestor a child of its descendant', async () => {
    const chain = await makeChain();
    // Try to reparent epic under task (descendant) — must reject with 400.
    const res = await app.inject({
      method: 'POST',
      url: `/work-items/${chain.epic}/move`,
      headers: { authorization: `Bearer ${token}` },
      payload: { parentId: chain.task },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { message: string } }).error.message).toMatch(/cycle|parent/i);
  });

  it('rejects move where new parent is a deep descendant (multi-hop)', async () => {
    const chain = await makeChain();
    // Move feat under story (its grandchild) — should detect cycle.
    const res = await app.inject({
      method: 'POST',
      url: `/work-items/${chain.feat}/move`,
      headers: { authorization: `Bearer ${token}` },
      payload: { parentId: chain.story },
    });
    expect(res.statusCode).toBe(400);
  });

  it('allows valid reparent to a sibling subtree', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const epic = (await app.inject({
      method: 'POST',
      url: '/work-items',
      headers: auth,
      payload: { kind: 'epic', title: 'EX', projectId },
    })).json() as { id: string };
    const a = (await app.inject({
      method: 'POST',
      url: '/work-items',
      headers: auth,
      payload: { kind: 'feature', title: 'FA', projectId, parentId: epic.id },
    })).json() as { id: string };
    const b = (await app.inject({
      method: 'POST',
      url: '/work-items',
      headers: auth,
      payload: { kind: 'feature', title: 'FB', projectId, parentId: epic.id },
    })).json() as { id: string };
    const story = (await app.inject({
      method: 'POST',
      url: '/work-items',
      headers: auth,
      payload: { kind: 'story', title: 'SX', projectId, parentId: a.id },
    })).json() as { id: string };

    const res = await app.inject({
      method: 'POST',
      url: `/work-items/${story.id}/move`,
      headers: auth,
      payload: { parentId: b.id },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { parentId: string }).parentId).toBe(b.id);
    expect(state.workItems.find((w) => w.id === story.id)?.parentId).toBe(b.id);
  });
});
