import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const initialMembers = ['Pranish', 'Santosh', 'Prashant', 'Samrat', 'Kshitiz'];
  
  for (const name of initialMembers) {
    await prisma.member.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('Seed data created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
