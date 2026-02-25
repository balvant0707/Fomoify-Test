import prisma from "../db.server";

const normalizeShop = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

async function upsertWithSqlFallback(shop, accessToken) {
  const now = new Date();
  const tables = ["shop", "Shop"];
  let lastError;

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`${table}\` (\`shop\`, \`accessToken\`, \`installed\`, \`createdAt\`, \`updatedAt\`)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           \`accessToken\` = VALUES(\`accessToken\`),
           \`installed\` = VALUES(\`installed\`),
           \`updatedAt\` = VALUES(\`updatedAt\`)`,
        shop,
        accessToken ?? null,
        1,
        now,
        now,
      );
      return true;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function upsertInstalledShop({ shop: rawShop, accessToken }) {
  const shop = normalizeShop(rawShop);
  if (!shop) return null;

  try {
    return await prisma.shop.upsert({
      where: { shop },
      update: {
        accessToken: accessToken ?? null,
        installed: true,
        uninstalledAt: null,
      },
      create: {
        shop,
        accessToken: accessToken ?? null,
        installed: true,
      },
    });
  } catch (error) {
    console.error("[shop upsert] prisma upsert failed, trying SQL fallback:", error);
  }

  await upsertWithSqlFallback(shop, accessToken);

  try {
    return await prisma.shop.findUnique({ where: { shop } });
  } catch {
    return { shop, accessToken: accessToken ?? null, installed: true };
  }
}
