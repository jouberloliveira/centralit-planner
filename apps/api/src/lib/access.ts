import type { PrismaClient, ProjectRole } from '@prisma/client';
import { forbidden, notFound } from './errors.js';

export type AccessLevel = 'reader' | 'writer' | 'owner';

const RANK: Record<ProjectRole, number> = {
  READER: 1,
  WRITER: 2,
  OWNER: 3,
};
const LEVEL_RANK: Record<AccessLevel, number> = {
  reader: 1,
  writer: 2,
  owner: 3,
};

export async function assertProjectAccess(
  prisma: PrismaClient,
  userId: string,
  projectId: string,
  min: AccessLevel,
): Promise<ProjectRole> {
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership) {
    // Opaque 404 — do not leak project existence to non-members.
    throw notFound(`Project ${projectId} not found`);
  }
  if (RANK[membership.role] < LEVEL_RANK[min]) {
    throw forbidden(`Requires ${min} role on project ${projectId}`);
  }
  return membership.role;
}

export async function getMemberProjectIds(
  prisma: PrismaClient,
  userId: string,
): Promise<string[]> {
  const rows = await prisma.projectMembership.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
}
