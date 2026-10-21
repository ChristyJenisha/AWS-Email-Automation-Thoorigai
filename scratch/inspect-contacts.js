const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const contacts = await prisma.contact.findMany({
    select: { id: true, name: true, email: true, isActive: true },
  });
  console.log('CONTACTS:', JSON.stringify(contacts, null, 2));

  const stages = await prisma.workflowStage.findMany({
    select: {
      id: true,
      contactId: true,
      backupContactId: true,
      template: { select: { id: true, name: true } },
    },
  });
  console.log('STAGES:', JSON.stringify(stages, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

