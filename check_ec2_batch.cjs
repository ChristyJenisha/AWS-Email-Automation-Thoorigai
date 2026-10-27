const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const notifs = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15
  });

  console.log('Last 15 Notifications:');
  for (const n of notifs) {
    console.log(`Time: ${n.createdAt.toISOString()} | To: ${n.recipient} | Status: ${n.status} | Batch: ${n.batchId}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
