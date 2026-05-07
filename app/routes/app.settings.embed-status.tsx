import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import {
  Action as RedirectAction,
  create as createRedirect,
} from "@shopify/app-bridge/actions/Navigation/Redirect";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Page,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  getStoreHandleFromShopDomain,
  normalizeShopDomain,
} from "../utils/shopDomain.server";
import { APP_EMBED_HANDLE } from "../utils/themeEmbed.shared";

const DISABLED_MESSAGE =
  "Fomoify App Embed is currently disabled. To enable popups and social proof on your storefront, go to Theme Customize \u2192 App embeds and turn ON \u201cFomoify - Core Embed\u201d.";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = normalizeShopDomain(session?.shop);
  if (!shop) throw new Response("Unauthorized", { status: 401 });

  const { getAppEmbedContext } = await import("../utils/themeEmbed.server");
  const apiKey =
    process.env.SHOPIFY_API_KEY ||
    process.env.SHOPIFY_APP_BRIDGE_APP_ID ||
    "";
  const extId = process.env.SHOPIFY_THEME_EXTENSION_ID || "";
  const embedContext = await getAppEmbedContext({
    admin,
    shop,
    apiKey,
    extId,
  });

  const storeHandle = getStoreHandleFromShopDomain(shop);
  const hasThemeEmbedCheck = Boolean(embedContext.appEmbedChecked);
  const hasThemeEmbedSignal =
    hasThemeEmbedCheck &&
    Boolean(embedContext.appEmbedFound);
  const isEmbedOn =
    hasThemeEmbedSignal && Boolean(embedContext.appEmbedEnabled);

  return json({
    shop,
    storeHandle,
    apiKey,
    extId,
    isEmbedOn,
    hasThemeEmbedCheck,
    hasThemeEmbedSignal,
    appEmbedChecked: Boolean(embedContext.appEmbedChecked),
    appEmbedFound: Boolean(embedContext.appEmbedFound),
  });
};

export default function AppEmbedStatusSettingsPage() {
  const { storeHandle, apiKey, isEmbedOn } =
    useLoaderData<typeof loader>();
  const app = useAppBridge();
  const revalidator = useRevalidator();
  const isRefreshing = revalidator.state !== "idle";

  const openAppEmbeds = () => {
    const params = new URLSearchParams({ context: "apps" });
    if (apiKey) {
      const embedId = `${apiKey}/${APP_EMBED_HANDLE}`;
      params.set("template", "index");
      params.set("activateAppId", embedId);
    }
    const url = `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?${params.toString()}`;
    const redirect = createRedirect(app as any);
    redirect.dispatch(RedirectAction.REMOTE, { url, newContext: true });
  };

  return (
    <Page title="Embed Settings">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                App embed status
              </Text>
              <Badge
                tone={isEmbedOn ? "success" : "critical"}
              >
                {`App embed: ${isEmbedOn ? "On" : "Off"}`}
              </Badge>
            </InlineStack>
            {!isEmbedOn && (
              <Text as="p" tone="subdued">
                Theme customization does not show Fomoify - Core Embed as
                enabled on the active theme.
              </Text>
            )}

            {!isEmbedOn && (
              <Banner tone="warning">
                <p>{DISABLED_MESSAGE}</p>
              </Banner>
            )}

            <InlineStack gap="300" align="start">
              <Button variant="primary" onClick={openAppEmbeds}>
                Open App Embeds
              </Button>
              <Button
                variant="secondary"
                loading={isRefreshing}
                onClick={() => revalidator.revalidate()}
              >
                Refresh Status
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
