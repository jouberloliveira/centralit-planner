import type {
  Priority as PrismaPriority,
  Project as PrismaProject,
  User as PrismaUser,
  WorkItem as PrismaWorkItem,
  WorkItemStatus as PrismaStatus,
  WorkItemType as PrismaType,
} from '@prisma/client';
import type {
  Project,
  User,
  WorkItem,
  WorkItemKind,
  WorkItemPriority,
  WorkItemStatus,
} from '@centralit/shared';

const KIND_TO_PRISMA: Record<WorkItemKind, PrismaType> = {
  epic: 'EPIC',
  feature: 'FEATURE',
  story: 'USER_STORY',
  task: 'TASK',
};
const PRISMA_TO_KIND: Record<PrismaType, WorkItemKind> = {
  EPIC: 'epic',
  FEATURE: 'feature',
  USER_STORY: 'story',
  TASK: 'task',
};

const STATUS_TO_PRISMA: Record<WorkItemStatus, PrismaStatus> = {
  backlog: 'BACKLOG',
  todo: 'TODO',
  in_progress: 'IN_PROGRESS',
  in_review: 'IN_REVIEW',
  done: 'DONE',
  cancelled: 'CANCELLED',
};
const PRISMA_TO_STATUS: Record<PrismaStatus, WorkItemStatus> = {
  BACKLOG: 'backlog',
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'in_review',
  DONE: 'done',
  CANCELLED: 'cancelled',
};

const PRIORITY_TO_PRISMA: Record<WorkItemPriority, PrismaPriority> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};
const PRISMA_TO_PRIORITY: Record<PrismaPriority, WorkItemPriority> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const kindToPrisma = (k: WorkItemKind): PrismaType => KIND_TO_PRISMA[k];
export const kindFromPrisma = (k: PrismaType): WorkItemKind => PRISMA_TO_KIND[k];
export const statusToPrisma = (s: WorkItemStatus): PrismaStatus => STATUS_TO_PRISMA[s];
export const statusFromPrisma = (s: PrismaStatus): WorkItemStatus => PRISMA_TO_STATUS[s];
export const priorityToPrisma = (p: WorkItemPriority): PrismaPriority => PRIORITY_TO_PRISMA[p];
export const priorityFromPrisma = (p: PrismaPriority): WorkItemPriority => PRISMA_TO_PRIORITY[p];

export function toWorkItemDTO(row: PrismaWorkItem): WorkItem {
  return {
    id: row.id,
    kind: kindFromPrisma(row.type),
    title: row.title,
    description: row.description,
    status: statusFromPrisma(row.status),
    priority: priorityFromPrisma(row.priority),
    projectId: row.projectId,
    parentId: row.parentId,
    assigneeId: row.assigneeId,
    attributes: (row.attributes ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toProjectDTO(row: PrismaProject): Project {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toUserDTO(row: PrismaUser): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}
