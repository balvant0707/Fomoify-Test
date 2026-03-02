// app/db.server.js
import { PrismaClient } from "@prisma/client";

const DEFAULT_CONNECTION_LIMIT = "1";
const DEFAULT_POOL_TIMEOUT = "20";

function buildPrismaOptions() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl || !rawUrl.startsWith("mysql://")) {
    return {};
  }

  try {
    const tunedUrl = new URL(rawUrl);

    if (!tunedUrl.searchParams.has("connection_limit")) {
      tunedUrl.searchParams.set(
        "connection_limit",
        process.env.PRISMA_CONNECTION_LIMIT || DEFAULT_CONNECTION_LIMIT
      );
    }

    if (!tunedUrl.searchParams.has("pool_timeout")) {
      tunedUrl.searchParams.set(
        "pool_timeout",
        process.env.PRISMA_POOL_TIMEOUT || DEFAULT_POOL_TIMEOUT
      );
    }

    return {
      datasources: {
        db: { url: tunedUrl.toString() },
      },
    };
  } catch (error) {
    console.warn("[Prisma] Failed to parse DATABASE_URL for pool tuning:", error);
    return {};
  }
}

const globalForPrisma = globalThis;

if (!globalForPrisma.__prisma) {
  globalForPrisma.__prisma = new PrismaClient(buildPrismaOptions());
}

const prisma = globalForPrisma.__prisma;

export { prisma };        // named export
export default prisma;    // optional default
