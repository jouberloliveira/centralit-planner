import type { Prisma, PrismaClient, WorkItem, WorkItemType } from '@prisma/client';

const VALID_PARENT_TYPES: Record<WorkItemType, readonly WorkItemType[]> = {
  EPIC: [],
  FEATURE: ['EPIC'],
  USER_STORY: ['FEATURE', 'EPIC'],
  TASK: ['USER_STORY', 'FEATURE', 'EPIC'],
};

export class WorkItemParentRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkItemParentRuleError';
  }
}

export function assertParentAllowed(
  childType: WorkItemType,
  parentType: WorkItemType | null,
): void {
  if (parentType === null) {
    return;
  }
  const allowed = VALID_PARENT_TYPES[childType];
  if (allowed.length === 0) {
    throw new WorkItemParentRuleError(`${childType} work item cannot have a parent`);
  }
  if (!allowed.includes(parentType)) {
    throw new WorkItemParentRuleError(
      `${childType} parent must be one of [${allowed.join(', ')}], got ${parentType}`,
    );
  }
}

export interface CreateWorkItemInput {
  type: WorkItemType;
  title: string;
  projectId: string;
  parentId?: string | null;
  description?: string | null;
  assigneeId?: string | null;
  status?: Prisma.WorkItemCreateInput['status'];
  priority?: Prisma.WorkItemCreateInput['priority'];
  attributes?: Prisma.InputJsonValue;
}

export class WorkItemRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateWorkItemInput): Promise<WorkItem> {
    let parentType: WorkItemType | null = null;
    if (input.parentId) {
      const parent = await this.db.workItem.findUnique({
        where: { id: input.parentId },
        select: { type: true, projectId: true },
      });
      if (!parent) {
        throw new WorkItemParentRuleError(`parent ${input.parentId} not found`);
      }
      if (parent.projectId !== input.projectId) {
        throw new WorkItemParentRuleError(
          `parent ${input.parentId} belongs to a different project`,
        );
      }
      parentType = parent.type;
    }
    assertParentAllowed(input.type, parentType);

    return this.db.workItem.create({
      data: {
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        attributes: input.attributes ?? {},
        project: { connect: { id: input.projectId } },
        parent: input.parentId ? { connect: { id: input.parentId } } : undefined,
        assignee: input.assigneeId ? { connect: { id: input.assigneeId } } : undefined,
      },
    });
  }

  async reparent(itemId: string, newParentId: string | null): Promise<WorkItem> {
    const item = await this.db.workItem.findUnique({
      where: { id: itemId },
      select: { id: true, type: true, projectId: true },
    });
    if (!item) {
      throw new WorkItemParentRuleError(`work item ${itemId} not found`);
    }

    let parentType: WorkItemType | null = null;
    if (newParentId) {
      if (newParentId === itemId) {
        throw new WorkItemParentRuleError('work item cannot be its own parent');
      }
      const parent = await this.db.workItem.findUnique({
        where: { id: newParentId },
        select: { type: true, projectId: true },
      });
      if (!parent) {
        throw new WorkItemParentRuleError(`parent ${newParentId} not found`);
      }
      if (parent.projectId !== item.projectId) {
        throw new WorkItemParentRuleError(
          `parent ${newParentId} belongs to a different project`,
        );
      }
      parentType = parent.type;
    }
    assertParentAllowed(item.type, parentType);

    return this.db.workItem.update({
      where: { id: itemId },
      data: { parentId: newParentId },
    });
  }
}
