// app/shopify.server.js
import "@shopify/shopify-app-remix/server/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  DeliveryMethod,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { upsertInstalledShop } from "./utils/upsertShop.server";
import { ensurePrismaSessionTable } from "./utils/ensureSessionTable.server";

const toPositiveInt = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
};

const shouldAutoPrepareSessionTable =
  process.env.PRISMA_AUTO_PREPARE_SESSION_TABLE === "1" ||
  process.env.NODE_ENV !== "production";
const sessionConnectionRetries = toPositiveInt(
  process.env.SHOPIFY_SESSION_CONNECTION_RETRIES,
  1
);
const sessionConnectionRetryIntervalMs = toPositiveInt(
  process.env.SHOPIFY_SESSION_CONNECTION_RETRY_INTERVAL_MS,
  1000
);

function createSessionStorage(prismaClient) {
  let storagePromise;

  const getStorage = async () => {
    if (!storagePromise) {
      storagePromise = (async () => {
        if (shouldAutoPrepareSessionTable) {
          await ensurePrismaSessionTable(prismaClient);
        }
        return new PrismaSessionStorage(prismaClient, {
          connectionRetries: sessionConnectionRetries,
          connectionRetryIntervalMs: sessionConnectionRetryIntervalMs,
        });
      })().catch((error) => {
        // Allow retries after transient failures (for example, temporary DB saturation).
        storagePromise = undefined;
        throw error;
      });
    }
    return storagePromise;
  };

  return {
    async storeSession(session) {
      const storage = await getStorage();
      return storage.storeSession(session);
    },
    async loadSession(id) {
      const storage = await getStorage();
      return storage.loadSession(id);
    },
    async deleteSession(id) {
      const storage = await getStorage();
      return storage.deleteSession(id);
    },
    async deleteSessions(ids) {
      const storage = await getStorage();
      return storage.deleteSessions(ids);
    },
    async findSessionsByShop(shop) {
      const storage = await getStorage();
      return storage.findSessionsByShop(shop);
    },
    async isReady() {
      try {
        const storage = await getStorage();
        return storage.isReady();
      } catch {
        return false;
      }
    },
  };
}

const sessionStorage = createSessionStorage(prisma);

export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: (process.env.SCOPES || "").split(",").filter(Boolean),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  distribution: AppDistribution.AppStore,
  sessionStorage,
  future: { unstable_newEmbeddedAuthStrategy: true, removeRest: true },

  // Register topics (handlers are in /webhooks routes via authenticate.webhook)
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    // ✅ GDPR (required for App Store)
    CUSTOMERS_DATA_REQUEST: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    CUSTOMERS_REDACT: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    SHOP_REDACT: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    // (optional but useful) if app scopes change
    APP_SCOPES_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
  },

  hooks: {
    // OAuth complete → save token, mark installed, and (re)register webhooks
    afterAuth: async ({ session }) => {
      await upsertInstalledShop({
        shop: session.shop,
        accessToken: session.accessToken ?? null,
      });

      const reg = await shopify.registerWebhooks({ session });
      console.log("🔔 registerWebhooks:", JSON.stringify(reg, null, 2));
    },
  },
});

export default shopify;

// named exports used by routes
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export { sessionStorage };
