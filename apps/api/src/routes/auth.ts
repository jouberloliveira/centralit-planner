import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  authResponseSchema,
  loginSchema,
  registerSchema,
  userSchema,
  errorResponseSchema,
} from '@centralit/shared';
import {
  accountLocked,
  conflict,
  notFound,
  passwordBreached,
  unauthorized,
} from '../lib/errors.js';
import { hashPassword, needsRehash, verifyPassword } from '../lib/password.js';
import { toUserDTO } from '../lib/mappers.js';

const AUTH_ROUTE_RATE_LIMIT = { max: 5, timeWindow: '1 minute' } as const;

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/register',
    {
      config: { rateLimit: AUTH_ROUTE_RATE_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Register a new user',
        body: registerSchema,
        response: {
          201: authResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { email, password, name } = req.body as z.infer<typeof registerSchema>;
      if (await app.breachChecker.isBreached(password)) {
        throw passwordBreached(
          'Password appears in known breach corpora; choose a different one',
        );
      }
      const existing = await app.prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw conflict('Email already registered');
      }
      const passwordHash = await hashPassword(password);
      const user = await app.prisma.user.create({
        data: { email, name, passwordHash },
      });
      const token = await reply.jwtSign({ sub: user.id, email: user.email });
      return reply.status(201).send({ token, user: toUserDTO(user) });
    },
  );

  app.post(
    '/login',
    {
      config: { rateLimit: AUTH_ROUTE_RATE_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Exchange credentials for a JWT',
        body: loginSchema,
        response: {
          200: authResponseSchema,
          401: errorResponseSchema,
          423: errorResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body as z.infer<typeof loginSchema>;
      const lockKey = email.toLowerCase();

      const lockUntil = await app.lockoutStore.isLocked(lockKey);
      if (lockUntil) {
        throw accountLocked(Math.max(1, Math.ceil((lockUntil - Date.now()) / 1000)));
      }

      const user = await app.prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Record under the submitted email so account-enumeration probes also
        // burn lockout budget; still return generic 401.
        await app.lockoutStore.recordFailure(lockKey);
        throw unauthorized('Invalid credentials');
      }
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        const result = await app.lockoutStore.recordFailure(lockKey);
        if (result.locked && result.lockUntil) {
          throw accountLocked(Math.max(1, Math.ceil((result.lockUntil - Date.now()) / 1000)));
        }
        throw unauthorized('Invalid credentials');
      }

      await app.lockoutStore.reset(lockKey);
      if (needsRehash(user.passwordHash)) {
        try {
          const newHash = await hashPassword(password);
          await app.prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
        } catch (err) {
          req.log.warn({ err, userId: user.id }, 'rehash on login failed; continuing');
        }
      }

      const token = await reply.jwtSign({ sub: user.id, email: user.email });
      return reply.send({ token, user: toUserDTO(user) });
    },
  );

  app.get(
    '/me',
    {
      preHandler: app.requireAuth,
      schema: {
        tags: ['auth'],
        summary: 'Return the current user',
        security: [{ bearerAuth: [] }],
        response: {
          200: userSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req) => {
      const sub = req.user!.sub;
      const user = await app.prisma.user.findUnique({ where: { id: sub } });
      if (!user) {
        throw notFound('User not found');
      }
      return toUserDTO(user);
    },
  );
}
