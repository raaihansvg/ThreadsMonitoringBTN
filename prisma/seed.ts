import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Skrip seed awal kosong (Tahap 0)
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
