import { z } from 'zod';

export const issueKindSchema = z.enum(['epic', 'feature', 'story', 'task']);
export type IssueKind = z.infer<typeof issueKindSchema>;

export const issueStatusSchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
]);
export type IssueStatus = z.infer<typeof issueStatusSchema>;

export const issuePrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type IssuePriority = z.infer<typeof issuePrioritySchema>;

export const issueBaseSchema = z.object({
  id: z.string().uuid(),
  kind: issueKindSchema,
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  status: issueStatusSchema,
  priority: issuePrioritySchema,
  parentId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IssueBase = z.infer<typeof issueBaseSchema>;

export const issueCreateSchema = issueBaseSchema
  .pick({
    kind: true,
    title: true,
    description: true,
    priority: true,
    parentId: true,
    projectId: true,
  })
  .extend({
    status: issueStatusSchema.default('backlog'),
  });
export type IssueCreate = z.infer<typeof issueCreateSchema>;

export const issueUpdateSchema = issueBaseSchema
  .pick({
    title: true,
    description: true,
    status: true,
    priority: true,
    parentId: true,
    assigneeId: true,
  })
  .partial();
export type IssueUpdate = z.infer<typeof issueUpdateSchema>;

export const projectSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(2).max(10),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const projectCreateSchema = projectSchema.pick({
  key: true,
  name: true,
  description: true,
});
export type ProjectCreate = z.infer<typeof projectCreateSchema>;

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
