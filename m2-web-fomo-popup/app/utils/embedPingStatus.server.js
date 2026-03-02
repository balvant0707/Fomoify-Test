import prisma from "../db.server";

const EMBED_ON_WINDOW_MS = 10 * 60 * 1000;

const embedPingModel = () => prisma.embedPing || prisma.embedping || null;

export async function getEmbedPingStatus(shopDomain) {
  const now = new Date();
  const shop = String(shopDomain || "").trim().toLowerCase();

  const fallback = {
    isOn: false,
    isFresh: false,
    lastPingAt: null,
    checkedAt: now.toISOString(),
  };

  if (!shop) return fallback;

  const model = embedPingModel();
  if (!model?.findUnique) return fallback;

  try {
    const row = await model.findUnique({
      where: { shop },
      select: { lastPingAt: true },
    });
    const lastPingAt = row?.lastPingAt ? new Date(row.lastPingAt) : null;
    const lastPingAgeMs = lastPingAt
      ? Math.max(0, now.getTime() - lastPingAt.getTime())
      : null;
    const isFresh =
      Number.isFinite(lastPingAgeMs) && lastPingAgeMs <= EMBED_ON_WINDOW_MS;

    return {
      isOn: Boolean(isFresh),
      isFresh: Boolean(isFresh),
      lastPingAt: lastPingAt ? lastPingAt.toISOString() : null,
      lastPingAgeMs,
      checkedAt: now.toISOString(),
    };
  } catch (error) {
    console.error("[embed-ping] status lookup failed:", error);
    return fallback;
  }
}
