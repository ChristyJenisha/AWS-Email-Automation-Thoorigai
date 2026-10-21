const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const steps = await prisma.stepInstance.findMany({
    where: { batchId: 'cmvfdmvhi0007cumcihatzwtk' },
    include: { stage: { include: { contact: true, backupContact: true } } }
  });
  console.log('STEPS:', JSON.stringify(steps, null, 2));

  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityId: 'cmvfdmvhi0007cumcihatzwtk' },
        { entityId: 'cmvfdmvhj000acumchaszz1id' },
        { entityId: 'cmvfdmvhj000bcumce7rfg76v' },
      ]
    },
    orderBy: { createdAt: 'asc' }
  });
  console.log('LOGS:', JSON.stringify(logs, null, 2));
}

main().finally(() => prisma.$disconnect());
