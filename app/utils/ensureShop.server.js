// app/utils/ensureShop.server.js
import prisma from "../db.server.js";

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();

/**
 * Ensure Shop row exists.
 * If missing, try to backfill from session table (offline_<shop> or any row for that shop).
 * Returns the Shop row (existing/created) or null.
 */
export async function ensureShopRow(rawShop) {
  const shop = norm(rawShop);
  if (!shop) return null;

  // 1) Already exists and is properly installed — fast path.
  const existing = await prisma.shop.findUnique({ where: { shop } });
  if (existing?.installed && existing?.accessToken) {
    if (existing.status === "installed" && !existing.uninstalledAt) return existing;

    return prisma.shop.update({
      where: { shop },
      data: {
        status: "installed",
        uninstalledAt: null,
      },
    });
  }

  // 2) Try to read offline session first, else any session for that shop.
  // This also heals a shop row that has installed:false (e.g. after a failed
  // re-install or a uninstall/reinstall race where the webhook fired late).
  const offlineId = `offline_${shop}`;
  let sess =
    (await prisma.session.findUnique({ where: { id: offlineId } })) ||
    (await prisma.session.findFirst({ where: { shop } }));

  // No session — return whatever we have (may be null or an uninstalled row).
  if (!sess?.accessToken) return existing || null;

  // 3) Backfill Shop row using session access token
  const created = await prisma.shop.upsert({
    where: { shop },
    update: {
      accessToken: sess.accessToken ?? null,
      installed: true,
      status: "installed",
      uninstalledAt: null,
      updatedAt: new Date(),
    },
    create: {
      shop,
      accessToken: sess.accessToken ?? null,
      installed: true,
      status: "installed",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return created;
}
