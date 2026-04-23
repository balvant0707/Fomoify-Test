import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { touchEmbedPing } from "../utils/embedPingWrite.server";
import { normalizeShopDomain } from "../utils/shopDomain.server";

const getShopFromProxyContext = (appProxyContext: any) => {
  if (!appProxyContext || typeof appProxyContext !== "object") return "";
  const sessionShop =
    "session" in appProxyContext ? appProxyContext.session?.shop : "";
  const directShop = "shop" in appProxyContext ? appProxyContext.shop : "";
  return normalizeShopDomain(sessionShop || directShop);
};

const getShopFromRequest = (request: Request) => {
  const url = new URL(request.url);
  const headerShop = normalizeShopDomain(
    request.headers.get("x-shopify-shop-domain")
  );
  const queryShop = url.searchParams
    .getAll("shop")
    .map((value) => normalizeShopDomain(value))
    .find(Boolean);
  return normalizeShopDomain(headerShop || queryShop || "");
};

async function upsertEmbedPing(request: Request) {
  try {
    let appProxyContext: any = null;
    try {
      appProxyContext = await authenticate.public.appProxy(request);
    } catch (authError) {
      console.warn("[embed-status] app proxy auth fallback:", authError);
    }
    const shop =
      getShopFromProxyContext(appProxyContext) || getShopFromRequest(request);

    if (!shop) {
      return json(
        { ok: false, error: "Missing or invalid shop domain" },
        { status: 400 }
      );
    }

    const result = await touchEmbedPing(shop);
    if (!result.ok) {
      return json({ ok: false, error: result.error || "Embed status update failed" }, { status: 500 });
    }

    return json(
      {
        ...result,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[embed-status] proxy upsert failed:", error);
    return json({ ok: false, error: "Embed status update failed" }, { status: 500 });
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) =>
  upsertEmbedPing(request);

export const action = async ({ request }: ActionFunctionArgs) =>
  upsertEmbedPing(request);
