import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  errorResponseSchema,
  projectCreateSchema,
  projectSchema,
  projectUpdateSchema,
} from '@centralit/shared';
import { conflict, notFound } from '../lib/errors.js';
import { toProjectDTO } from '../lib/mappers.js';

const idParamsSchema = z.object({ id: z.string().uuid() });
const projectListResponseSchema = z.object({
  items: z.array(projectSchema),
  total: z.number().int().nonnegative(),
});

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireAuth);

  app.get(
    '/',
    {
      schema: {
        tags: ['projects'],
        summary: 'List projects',
        security: [{ bearerAuth: [] }],
        response: { 200: projectListResponseSchema, 401: errorResponseSchema },
      },
    },
    async () => {
      const [rows, total] = await Promise.all([
        app.prisma.project.findMany({ orderBy: { createdAt: 'asc' } }),
        app.prisma.project.count(),
      ]);
      return { items: rows.map(toProjectDTO), total };
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['projects'],
        summary: 'Create a project',
        security: [{ bearerAuth: [] }],
        body: projectCreateSchema,
        response: {
          201: projectSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const body = req.body as z.infer<typeof projectCreateSchema>;
      const existing = await app.prisma.project.findUnique({ where: { key: body.key } });
      if (existing) {
        throw conflict(`Project key ${body.key} already exists`);
      }
      const created = await app.prisma.project.create({
        data: { key: body.key, name: body.name, description: body.description ?? null },
      });
      return reply.status(201).send(toProjectDTO(created));
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['projects'],
        summary: 'Read a project',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: projectSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req) => {
      const { id } = req.params as z.infer<typeof idParamsSchema>;
      const project = await app.prisma.project.findUnique({ where: { id } });
      if (!project) {
        throw notFound(`Project ${id} not found`);
      }
      return toProjectDTO(project);
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['projects'],
        summary: 'Update a project',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        body: projectUpdateSchema,
        response: {
          200: projectSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req) => {
      const { id } = req.params as z.infer<typeof idParamsSchema>;
      const patch = req.body as z.infer<typeof projectUpdateSchema>;
      const project = await app.prisma.project.findUnique({ where: { id } });
      if (!project) {
        throw notFound(`Project ${id} not found`);
      }
      const updated = await app.prisma.project.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
        },
      });
      return toProjectDTO(updated);
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['projects'],
        summary: 'Delete a project',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          204: z.null(),
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as z.infer<typeof idParamsSchema>;
      const project = await app.prisma.project.findUnique({ where: { id } });
      if (!project) {
        throw notFound(`Project ${id} not found`);
      }
      await app.prisma.project.delete({ where: { id } });
      return reply.status(204).send();
    },
  );
}
