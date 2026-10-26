import { PrismaClient } from '../api/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();

async function main() {
  const target = process.argv[2]?.trim();

  if (!target) {
    console.log('Usage: node scripts/delete_contact_permanently.mjs <email-or-name>');
    console.log('\nCurrent contacts in database:');
    const contacts = await prisma.contact.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    for (const c of contacts) {
      console.log(` - ${c.name} (${c.email}) [Role: ${c.role}, Status: ${c.isActive ? 'Active' : 'Inactive'}]`);
    }
    return;
  }

  const contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { email: { equals: target.toLowerCase() } },
        { name: { equals: target } },
      ],
    },
  });

  if (!contact) {
    console.error(`Error: Contact matching "${target}" was not found.`);
    process.exit(1);
  }

  console.log(`Found contact: ${contact.name} (${contact.email}) [ID: ${contact.id}]`);

  // 1. Unlink backup approver slots
  const unlinked = await prisma.workflowStage.updateMany({
    where: { backupContactId: contact.id },
    data: { backupContactId: null },
  });
  if (unlinked.count > 0) {
    console.log(`Unlinked backup role from ${unlinked.count} workflow stage(s).`);
  }

  // 2. Check primary approver stages
  const primaryStages = await prisma.workflowStage.findMany({
    where: { contactId: contact.id },
    include: {
      template: {
        include: {
          batches: true,
        },
      },
    },
  });

  for (const stage of primaryStages) {
    const template = stage.template;
    if (template) {
      const activeBatches = template.batches.filter(
        (b) => !b.deletedAt && (b.status === 'IN_PROGRESS' || b.status === 'READY_FOR_PAYMENT')
      );

      if (activeBatches.length > 0) {
        console.error(
          `Cannot delete: Workflow template "${template.name}" has ${activeBatches.length} active in-flight batch(es). Please settle or cancel those batches first.`
        );
        process.exit(1);
      }

      // Purge any cancelled/deleted batches of this template
      const batchIds = template.batches.map((b) => b.id);
      if (batchIds.length > 0) {
        const bills = await prisma.bill.findMany({
          where: { batchId: { in: batchIds } },
          select: { id: true },
        });
        const billIds = bills.map((b) => b.id);

        await prisma.paymentAllocation.deleteMany({ where: { billId: { in: billIds } } });
        await prisma.payment.deleteMany({ where: { batchId: { in: batchIds } } });
        await prisma.notification.deleteMany({ where: { stepInstance: { batchId: { in: batchIds } } } });
        await prisma.stepInstance.deleteMany({ where: { batchId: { in: batchIds } } });
        await prisma.bill.deleteMany({ where: { batchId: { in: batchIds } } });
        await prisma.batch.deleteMany({ where: { id: { in: batchIds } } });
      }

      await prisma.workflowStage.deleteMany({ where: { templateId: template.id } });
      await prisma.workflowTemplate.deleteMany({ where: { id: template.id } });
      console.log(`Cleaned up unused test workflow template: "${template.name}"`);
    }
  }

  // 3. Delete the contact permanently
  await prisma.contact.delete({ where: { id: contact.id } });
  console.log(`\nSUCCESS: Contact "${contact.name}" (${contact.email}) was permanently deleted from the database!`);
}

main()
  .catch((err) => {
    console.error('Operation failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
