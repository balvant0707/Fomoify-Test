import prisma from "../db.server";

const DEFAULT_WRITE_WINDOW_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 5000;

const WRITE_WINDOW_MS = Math.max(
  1000,
  Number(process.env.EMBED_PING_WRITE_WINDOW_MS || DEFAULT_WRITE_WINDOW_MS)
);

const globalForEmbedPing = global;
if (!globalForEmbedPing.__fomoEmbedPingWriteCache) {
  globalForEmbedPing.__fomoEmbedPingWriteCache = new Map();
}
const writeCache = globalForEmbedPing.__fomoEmbedPingWriteCache;

const getEmbedPingModel = () => prisma.embedPing || prisma.embedping || null;

const isConnectionLimitError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("max_user_connections") ||
    message.includes("too many database connections")
  );
};

const pruneCache = (nowMs) => {
  if (writeCache.size <= MAX_CACHE_ENTRIES) return;
  const staleMs = WRITE_WINDOW_MS * 2;
  for (const [shop, ts] of writeCache.entries()) {
    if (nowMs - Number(ts || 0) > staleMs) {
      writeCache.delete(shop);
    }
    if (writeCache.size <= MAX_CACHE_ENTRIES) break;
  }
};

export async function touchEmbedPing(shopDomain) {
  const shop = String(shopDomain || "").trim().toLowerCase();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (!shop) {
    return { ok: false, error: "Missing or invalid shop domain" };
  }

  const model = getEmbedPingModel();
  if (!model?.upsert) {
    return {
      ok: false,
      error: "EmbedPing model is not available in Prisma client",
    };
  }

  const lastWriteMs = Number(writeCache.get(shop) || 0);
  if (lastWriteMs > 0 && nowMs - lastWriteMs < WRITE_WINDOW_MS) {
    return {
      ok: true,
      shop,
      lastPingAt: new Date(lastWriteMs).toISOString(),
      skipped: true,
      persisted: false,
    };
  }

  try {
    await model.upsert({
      where: { shop },
      create: { shop, lastPingAt: new Date(nowMs) },
      update: { lastPingAt: new Date(nowMs) },
    });

    writeCache.set(shop, nowMs);
    pruneCache(nowMs);

    return {
      ok: true,
      shop,
      lastPingAt: nowIso,
      skipped: false,
      persisted: true,
    };
  } catch (error) {
    if (isConnectionLimitError(error)) {
      writeCache.set(shop, nowMs);
      pruneCache(nowMs);
      console.warn("[embed-status] connection limit reached, using in-memory ping:", {
        shop,
        windowMs: WRITE_WINDOW_MS,
      });
      return {
        ok: true,
        shop,
        lastPingAt: nowIso,
        skipped: true,
        persisted: false,
      };
    }
    throw error;
  }
}
