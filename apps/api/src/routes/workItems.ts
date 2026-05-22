import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  errorResponseSchema,
  workItemCreateSchema,
  workItemListQuerySchema,
  workItemMoveSchema,
  workItemSchema,
  workItemUpdateSchema,
} from '@centralit/shared';
import { badRequest, notFound } from '../lib/errors.js';
import {
  kindToPrisma,
  priorityToPrisma,
  statusToPrisma,
  toWorkItemDTO,
} from '../lib/mappers.js';
import { assertParentAllowed, WorkItemParentRuleError } from '../db/workItems.js';

const idParamsSchema = z.object({ id: z.string().uuid() });
const listResponseSchema = z.object({
  items: z.array(workItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export async function registerWorkItemRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireAuth);

  app.get(
    '/',
    {
      schema: {
        tags: ['work-items'],
        summary: 'List work items with filters',
        security: [{ bearerAuth: [] }],
        querystring: workItemListQuerySchema,
        response: { 200: listResponseSchema, 401: errorResponseSchema },
      },
    },
    async (req) => {
      const q = req.query as z.infer<typeof workItemListQuerySchema>;
      const where = {
        ...(q.projectId ? { projectId: q.projectId } : {}),
        ...(q.kind ? { type: kindToPrisma(q.kind) } : {}),
        ...(q.status ? { status: statusToPrisma(q.status) } : {}),
        ...(q.priority ? { priority: priorityToPrisma(q.priority) } : {}),
        ...(q.parentId !== undefined ? { parentId: q.parentId } : {}),
        ...(q.assigneeId !== undefined ? { assigneeId: q.assigneeId } : {}),
        ...(q.q
          ? {
              OR: [
                { title: { contains: q.q, mode: 'insensitive' as const } },
                { description: { contains: q.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        app.prisma.workItem.findMany({
          where,
          orderBy: [{ createdAt: 'asc' }],
          take: q.limit,
          skip: q.offset,
        }),
        app.prisma.workItem.count({ where }),
      ]);
      return {
        items: rows.map(toWorkItemDTO),
        total,
        limit: q.limit,
        offset: q.offset,
      };
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['work-items'],
        summary: 'Create a work item',
        security: [{ bearerAuth: [] }],
        body: workItemCreateSchema,
        response: {
          201: workItemSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const body = req.body as z.infer<typeof workItemCreateSchema>;
      const project = await app.prisma.project.findUnique({ where: { id: body.projectId } });
      if (!project) {
        throw notFound(`Project ${body.projectId} not found`);
      }

      let parentType: ReturnType<typeof kindToPrisma> | null = null;
      if (body.parentId) {
        const parent = await app.prisma.workItem.findUnique({
          where: { id: body.parentId },
          select: { type: true, projectId: true },
        });
        if (!parent) {
          throw notFound(`Parent ${body.parentId} not found`);
        }
        if (parent.projectId !== body.projectId) {
          throw badRequest('Parent belongs to a different project');
        }
        parentType = parent.type;
      }

      try {
        assertParentAllowed(kindToPrisma(body.kind), parentType);
      } catch (err) {
        if (err instanceof WorkItemParentRuleError) {
          throw badRequest(err.message);
        }
        throw err;
      }

      if (body.assigneeId) {
        const user = await app.prisma.user.findUnique({ where: { id: body.assigneeId } });
        if (!user) {
          throw notFound(`Assignee ${body.assigneeId} not found`);
        }
      }

      const created = await app.prisma.workItem.create({
        data: {
          type: kindToPrisma(body.kind),
          title: body.title,
          description: body.description ?? null,
          status: body.status ? statusToPrisma(body.status) : undefined,
          priority: body.priority ? priorityToPrisma(body.priority) : undefined,
          attributes: (body.attributes ?? {}) as object,
          project: { connect: { id: body.projectId } },
          parent: body.parentId ? { connect: { id: body.parentId } } : undefined,
          assignee: body.assigneeId ? { connect: { id: body.assigneeId } } : undefined,
        },
      });
      return reply.status(201).send(toWorkItemDTO(created));
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['work-items'],
        summary: 'Read a work item',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: workItemSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req) => {
      const { id } = req.params as z.infer<typeof idParamsSchema>;
      const item = await app.prisma.workItem.findUnique({ where: { id } });
      if (!item) {
        throw notFound(`Work item ${id} not found`);
      }
      return toWorkItemDTO(item);
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['work-items'],
        summary: 'Update a work item',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        body: workItemUpdateSchema,
        response: {
          200: workItemSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req) => {
      const { id } = req.params as z.infer<typeof idParamsSchema>;
      const patch = req.body as z.infer<typeof workItemUpdateSchema>;
      const item = await app.prisma.workItem.findUnique({ where: { id } });
      if (!item) {
        throw notFound(`Work item ${id} not found`);
      }

      if (patch.assigneeId !== undefined && patch.assigneeId !== null) {
        const user = await app.prisma.user.findUnique({ where: { id: patch.assigneeId } });
        if (!user) {
          throw notFound(`Assignee ${patch.assigneeId} not found`);
        }
      }

      const updated = await app.prisma.workItem.update({
        where: { id },
        data: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.status !== undefined ? { status: statusToPrisma(patch.status) } : {}),
          ...(patch.priority !== undefined ? { priority: priorityToPrisma(patch.priority) } : {}),
          ...(patch.assigneeId !== undefined
            ? patch.assigneeId === null
              ? { assignee: { disconnect: true } }
              : { assignee: { connect: { id: patch.assigneeId } } }
            : {}),
          ...(patch.attributes !== undefined ? { attributes: patch.attributes as object } : {}),
        },
      });
      return toWorkItemDTO(updated);
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['work-items'],
        summary: 'Delete a work item',
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
      const item = await app.prisma.workItem.findUnique({ where: { id } });
      if (!item) {
        throw notFound(`Work item ${id} not found`);
      }
      await app.prisma.workItem.delete({ where: { id } });
      return reply.status(204).send();
    },
  );

  app.post(
    '/:id/move',
    {
      schema: {
        tags: ['work-items'],
        summary: 'Reparent a work item (validates parent-type rules)',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        body: workItemMoveSchema,
        response: {
          200: workItemSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req) => {
      const { id } = req.params as z.infer<typeof idParamsSchema>;
      const { parentId } = req.body as z.infer<typeof workItemMoveSchema>;

      const item = await app.prisma.workItem.findUnique({
        where: { id },
        select: { id: true, type: true, projectId: true },
      });
      if (!item) {
        throw notFound(`Work item ${id} not found`);
      }

      let parentType: ReturnType<typeof kindToPrisma> | null = null;
      if (parentId) {
        if (parentId === id) {
          throw badRequest('Work item cannot be its own parent');
        }
        const parent = await app.prisma.workItem.findUnique({
          where: { id: parentId },
          select: { type: true, projectId: true },
        });
        if (!parent) {
          throw notFound(`Parent ${parentId} not found`);
        }
        if (parent.projectId !== item.projectId) {
          throw badRequest('Parent belongs to a different project');
        }
        parentType = parent.type;
      }

      try {
        assertParentAllowed(item.type, parentType);
      } catch (err) {
        if (err instanceof WorkItemParentRuleError) {
          throw badRequest(err.message);
        }
        throw err;
      }

      const updated = await app.prisma.workItem.update({
        where: { id },
        data: { parentId },
      });
      return toWorkItemDTO(updated);
    },
  );
}
