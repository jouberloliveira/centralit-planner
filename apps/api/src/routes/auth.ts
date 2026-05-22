import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  authResponseSchema,
  loginSchema,
  registerSchema,
  userSchema,
  errorResponseSchema,
} from '@centralit/shared';
import { conflict, notFound, unauthorized } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { toUserDTO } from '../lib/mappers.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/register',
    {
      schema: {
        tags: ['auth'],
        summary: 'Register a new user',
        body: registerSchema,
        response: {
          201: authResponseSchema,
          409: errorResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { email, password, name } = req.body as z.infer<typeof registerSchema>;
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
      schema: {
        tags: ['auth'],
        summary: 'Exchange credentials for a JWT',
        body: loginSchema,
        response: {
          200: authResponseSchema,
          401: errorResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body as z.infer<typeof loginSchema>;
      const user = await app.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw unauthorized('Invalid credentials');
      }
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        throw unauthorized('Invalid credentials');
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
