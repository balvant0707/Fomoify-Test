// app/db.server.js
import { PrismaClient } from "@prisma/client";

const DEFAULT_CONNECTION_LIMIT = "1";
const DEFAULT_POOL_TIMEOUT = "5";

function buildPrismaOptions() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl || !rawUrl.startsWith("mysql://")) {
    return {};
  }

  try {
    const tunedUrl = new URL(rawUrl);

    // Always enforce limits — URL-embedded values are overridden by env vars
    // so a misconfigured DATABASE_URL can't silently raise the connection count.
    tunedUrl.searchParams.set(
      "connection_limit",
      process.env.PRISMA_CONNECTION_LIMIT || DEFAULT_CONNECTION_LIMIT
    );
    tunedUrl.searchParams.set(
      "pool_timeout",
      process.env.PRISMA_POOL_TIMEOUT || DEFAULT_POOL_TIMEOUT
    );

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

if (!globalForPrisma.prisma && globalForPrisma.__prisma) {
  globalForPrisma.prisma = globalForPrisma.__prisma;
}

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient(buildPrismaOptions());
}

globalForPrisma.__prisma = globalForPrisma.prisma;

const prisma = globalForPrisma.prisma;
let _connectPromise = null;
let _connected = false;

// Matches both error types Prisma emits for a disconnected engine.
// PrismaClientUnknownRequestError is the common form; PrismaClientKnownRequestError
// with code GenericFailure + same message is emitted by the session-storage adapter.
export function isPrismaEngineDisconnectedError(error) {
  const name = error?.name || error?.constructor?.name || "";
  const message = `${error?.message || ""} ${error?.cause?.message || ""}`.toLowerCase();
  return (
    (name === "PrismaClientUnknownRequestError" ||
      name === "PrismaClientKnownRequestError") &&
    message.includes("engine is not yet connected")
  );
}

// In serverless environments each Lambda instance holds its own connection.
// Disconnecting when the event loop drains releases the MySQL connection before
// the container is frozen, preventing max_user_connections exhaustion on the
// next burst of concurrent invocations.
let _disconnectTimer = null;
export function scheduleDisconnect(delayMs = 2000) {
  if (_disconnectTimer) clearTimeout(_disconnectTimer);
  _disconnectTimer = setTimeout(() => {
    _disconnectTimer = null;
    _connected = false;
    _connectPromise = null;
    prisma.$disconnect().catch(() => {});
  }, delayMs);
}

// Call before any query in serverless loaders to ensure the engine is ready.
// Uses _connected flag as a fast path so repeated calls within a request are free.
export async function ensureConnected() {
  if (_connected) return;
  if (!_connectPromise) {
    _connectPromise = prisma
      .$connect()
      .then(() => {
        _connected = true;
      })
      .finally(() => {
        _connectPromise = null;
      });
  }
  await _connectPromise;
}

async function resetPrismaEngine() {
  _connectPromise = null;
  _connected = false;
  await prisma.$disconnect().catch(() => {});
}

export async function withPrismaConnectionRetry(operation) {
  await ensureConnected();
  try {
    return await operation();
  } catch (error) {
    if (!isPrismaEngineDisconnectedError(error)) throw error;
    await resetPrismaEngine();
    await ensureConnected();
    return operation();
  }
}

// Eagerly start the engine so the first Lambda query doesn't race on connect.
ensureConnected().catch(() => {});

export { prisma };        // named export
export default prisma;    // optional default
