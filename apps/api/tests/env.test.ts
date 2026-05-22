import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { loadEnv } from '../src/env.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  CORS_ORIGIN: 'http://localhost:5173',
};

describe('loadEnv', () => {
  it('throws ZodError when JWT_SECRET is missing', () => {
    expect(() => loadEnv({ ...baseEnv })).toThrowError(ZodError);
  });

  it('throws ZodError when JWT_SECRET is shorter than 32 chars', () => {
    expect(() =>
      loadEnv({ ...baseEnv, JWT_SECRET: 'too-short-secret' }),
    ).toThrowError(/JWT_SECRET must be ≥32 chars/);
  });

  it('accepts a 32+ char JWT_SECRET in development', () => {
    const env = loadEnv({
      ...baseEnv,
      JWT_SECRET: 'a'.repeat(32),
    });
    expect(env.JWT_SECRET).toHaveLength(32);
  });

  it('refuses to boot in production when secret looks like a placeholder', () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'development-secret-please-change-this-now',
      }),
    ).toThrowError(/development placeholder/);
  });

  it('refuses prod secrets containing "default"', () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'default-default-default-default-default',
      }),
    ).toThrowError(/development placeholder/);
  });

  it('refuses prod secrets containing "example"', () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'example-example-example-example-example',
      }),
    ).toThrowError(/development placeholder/);
  });

  it('accepts a strong production secret', () => {
    const env = loadEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'kQ8nWp2YxR7vTc4mBjLfHsDgZaUeNqAv5XwPyMnKtJrCbVhFu3oEi9SlOp',
    });
    expect(env.NODE_ENV).toBe('production');
  });
});
