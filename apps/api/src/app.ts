import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { HttpError } from './lib/errors.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerWorkItemRoutes } from './routes/workItems.js';

export interface BuildAppOptions {
  prisma: PrismaClient;
  jwtSecret: string;
  jwtExpiresIn?: string;
  corsOrigin?: string | string[] | boolean;
  logLevel?: string;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    jwtExpiresIn: string;
    requireAuth: (req: FastifyRequest) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: opts.logLevel ?? 'info',
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', singleLine: true } },
    },
    genReqId: (req): string => {
      const incoming = req.headers['x-request-id'];
      if (typeof incoming === 'string' && incoming.length > 0 && incoming.length < 128) {
        return incoming;
      }
      return randomUUID();
    },
    disableRequestLogging: false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('prisma', opts.prisma);
  app.decorate('jwtExpiresIn', opts.jwtExpiresIn ?? '7d');

  app.addHook('onResponse', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: opts.corsOrigin ?? true,
    credentials: true,
  });
  await app.register(jwt, {
    secret: opts.jwtSecret,
    sign: { expiresIn: opts.jwtExpiresIn ?? '7d' },
  });

  app.decorate('requireAuth', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new HttpError(401, 'UNAUTHORIZED', 'Missing or invalid token');
    }
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'CentralIT Planner API',
        description: 'REST API for projects and work items (epics, features, stories, tasks).',
        version: '0.1.0',
      },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  app.setErrorHandler((err, req, reply) => {
    const requestId = req.id;

    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({
        error: { code: err.code, message: err.message, details: err.details },
        requestId,
      });
    }

    if (err instanceof ZodError || (err as { name?: string }).name === 'ZodError') {
      const zErr = err as ZodError;
      return reply.status(400).send({
        error: { code: 'BAD_REQUEST', message: 'Validation failed', details: zErr.issues },
        requestId,
      });
    }

    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      return reply.status(409).send({
        error: { code: 'CONFLICT', message: 'Unique constraint violation' },
        requestId,
      });
    }
    if (code === 'P2025') {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
        requestId,
      });
    }
    if (code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' },
        requestId,
      });
    }

    req.log.error({ err }, 'unhandled error');
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.status(status).send({
      error: { code: 'INTERNAL', message: 'Internal server error' },
      requestId,
    });
  });

  await app.register(registerHealthRoutes);
  await app.register(registerAuthRoutes, { prefix: '/auth' });
  await app.register(registerProjectRoutes, { prefix: '/projects' });
  await app.register(registerWorkItemRoutes, { prefix: '/work-items' });

  return app;
}
