import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  errorResponseSchema,
  projectCreateSchema,
  projectSchema,
  projectUpdateSchema,
} from '@centralit/shared';
import { conflict, notFound, unauthorized } from '../lib/errors.js';
import { toProjectDTO } from '../lib/mappers.js';
import { assertProjectAccess, getMemberProjectIds } from '../lib/access.js';

const idParamsSchema = z.object({ id: z.string().uuid() });
const projectListResponseSchema = z.object({
  items: z.array(projectSchema),
  total: z.number().int().nonnegative(),
});

function currentUserId(req: { user?: { sub?: string } }): string {
  const sub = req.user?.sub;
  if (!sub) throw unauthorized('Missing user context');
  return sub;
}

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireAuth);

  app.get(
    '/',
    {
      schema: {
        tags: ['projects'],
        summary: 'List projects the caller is a member of',
        security: [{ bearerAuth: [] }],
        response: { 200: projectListResponseSchema, 401: errorResponseSchema },
      },
    },
    async (req) => {
      const userId = currentUserId(req);
      const memberIds = await getMemberProjectIds(app.prisma, userId);
      if (memberIds.length === 0) return { items: [], total: 0 };
      const [rows, total] = await Promise.all([
        app.prisma.project.findMany({
          where: { id: { in: memberIds } },
          orderBy: { createdAt: 'asc' },
        }),
        app.prisma.project.count({ where: { id: { in: memberIds } } }),
      ]);
      return { items: rows.map(toProjectDTO), total };
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['projects'],
        summary: 'Create a project (creator becomes owner)',
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
      const userId = currentUserId(req);
      const body = req.body as z.infer<typeof projectCreateSchema>;
      const existing = await app.prisma.project.findUnique({ where: { key: body.key } });
      if (existing) {
        throw conflict(`Project key ${body.key} already exists`);
      }
      const created = await app.prisma.project.create({
        data: { key: body.key, name: body.name, description: body.description ?? null },
      });
      await app.prisma.projectMembership.create({
        data: { userId, projectId: created.id, role: 'OWNER' },
      });
      return reply.status(201).send(toProjectDTO(created));
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['projects'],
        summary: 'Read a project (members only)',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: projectSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req) => {
      const userId = currentUserId(req);
      const { id } = req.params as z.infer<typeof idParamsSchema>;
      await assertProjectAccess(app.prisma, userId, id, 'reader');
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
        summary: 'Update a project (writer+)',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        body: projectUpdateSchema,
        response: {
          200: projectSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req) => {
      const userId = currentUserId(req);
      const { id } = req.params as z.infer<typeof idParamsSchema>;
      await assertProjectAccess(app.prisma, userId, id, 'writer');
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
        summary: 'Delete a project (owner only)',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          204: z.null(),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const userId = currentUserId(req);
      const { id } = req.params as z.infer<typeof idParamsSchema>;
      await assertProjectAccess(app.prisma, userId, id, 'owner');
      const project = await app.prisma.project.findUnique({ where: { id } });
      if (!project) {
        throw notFound(`Project ${id} not found`);
      }
      await app.prisma.project.delete({ where: { id } });
      return reply.status(204).send();
    },
  );
}
