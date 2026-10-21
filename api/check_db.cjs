const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const batches = await prisma.batch.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    include: {
      stepInstances: {
        orderBy: { stage: { order: 'asc' } },
        include: {
          stage: {
            include: {
              contact: true,
              backupContact: true,
            },
          },
        },
      },
      notifications: {
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
      bills: true,
    },
  });

  console.log('=== LATEST BATCHES & STEP INSTANCES ===');
  for (const b of batches) {
    console.log(`\nBatch ${b.id} (Status: ${b.status}, Created: ${b.createdAt.toISOString()})`);
    console.log('Bills:', b.bills.map(bill => `${bill.billNumber} (Rs.${bill.amount})`).join(', '));
    for (const step of b.stepInstances) {
      console.log(`  -> Stage ${step.stage.order}: Step ${step.id} | Status: ${step.status} | Approver: ${step.stage.contact?.name} (${step.stage.contact?.email}) | Backup: ${step.stage.backupContact?.name} (${step.stage.backupContact?.email}) | OTP Hash: ${step.approvalOtpHash ? 'SET' : 'null'}`);
    }
  }

  const recentNotifications = await prisma.notification.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n=== RECENT NOTIFICATIONS ===');
  console.log(recentNotifications);
}

main().catch(console.error).finally(() => prisma.$disconnect());

