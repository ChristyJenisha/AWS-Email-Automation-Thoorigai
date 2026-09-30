import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const organization = await prisma.organization.upsert({
    where: { id: 'demo-org' },
    update: { name: 'Demo Organization' },
    create: { id: 'demo-org', name: 'Demo Organization' },
  });

  const approver = await prisma.contact.upsert({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: 'approver@example.test',
      },
    },
    update: { name: 'Demo Approver', role: 'Approver', isActive: true },
    create: {
      id: 'demo-approver',
      organizationId: organization.id,
      name: 'Demo Approver',
      email: 'approver@example.test',
      role: 'Approver',
    },
  });

  const backup = await prisma.contact.upsert({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: 'backup@example.test',
      },
    },
    update: { name: 'Demo Backup Approver', role: 'Backup approver', isActive: true },
    create: {
      id: 'demo-backup-approver',
      organizationId: organization.id,
      name: 'Demo Backup Approver',
      email: 'backup@example.test',
      role: 'Backup approver',
    },
  });

  const template = await prisma.workflowTemplate.upsert({
    where: { id: 'demo-workflow' },
    update: { name: 'Demo approval workflow', organizationId: organization.id },
    create: {
      id: 'demo-workflow',
      organizationId: organization.id,
      name: 'Demo approval workflow',
    },
  });

  const workflowStage = await prisma.workflowStage.upsert({
    where: { templateId_order: { templateId: template.id, order: 1 } },
    update: {
      contactId: approver.id,
      backupContactId: backup.id,
      reminderIntervalHours: 24,
      maxReminders: 3,
    },
    create: {
      id: 'demo-stage-1',
      templateId: template.id,
      order: 1,
      contactId: approver.id,
      backupContactId: backup.id,
      reminderIntervalHours: 24,
      maxReminders: 3,
    },
  });

  const batch = await prisma.batch.upsert({
    where: { id: 'demo-batch' },
    update: { organizationId: organization.id, templateId: template.id, status: 'IN_PROGRESS' },
    create: {
      id: 'demo-batch',
      organizationId: organization.id,
      templateId: template.id,
      status: 'IN_PROGRESS',
    },
  });

  const sampleBills = [
    { billNumber: 'INV-2481', amount: 124000, balanceDue: 124000, dueDate: '2026-09-18' },
    { billNumber: 'INV-2478', amount: 92000, balanceDue: 92000, dueDate: '2026-09-30' },
    { billNumber: 'INV-2472', amount: 84500, balanceDue: 84500, dueDate: '2026-09-22' },
  ];

  for (const bill of sampleBills) {
    await prisma.bill.upsert({
      where: { batchId_billNumber: { batchId: batch.id, billNumber: bill.billNumber } },
      update: { amount: bill.amount, balanceDue: bill.balanceDue, dueDate: new Date(bill.dueDate) },
      create: {
        batchId: batch.id,
        billNumber: bill.billNumber,
        amount: bill.amount,
        balanceDue: bill.balanceDue,
        dueDate: new Date(bill.dueDate),
      },
    });
  }

  await prisma.stepInstance.upsert({
    where: { batchId_stageId: { batchId: batch.id, stageId: workflowStage.id } },
    update: {
      status: 'ALERTED',
      alertedAt: new Date(),
      nextReminderAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      reminderCount: 1,
    },
    create: {
      batchId: batch.id,
      stageId: workflowStage.id,
      status: 'ALERTED',
      alertedAt: new Date(),
      nextReminderAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      reminderCount: 1,
    },
  });

  console.log('Seeded demo organization, workflow, and batch data.');
} finally {
  await prisma.$disconnect();
}