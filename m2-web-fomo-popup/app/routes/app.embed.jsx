import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Redirect } from "@shopify/app-bridge/actions";
import { Page, Card, BlockStack, InlineStack, Button, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getStoreHandleFromShopDomain } from "../utils/storeHandle.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = String(session?.shop || "").trim().toLowerCase();
  if (!shop) throw new Response("Unauthorized", { status: 401 });

  const storeHandle = getStoreHandleFromShopDomain(shop);
  if (!storeHandle) {
    throw new Response("Invalid shop domain", { status: 400 });
  }

  return json({ storeHandle, shop });
};

export default function AppEmbedRoute() {
  const { storeHandle, shop } = useLoaderData();
  const app = useAppBridge();

  const openThemeEditorEmbeds = () => {
    const url = `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?context=apps`;
    const redirect = Redirect.create(app);
    redirect.dispatch(Redirect.Action.REMOTE, url, { newContext: true });
  };

  return (
    <Page title="App Embed Controls">
      <Card>
        <BlockStack gap="300">
          <Text as="p">
            Shop: <b>{shop}</b>
          </Text>
          <Text as="p">
            Store handle: <b>{storeHandle}</b>
          </Text>
          <InlineStack gap="300" align="start">
            <Button primary onClick={openThemeEditorEmbeds}>
              Enable App Embed
            </Button>
            <Button variant="secondary" onClick={openThemeEditorEmbeds}>
              Disable App Embed
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </Page>
  );
}
