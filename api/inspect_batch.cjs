const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const batches = await prisma.batch.findMany({
    include: {
      stepInstances: { include: { stage: true } },
      bills: true,
      organization: true
    }
  });
  console.log('Batches count:', batches.length);
  for (const b of batches) {
    console.log(`\nBatch ID: ${b.id} | Status: ${b.status} | Org: ${b.organization.name}`);
    console.log('Steps:', b.stepInstances.map(s => `Stage ${s.stage.order}: ${s.status}`));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
