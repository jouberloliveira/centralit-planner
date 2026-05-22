import { describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createFakePrisma } from './fakePrisma.js';
import { loadEnv } from '../src/env.js';

async function makeApp(corsOrigin: string[]): Promise<FastifyInstance> {
  const { prisma } = createFakePrisma();
  const app = await buildApp({
    prisma,
    jwtSecret: 'test-secret-test-secret-test-secret',
    jwtExpiresIn: '1h',
    corsOrigin,
    logLevel: 'silent',
  });
  await app.ready();
  return app;
}

describe('CORS allow-list (CEN-19)', () => {
  it('reflects an allowed origin with credentials', async () => {
    const app = await makeApp(['http://localhost:5173']);
    try {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/projects',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'authorization',
        },
      });
      expect(res.statusCode).toBeLessThan(300);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['vary']).toMatch(/Origin/i);
    } finally {
      await app.close();
    }
  });

  it('rejects a foreign origin: no ACAO, no ACAC', async () => {
    const app = await makeApp(['http://localhost:5173']);
    try {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/projects',
        headers: {
          origin: 'https://evil.example',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'authorization',
        },
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('does NOT reflect Origin on actual GET from foreign origin', async () => {
    const app = await makeApp(['http://localhost:5173']);
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: 'https://evil.example' },
      });
      const acao = res.headers['access-control-allow-origin'];
      expect(acao === undefined || acao === 'false' || acao === '').toBe(true);
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('refuses to build with an empty allow-list', async () => {
    const { prisma } = createFakePrisma();
    await expect(
      buildApp({
        prisma,
        jwtSecret: 'test-secret-test-secret-test-secret',
        corsOrigin: [],
        logLevel: 'silent',
      }),
    ).rejects.toThrow(/corsOrigin/i);
  });
});

describe('env: CORS_ORIGIN validation (CEN-19)', () => {
  const base = {
    DATABASE_URL: 'postgresql://x/y',
    JWT_SECRET: 'x'.repeat(40),
  };

  it('rejects CORS_ORIGIN="*"', () => {
    expect(() => loadEnv({ ...base, CORS_ORIGIN: '*' } as Record<string, string>)).toThrow();
  });

  it('rejects empty CORS_ORIGIN', () => {
    expect(() => loadEnv({ ...base, CORS_ORIGIN: '' } as Record<string, string>)).toThrow();
  });

  it('rejects missing CORS_ORIGIN', () => {
    expect(() => loadEnv(base as Record<string, string>)).toThrow();
  });

  it('rejects "*" inside a list', () => {
    expect(() =>
      loadEnv({ ...base, CORS_ORIGIN: 'http://localhost:5173,*' } as Record<string, string>),
    ).toThrow();
  });

  it('accepts a comma-separated allow-list', () => {
    const env = loadEnv({
      ...base,
      CORS_ORIGIN: 'http://localhost:5173, https://app.example.com',
    } as Record<string, string>);
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173, https://app.example.com');
  });
});
