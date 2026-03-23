// app/routes/app.jsx
import { Outlet, useLoaderData, useRouteError, useLocation } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import LcpObserver from "../components/LcpObserver";
import { upsertInstalledShop } from "../utils/upsertShop.server";
import prisma from "../db.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

const norm = (s) => String(s || "").trim().toLowerCase();

const toShopSlug = (value) => {
  const raw = norm(value).replace(/^https?:\/\//, "");
  if (!raw) return "";

  const storeMatch = raw.match(/\/store\/([a-z0-9-]+)/);
  if (storeMatch?.[1]) return storeMatch[1];

  const domainMatch = raw.match(/^([a-z0-9-]+)\.myshopify\.com\b/);
  if (domainMatch?.[1]) return domainMatch[1];

  const pathOnly = raw.split(/[?#]/)[0];
  const parts = pathOnly.split("/").filter(Boolean).filter((part) => part !== "store");
  return parts[0] || "";
};

const toShopDomain = (value) => {
  const slug = toShopSlug(value);
  return slug ? `${slug}.myshopify.com` : "";
};

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  const shop = norm(session?.shop);
  try {
    if (shop) {
      await upsertInstalledShop({
        shop,
        accessToken: session.accessToken ?? null,
      });

      // Fetch owner data only if not yet populated in DB
      const shopRow = await prisma.shop.findUnique({ where: { shop }, select: { name: true } });
      if (!shopRow?.name) try {
        const resp = await admin.graphql(
          `#graphql
          query ShopOwnerInfo {
            shop {
              name email contactEmail myshopifyDomain shopOwnerName currencyCode
              plan { displayName }
              primaryDomain { host }
              billingAddress { country city phone }
            }
          }`
        );
        const js = await resp.json();
        const sd = js?.data?.shop || {};
        if (sd.name) {
          await upsertInstalledShop({
            shop,
            accessToken: session.accessToken ?? null,
            ownerData: {
              ownerName: sd.shopOwnerName || null,
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
        }
      } catch (e) {
        console.error("[FOMO][app.jsx] failed to fetch shop owner data:", e);
      }
    }
  } catch (e) {
    console.error("Prisma upsert(shop) failed:", e);
  }

  const apiKey =
    process.env.SHOPIFY_API_KEY ||
    process.env.SHOPIFY_APP_BRIDGE_APP_ID ||
    "";

  if (!apiKey) {
    return new Response(
      "Missing SHOPIFY_API_KEY or SHOPIFY_APP_BRIDGE_APP_ID in environment. Set one to your app's Client ID.",
      { status: 500 }
    );
  }

  const slug =
    toShopSlug(shop) ||
    norm(shop)
      .replace(".myshopify.com", "")
      .split("/")
      .filter(Boolean)
      .filter((part) => part !== "store")[0] ||
    "";
  const shopDomain = toShopDomain(shop);

  return { apiKey, slug, shopDomain };
};

export default function App() {
  const { apiKey } = useLoaderData();
  const location = useLocation();
  const search = location.search || "";
  const appUrl = (path) => `${path}${search}`;

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <a href={appUrl("/app")} rel="home">Home</a>
        <a href={appUrl("/app/notification")}>Notification</a>
        <a href={appUrl("/app/analytics")}>Analytics</a>
        <a href={appUrl("/app/integrations")}>Integrations</a>
      </NavMenu>
      <LcpObserver />
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() { return boundary.error(useRouteError()); }
export const headers = (h) => boundary.headers(h);
export const shouldRevalidate = () => true;
