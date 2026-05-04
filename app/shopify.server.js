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

const sessionConnectionRetries = toPositiveInt(
  process.env.SHOPIFY_SESSION_CONNECTION_RETRIES,
  1
);
const sessionConnectionRetryIntervalMs = toPositiveInt(
  process.env.SHOPIFY_SESSION_CONNECTION_RETRY_INTERVAL_MS,
  1000
);

// Always ensure the session table exists before creating PrismaSessionStorage.
// The storage constructor starts a background readiness timer that throws an
// unhandled rejection if the table is missing, so we must create the table first.
const createPrismaSessionStorage = async (prismaClient) => {
  await ensurePrismaSessionTable(prismaClient);
  return new PrismaSessionStorage(prismaClient, {
    connectionRetries: sessionConnectionRetries,
    connectionRetryIntervalMs: sessionConnectionRetryIntervalMs,
  });
};

function createSessionStorage(prismaClient) {
  let storagePromise;

  const getStorage = async () => {
    if (!storagePromise) {
      storagePromise = createPrismaSessionStorage(prismaClient).catch((error) => {
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
  apiVersion: ApiVersion.January26,
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
    afterAuth: async ({ session }) => {
      // 1) Persist basic shop row immediately
      await upsertInstalledShop({
        shop: session.shop,
        accessToken: session.accessToken ?? null,
      });

      // 2) Fetch store details from Shopify and persist owner data
      try {
        const gqlResp = await fetch(
          `https://${session.shop}/admin/api/2025-01/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": session.accessToken,
            },
            body: JSON.stringify({
              query: `{
                shop {
                  name
                  email
                  contactEmail
                  myshopifyDomain
                  currencyCode
                  plan { displayName }
                  primaryDomain { host }
                  billingAddress { country city phone }
                }
              }`,
            }),
          }
        );
        const js = await gqlResp.json();
        if (js.errors) {
          console.error("[FOMO][afterAuth] GraphQL errors:", JSON.stringify(js.errors));
        }
        const sd = js?.data?.shop || {};
        if (sd.name) {
          await upsertInstalledShop({
            shop: session.shop,
            accessToken: session.accessToken ?? null,
            ownerData: {
              ownerName: sd.contactEmail || null,
              email: sd.email || null,
              contactEmail: sd.contactEmail || null,
              name: sd.name || null,
              country: sd.billingAddress?.country || null,
              city: sd.billingAddress?.city || null,
              currency: sd.currencyCode || null,
              phone: sd.billingAddress?.phone || null,
              primaryDomain: sd.primaryDomain?.host || null,
              plan: sd.plan?.displayName || null,
            },
          });
          console.log("[FOMO][afterAuth] shop data saved for", session.shop, sd.name);
        } else {
          console.warn("[FOMO][afterAuth] no shop data returned for", session.shop, JSON.stringify(js));
        }
      } catch (e) {
        console.error("[FOMO][afterAuth] failed to fetch shop info:", e);
      }

      // 3) Register webhooks
      const reg = await shopify.registerWebhooks({ session });
      console.log("registerWebhooks:", JSON.stringify(reg, null, 2));
    },
  },
});

export default shopify;

// named exports used by routes
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const apiVersion = ApiVersion.January26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export { sessionStorage };
