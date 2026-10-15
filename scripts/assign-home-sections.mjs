import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SECTIONS = [
  "latest-updates",
  "popular-games",
  "popular-apps",
  "recommended-tools",
  "new-games",
  "editors-choice",
];

async function main() {
  const apps = await prisma.apk.findMany({ select: { id: true } });
  let i = 0;
  for (const app of apps) {
    await prisma.apk.update({
      where: { id: app.id },
      data: { homeSection: SECTIONS[i % SECTIONS.length] },
    });
    i += 1;
  }
  const groups = await prisma.apk.groupBy({
    by: ["homeSection"],
    _count: { _all: true },
  });
  console.log(`Assigned ${apps.length} APKs:`);
  for (const g of groups) console.log(`  ${g.homeSection}: ${g._count._all}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
