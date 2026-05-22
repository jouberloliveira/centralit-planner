import { z } from 'zod';

export const workItemKindSchema = z.enum(['epic', 'feature', 'story', 'task']);
export type WorkItemKind = z.infer<typeof workItemKindSchema>;

export const workItemStatusSchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
]);
export type WorkItemStatus = z.infer<typeof workItemStatusSchema>;

export const workItemPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type WorkItemPriority = z.infer<typeof workItemPrioritySchema>;

export const workItemSchema = z.object({
  id: z.string().uuid(),
  kind: workItemKindSchema,
  title: z.string().min(1).max(300),
  description: z.string().nullable().optional(),
  status: workItemStatusSchema,
  priority: workItemPrioritySchema,
  projectId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorkItem = z.infer<typeof workItemSchema>;

export const workItemCreateSchema = z.object({
  kind: workItemKindSchema,
  title: z.string().min(1).max(300),
  description: z.string().max(10000).optional(),
  status: workItemStatusSchema.optional(),
  priority: workItemPrioritySchema.optional(),
  projectId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});
export type WorkItemCreate = z.infer<typeof workItemCreateSchema>;

export const workItemUpdateSchema = z
  .object({
    title: z.string().min(1).max(300),
    description: z.string().max(10000).nullable(),
    status: workItemStatusSchema,
    priority: workItemPrioritySchema,
    assigneeId: z.string().uuid().nullable(),
    attributes: z.record(z.string(), z.unknown()),
  })
  .partial();
export type WorkItemUpdate = z.infer<typeof workItemUpdateSchema>;

export const workItemMoveSchema = z.object({
  parentId: z.string().uuid().nullable(),
});
export type WorkItemMove = z.infer<typeof workItemMoveSchema>;

export const workItemListQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  kind: workItemKindSchema.optional(),
  status: workItemStatusSchema.optional(),
  priority: workItemPrioritySchema.optional(),
  parentId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  q: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type WorkItemListQuery = z.infer<typeof workItemListQuerySchema>;

export const projectSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(2).max(10),
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const projectCreateSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]+$/, 'key must be uppercase letters and digits'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});
export type ProjectCreate = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).nullable(),
  })
  .partial();
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(120),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const authResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  requestId: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
