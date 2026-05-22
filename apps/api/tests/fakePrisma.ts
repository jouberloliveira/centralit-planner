import { randomUUID } from 'node:crypto';
import type {
  PrismaClient,
  Project,
  User,
  WorkItem,
  WorkItemType,
  WorkItemStatus as PrismaStatus,
  Priority as PrismaPriority,
} from '@prisma/client';

type CreateUserInput = {
  email: string;
  name: string;
  passwordHash: string;
};

type CreateProjectInput = {
  key: string;
  name: string;
  description?: string | null;
};

type CreateWorkItemInput = {
  type: WorkItemType;
  title: string;
  description?: string | null;
  status?: PrismaStatus;
  priority?: PrismaPriority;
  attributes?: object;
  project: { connect: { id: string } };
  parent?: { connect: { id: string } };
  assignee?: { connect: { id: string } };
};

function matches<T>(row: T, where: Partial<Record<keyof T, unknown>>): boolean {
  for (const [k, v] of Object.entries(where) as Array<[keyof T, unknown]>) {
    if (v === undefined) continue;
    const actual = row[k];
    if (v === null) {
      if (actual !== null && actual !== undefined) return false;
      continue;
    }
    if (typeof v === 'object' && v !== null && 'contains' in (v as Record<string, unknown>)) {
      const needle = String((v as { contains: string }).contains).toLowerCase();
      const hay = String(actual ?? '').toLowerCase();
      if (!hay.includes(needle)) return false;
      continue;
    }
    if (actual !== v) return false;
  }
  return true;
}

function evalWhere<T>(row: T, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'OR' && Array.isArray(v)) {
      if (!v.some((sub) => evalWhere(row, sub as Record<string, unknown>))) return false;
      continue;
    }
    if (!matches(row, { [k]: v } as Partial<Record<keyof T, unknown>>)) return false;
  }
  return true;
}

export interface FakePrismaState {
  users: User[];
  projects: Project[];
  workItems: WorkItem[];
}

export function createFakePrisma(): { prisma: PrismaClient; state: FakePrismaState } {
  const state: FakePrismaState = { users: [], projects: [], workItems: [] };

  const now = (): Date => new Date();

  const userApi = {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }): Promise<User | null> => {
      const found = state.users.find((u) =>
        (where.id !== undefined && u.id === where.id) ||
        (where.email !== undefined && u.email === where.email),
      );
      return found ?? null;
    },
    create: async ({ data }: { data: CreateUserInput }): Promise<User> => {
      const user: User = {
        id: randomUUID(),
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        createdAt: now(),
        updatedAt: now(),
      };
      state.users.push(user);
      return user;
    },
  };

  const projectApi = {
    findUnique: async ({ where }: { where: { id?: string; key?: string } }): Promise<Project | null> => {
      const found = state.projects.find(
        (p) =>
          (where.id !== undefined && p.id === where.id) ||
          (where.key !== undefined && p.key === where.key),
      );
      return found ?? null;
    },
    findMany: async (): Promise<Project[]> => [...state.projects],
    count: async (): Promise<number> => state.projects.length,
    create: async ({ data }: { data: CreateProjectInput }): Promise<Project> => {
      const project: Project = {
        id: randomUUID(),
        key: data.key,
        name: data.name,
        description: data.description ?? null,
        createdAt: now(),
        updatedAt: now(),
      };
      state.projects.push(project);
      return project;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Pick<Project, 'name' | 'description'>>;
    }): Promise<Project> => {
      const idx = state.projects.findIndex((p) => p.id === where.id);
      if (idx === -1) throw Object.assign(new Error('not found'), { code: 'P2025' });
      const current = state.projects[idx]!;
      const updated: Project = {
        ...current,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        updatedAt: now(),
      };
      state.projects[idx] = updated;
      return updated;
    },
    delete: async ({ where }: { where: { id: string } }): Promise<Project> => {
      const idx = state.projects.findIndex((p) => p.id === where.id);
      if (idx === -1) throw Object.assign(new Error('not found'), { code: 'P2025' });
      const [removed] = state.projects.splice(idx, 1);
      state.workItems = state.workItems.filter((w) => w.projectId !== where.id);
      return removed!;
    },
  };

  type WorkItemSelect = Partial<Record<keyof WorkItem, boolean>>;

  const workItemApi = {
    findUnique: async ({
      where,
      select,
    }: {
      where: { id: string };
      select?: WorkItemSelect;
    }): Promise<Partial<WorkItem> | null> => {
      const found = state.workItems.find((w) => w.id === where.id);
      if (!found) return null;
      if (!select) return found;
      const out: Partial<WorkItem> = {};
      for (const [k, v] of Object.entries(select) as Array<[keyof WorkItem, boolean]>) {
        if (v) out[k] = found[k] as never;
      }
      return out;
    },
    findMany: async ({
      where,
      take,
      skip,
    }: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      take?: number;
      skip?: number;
    }): Promise<WorkItem[]> => {
      let rows = state.workItems.filter((w) =>
        where ? evalWhere(w, where) : true,
      );
      rows = rows.slice(skip ?? 0, (skip ?? 0) + (take ?? rows.length));
      return rows;
    },
    count: async ({ where }: { where?: Record<string, unknown> } = {}): Promise<number> => {
      return state.workItems.filter((w) => (where ? evalWhere(w, where) : true)).length;
    },
    create: async ({ data }: { data: CreateWorkItemInput }): Promise<WorkItem> => {
      const item: WorkItem = {
        id: randomUUID(),
        type: data.type,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? 'BACKLOG',
        priority: data.priority ?? 'MEDIUM',
        attributes: (data.attributes ?? {}) as never,
        projectId: data.project.connect.id,
        parentId: data.parent?.connect.id ?? null,
        assigneeId: data.assignee?.connect.id ?? null,
        createdAt: now(),
        updatedAt: now(),
      };
      state.workItems.push(item);
      return item;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<WorkItem> => {
      const idx = state.workItems.findIndex((w) => w.id === where.id);
      if (idx === -1) throw Object.assign(new Error('not found'), { code: 'P2025' });
      const current = state.workItems[idx]!;
      const next: WorkItem = { ...current };
      for (const [k, v] of Object.entries(data)) {
        if (k === 'assignee') {
          const op = v as { connect?: { id: string }; disconnect?: boolean };
          if (op.disconnect) next.assigneeId = null;
          else if (op.connect) next.assigneeId = op.connect.id;
        } else if (k === 'parentId') {
          next.parentId = v as string | null;
        } else if (k in current) {
          (next as Record<string, unknown>)[k] = v;
        }
      }
      next.updatedAt = now();
      state.workItems[idx] = next;
      return next;
    },
    delete: async ({ where }: { where: { id: string } }): Promise<WorkItem> => {
      const idx = state.workItems.findIndex((w) => w.id === where.id);
      if (idx === -1) throw Object.assign(new Error('not found'), { code: 'P2025' });
      const [removed] = state.workItems.splice(idx, 1);
      state.workItems = state.workItems.map((w) =>
        w.parentId === where.id ? { ...w, parentId: null } : w,
      );
      return removed!;
    },
  };

  const prisma = {
    user: userApi,
    project: projectApi,
    workItem: workItemApi,
    $disconnect: async () => undefined,
  } as unknown as PrismaClient;

  return { prisma, state };
}
