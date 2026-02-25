// app/routes/app.jsx
import { Outlet, useLoaderData, useRouteError, useLocation } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { Banner, Button } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import LcpObserver from "../components/LcpObserver";
import { upsertInstalledShop } from "../utils/upsertShop.server";
import { APP_EMBED_HANDLE } from "../utils/themeEmbed.shared";
import { getEmbedPingStatus } from "../utils/embedPingStatus.server";

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

const toThemeEditorThemeId = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "current";
  const idMatch = raw.match(/\d+/);
  return idMatch ? idMatch[0] : "current";
};

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request); // redirects to /auth if needed
  const { getAppEmbedContext } = await import("../utils/themeEmbed.server");

  // Soft-guard: prisma failures should not 500 the whole app frame
  const shop = norm(session?.shop);
  try {
    if (shop) {
      await upsertInstalledShop({
        shop,
        accessToken: session.accessToken ?? null,
      });
    }
  } catch (e) {
    // log and continue (don’t block UI)
    console.error("Prisma upsert(shop) failed:", e);
  }

  const apiKey =
    process.env.SHOPIFY_API_KEY ||
    process.env.SHOPIFY_APP_BRIDGE_APP_ID ||
    "";

  if (!apiKey) {
    // Make the error obvious but not a 500 blank page
    return new Response(
      "Missing SHOPIFY_API_KEY or SHOPIFY_APP_BRIDGE_APP_ID in environment. Set one to your app's Client ID.",
      { status: 500 }
    );
  }

  const extId = process.env.SHOPIFY_THEME_EXTENSION_ID || "";
  const embedContext = shop
    ? await getAppEmbedContext({
        admin,
        shop,
        apiKey,
        extId,
        embedHandle: APP_EMBED_HANDLE,
      })
    : {
        themeId: null,
        appEmbedEnabled: false,
        appEmbedFound: false,
        appEmbedChecked: false,
      };
  const slug =
    toShopSlug(shop) ||
    norm(shop)
      .replace(".myshopify.com", "")
      .split("/")
      .filter(Boolean)
      .filter((part) => part !== "store")[0] ||
    "";
  const shopDomain = toShopDomain(shop);
  const embedPingStatus = await getEmbedPingStatus(shop);

  return {
    apiKey,
    slug,
    shopDomain,
    embedPingStatus,
    themeId: embedContext.themeId,
    appEmbedEnabled: embedContext.appEmbedEnabled,
    appEmbedFound: embedContext.appEmbedFound,
    appEmbedChecked: embedContext.appEmbedChecked,
  };
};

export default function App() {
  const {
    apiKey,
    slug,
    shopDomain,
    themeId,
    appEmbedEnabled,
    appEmbedFound,
    appEmbedChecked,
    embedPingStatus,
  } = useLoaderData();
  const location = useLocation();
  const search = location.search || "";
  const appUrl = (path) => `${path}${search}`;
  const hasThemeEmbedCheck = appEmbedChecked === true;
  const hasThemeEmbedSignal = hasThemeEmbedCheck && appEmbedFound === true;
  const hasFreshPingSignal =
    embedPingStatus?.isFresh === true || embedPingStatus?.isOn === true;
  const isEmbedActive = hasThemeEmbedSignal
    ? Boolean(appEmbedEnabled)
    : hasFreshPingSignal;
  const shouldShowEmbedWarning = hasThemeEmbedSignal && !isEmbedActive;
  const embedWarningTitle = "App embed is disabled";
  const embedWarningText =
    'Fomoify App Embed is currently disabled. To enable popups and social proof on your storefront, go to Theme Customize -> App embeds and turn ON "Fomoify - Core Embed".';
  const openThemeEmbedActivation = () => {
    const embedId = `${apiKey}/${APP_EMBED_HANDLE}`;
    const safeThemeId = toThemeEditorThemeId(themeId);
    const params = new URLSearchParams({ context: "apps" });
    params.set("activateAppId", embedId);
    const editorBase = shopDomain
      ? `https://${shopDomain}/admin`
      : `https://admin.shopify.com/store/${slug}`;
    const url = `${editorBase}/themes/${safeThemeId}/editor?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <a href={appUrl("/app")} rel="home">Home</a>
        <a href={appUrl("/app/notification")}>Notification</a>
        <a href={appUrl("/app/analytics")}>Analytics</a>
        <a href={appUrl("/app/integrations")}>Integrations</a>
        {/* <a href={appUrl("/app/documents")}>Documents</a>
        <a href={appUrl("/app/help")}>Help</a> */}
      </NavMenu>
      <LcpObserver />
      {shouldShowEmbedWarning && (
        <div style={{ padding: "12px 16px 0" }}>
          <Banner status="warning" title={embedWarningTitle}>
            <p>{embedWarningText}</p>
            <div style={{ marginTop: 10 }}>
              {/* <Button primary onClick={openThemeEmbedActivation}>
                Turn on app embed
              </Button> */}
            </div>
          </Banner>
        </div>
      )}
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() { return boundary.error(useRouteError()); }
export const headers = (h) => boundary.headers(h);
export const shouldRevalidate = () => true;
