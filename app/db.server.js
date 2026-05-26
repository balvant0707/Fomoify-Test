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

const globalForPrisma = global;

if (!globalForPrisma.__prismaRaw) {
  globalForPrisma.__prismaRaw =
    globalForPrisma.__prismaRaw ||
    globalForPrisma.__prismaClient ||
    (globalForPrisma.prisma?.$connect ? globalForPrisma.prisma : null) ||
    new PrismaClient(buildPrismaOptions());
}

const rawPrisma = globalForPrisma.__prismaRaw;
let _connectPromise = null;
let _connected = false;
let _disconnectTimer = null;
let _activeOperations = 0;

function cancelScheduledDisconnect() {
  if (!_disconnectTimer) return;
  clearTimeout(_disconnectTimer);
  _disconnectTimer = null;
}

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

const configuredIdleDisconnectMs = Number(process.env.PRISMA_IDLE_DISCONNECT_MS);
const DEFAULT_IDLE_DISCONNECT_MS =
  Number.isFinite(configuredIdleDisconnectMs) && configuredIdleDisconnectMs > 0
    ? configuredIdleDisconnectMs
    : 15000;

// In serverless environments each Lambda instance holds its own connection.
// Disconnect only after a quiet period. Pending timers are cancelled by new
// Prisma work, and active queries prevent the timer from tearing down an engine
// while another request is using it.
export function scheduleDisconnect(delayMs = DEFAULT_IDLE_DISCONNECT_MS) {
  const requestedDelay = Number(delayMs);
  const normalizedDelay = Math.max(
    1000,
    Number.isFinite(requestedDelay) && requestedDelay > 0
      ? requestedDelay
      : DEFAULT_IDLE_DISCONNECT_MS
  );
  if (_disconnectTimer) clearTimeout(_disconnectTimer);
  _disconnectTimer = setTimeout(() => {
    _disconnectTimer = null;
    if (_activeOperations > 0) {
      scheduleDisconnect(normalizedDelay);
      return;
    }
    _connected = false;
    _connectPromise = null;
    rawPrisma.$disconnect().catch(() => {});
  }, normalizedDelay);
}

// Call before any query in serverless loaders to ensure the engine is ready.
// Uses _connected flag as a fast path so repeated calls within a request are free.
export async function ensureConnected() {
  cancelScheduledDisconnect();
  if (_connected) return;
  if (!_connectPromise) {
    _connectPromise = rawPrisma
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
  cancelScheduledDisconnect();
  _connectPromise = null;
  _connected = false;
  await rawPrisma.$disconnect().catch(() => {});
}

export async function withPrismaConnectionRetry(operation) {
  cancelScheduledDisconnect();
  _activeOperations += 1;
  try {
    await ensureConnected();
    try {
      return await operation();
    } catch (error) {
      if (!isPrismaEngineDisconnectedError(error)) throw error;
      await resetPrismaEngine();
      await ensureConnected();
      return operation();
    }
  } finally {
    _activeOperations = Math.max(0, _activeOperations - 1);
  }
}

function createPrismaClientWithRetry(client) {
  if (typeof client.$extends !== "function") return client;

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          return withPrismaConnectionRetry(() => query(args));
        },
      },
    },
  });
}

if (!globalForPrisma.__prismaWithRetry) {
  globalForPrisma.__prismaWithRetry = createPrismaClientWithRetry(rawPrisma);
}

globalForPrisma.__prismaClient = rawPrisma;
globalForPrisma.__prisma = globalForPrisma.__prismaWithRetry;
globalForPrisma.prisma = globalForPrisma.__prismaWithRetry;

const prisma = globalForPrisma.__prismaWithRetry;

// Eagerly start the engine so the first Lambda query doesn't race on connect.
ensureConnected().catch(() => {});

export { prisma };        // named export
export default prisma;    // optional default
