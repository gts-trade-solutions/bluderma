import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const treatments = await prisma.hubTreatment.findMany({
    where: { isActive: true },
    select: {
      category: { select: { slug: true } },
      slug: true,
      beforeAfterCases: {
        orderBy: { sortOrder: "asc" },
        select: { beforeImage: true, afterImage: true },
      },
    },
  });

  const invalid = treatments.filter((row) => row.beforeAfterCases.length !== 2);
  const urls = treatments.flatMap((row) =>
    row.beforeAfterCases.flatMap((pair) => [pair.beforeImage, pair.afterImage])
  );
  const duplicateUrls = urls.length - new Set(urls).size;

  console.log({
    treatments: treatments.length,
    cases: treatments.reduce((sum, row) => sum + row.beforeAfterCases.length, 0),
    images: urls.length,
    treatmentsWithoutTwoCases: invalid.map(
      (row) => `${row.category.slug}/${row.slug}:${row.beforeAfterCases.length}`
    ),
    duplicateUrls,
  });
}

main()
  .finally(async () => prisma.$disconnect());
