import { PrismaClient, WorkItemType, WorkItemStatus, Priority } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.workItem.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@centralit.local',
      name: 'Demo User',
      passwordHash: '$2b$10$seedonlyplaceholderhashvalue123456789012345678901234',
    },
  });

  const project = await prisma.project.create({
    data: {
      name: 'Acme Web Redesign',
      key: 'ACME',
      description: 'Demo project seeded for development.',
    },
  });

  const epicId = randomUUID();
  await prisma.workItem.create({
    data: {
      id: epicId,
      type: WorkItemType.EPIC,
      title: 'Checkout redesign',
      description: 'End-to-end overhaul of the checkout flow.',
      status: WorkItemStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      projectId: project.id,
      assigneeId: demoUser.id,
    },
  });

  const featureCartId = randomUUID();
  const featurePaymentId = randomUUID();
  await prisma.workItem.createMany({
    data: [
      {
        id: featureCartId,
        type: WorkItemType.FEATURE,
        title: 'Cart UX refresh',
        status: WorkItemStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        projectId: project.id,
        parentId: epicId,
      },
      {
        id: featurePaymentId,
        type: WorkItemType.FEATURE,
        title: 'Payment integration',
        status: WorkItemStatus.TODO,
        priority: Priority.HIGH,
        projectId: project.id,
        parentId: epicId,
      },
    ],
  });

  const story1Id = randomUUID();
  const story2Id = randomUUID();
  const story3Id = randomUUID();
  const story4Id = randomUUID();
  await prisma.workItem.createMany({
    data: [
      {
        id: story1Id,
        type: WorkItemType.USER_STORY,
        title: 'As a user, I can update item quantity inline',
        status: WorkItemStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        projectId: project.id,
        parentId: featureCartId,
      },
      {
        id: story2Id,
        type: WorkItemType.USER_STORY,
        title: 'As a user, I see real-time price totals',
        status: WorkItemStatus.TODO,
        priority: Priority.MEDIUM,
        projectId: project.id,
        parentId: featureCartId,
      },
      {
        id: story3Id,
        type: WorkItemType.USER_STORY,
        title: 'As a user, I can pay with saved cards',
        status: WorkItemStatus.TODO,
        priority: Priority.HIGH,
        projectId: project.id,
        parentId: featurePaymentId,
      },
      {
        id: story4Id,
        type: WorkItemType.USER_STORY,
        title: 'As a user, I can pay with PIX',
        status: WorkItemStatus.BACKLOG,
        priority: Priority.MEDIUM,
        projectId: project.id,
        parentId: featurePaymentId,
      },
    ],
  });

  await prisma.workItem.createMany({
    data: [
      {
        type: WorkItemType.TASK,
        title: 'Wire inline quantity stepper to API',
        status: WorkItemStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        projectId: project.id,
        parentId: story1Id,
      },
      {
        type: WorkItemType.TASK,
        title: 'Add empty-cart skeleton',
        status: WorkItemStatus.TODO,
        priority: Priority.LOW,
        projectId: project.id,
        parentId: story1Id,
      },
      {
        type: WorkItemType.TASK,
        title: 'Compute totals server-side',
        status: WorkItemStatus.TODO,
        priority: Priority.MEDIUM,
        projectId: project.id,
        parentId: story2Id,
      },
      {
        type: WorkItemType.TASK,
        title: 'Integrate Stripe SDK',
        status: WorkItemStatus.TODO,
        priority: Priority.HIGH,
        projectId: project.id,
        parentId: story3Id,
      },
      {
        type: WorkItemType.TASK,
        title: 'Tokenize card on client',
        status: WorkItemStatus.BACKLOG,
        priority: Priority.HIGH,
        projectId: project.id,
        parentId: story3Id,
      },
      {
        type: WorkItemType.TASK,
        title: 'Render QR code component',
        status: WorkItemStatus.BACKLOG,
        priority: Priority.LOW,
        projectId: project.id,
        parentId: story4Id,
      },
    ],
  });

  const total = await prisma.workItem.count();
  console.log(`Seeded ${total} work items in project ${project.key}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
