// app/utils/ensureShop.server.js
import prisma from "../db.server.js";

const norm = (s) => (s || "").toLowerCase().replace(/^https?:\/\//, "");

/**
 * Ensure Shop row exists.
 * If missing, try to backfill from session table (offline_<shop> or any row for that shop).
 * Returns the Shop row (existing/created) or null.
 */
export async function ensureShopRow(rawShop) {
  const shop = norm(rawShop);
  if (!shop) return null;

  // 1) Already exists?
  const existing = await prisma.shop.findUnique({ where: { shop } });
  if (existing) return existing;

  // 2) Try to read offline session first, else any session for that shop
  const offlineId = `offline_${shop}`;
  let sess =
    (await prisma.session.findUnique({ where: { id: offlineId } })) ||
    (await prisma.session.findFirst({ where: { shop } }));

  if (!sess) return null;

  // 3) Backfill Shop row using session access token
  const created = await prisma.shop.upsert({
    where: { shop },
    update: {
      accessToken: sess.accessToken ?? null,
      installed: true,
      uninstalledAt: null,
      updatedAt: new Date(),
    },
    create: {
      shop,
      accessToken: sess.accessToken ?? null,
      installed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return created;
}
