import { defer } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { getOrSetCache } from "../utils/serverCache.server";

const THEME_EXTENSION_ID = process.env.SHOPIFY_THEME_EXTENSION_ID || "";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session?.shop || "";
  const slug = shop.replace(".myshopify.com", "");

  const themeIdPromise = (async () => {
    try {
      const cacheKey = `themes:main:${shop}`;
      const cached = await getOrSetCache(cacheKey, 60000, async () => {
        const resp = await admin.rest.resources.Theme.all({
          session: admin.session,
          fields: "id,role",
        });
        const themes = resp?.data || [];
        const live = themes.find((t) => t.role === "main");
        return live?.id ?? null;
      });
      return cached ?? null;
    } catch (e) {
      console.error("Theme list failed:", e);
      return null;
    }
  })();

  const apiKey =
    process.env.SHOPIFY_API_KEY ||
    process.env.SHOPIFY_APP_BRIDGE_APP_ID ||
    "";

  return defer({ slug, themeId: themeIdPromise, apiKey, extId: THEME_EXTENSION_ID });
};

export default function AppIndex() {
  const { slug, themeId } = useLoaderData();
  const [resolvedThemeId, setResolvedThemeId] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.resolve(themeId).then((id) => {
      if (active) setResolvedThemeId(id ?? null);
    });
    return () => {
      active = false;
    };
  }, [themeId]);

  const openFallback = (id) => {
    const url = `https://admin.shopify.com/store/${slug}/themes/${id ?? "current"}/editor?context=apps`;
    window.open(url, "_blank");
  };

  /* ——— preview styles ——— */
  const previewOuter = { width: "100%", minWidth: 560, maxWidth: 980, margin: "0 auto" };
  const wrap = {
    padding: 16,
    borderRadius: 12,
    background:
      "linear-gradient(135deg, rgb(33,150,243) 0%, rgb(233,30,99) 50%, rgb(255,87,34) 100%)",
  };
  const row = { display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "space-between" };
  const popupBase = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 40px 12px 12px",
    minWidth: 260,
    borderRadius: 16,
    boxShadow: "0 8px 24px rgba(0,0,0,.25)",
    flex: "1 1 0",
  };
  
  const close = { position: "absolute", right: 12, top: 8, fontWeight: 700, fontSize: 16, opacity: 0.9 };
  const iconCircle = { width: 48, height: 48, borderRadius: "50%", display: "grid", placeItems: "center", flex: "0 0 48px" };
  const title = { fontWeight: 700, lineHeight: 1.2, marginBottom: 2 };
  const line = { margin: 0, lineHeight: 1.35, fontSize: 13.5 };
  const small = { opacity: 0.8, marginTop: 4, fontSize: 12.5 };

  const footer = {
    marginTop: 10,
    background: "#0b0b0b",
    color: "#fff",
    borderRadius: 12,
    padding: "10px 14px",
    textAlign: "center",
    fontSize: 13.5,
    fontWeight: 600,
    letterSpacing: 0.2,
  };

  // SEO section styles
  const seoBox = {
    width: "100%",
    minWidth: 560,
    maxWidth: 980,
    margin: "14px auto 0",
    background: "#ffffff",
    border: "1px solid #ececec",
    borderRadius: 12,
    padding: "16px 18px",
  };
  const seoH3 = { fontSize: 18, fontWeight: 700, margin: "0 0 8px" };
  const seoP = { margin: "0 0 10px", color: "#202223" };
  const seoUl = { margin: "0 0 0 16px", padding: 0, lineHeight: 1.5 };

  return (
    <Page title="Fomoify Sales Popup & Proof">
      <TitleBar title="Fomoify Sales Popup & Proof" />
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <Text as="p">
              Open Theme Customize → <b>App embeds</b> with this app selected.
            </Text>
            <InlineStack gap="300" align="start">
              <Button variant="secondary" onClick={() => openFallback(resolvedThemeId)}>
                Open in new tab (fallback)
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingLg">Preview – Popup Content</Text>

              {/* 50% width centered preview */}
              <div style={previewOuter} aria-label="Preview area for Fomoify popups">
                <div style={wrap}>
                  <div style={row}>
                    {/* Flash sale */}
                    <div style={{ ...popupBase, color: "#fff", background: "#0e0e0e" }} aria-label="Flash sale popup">
                      <div style={{ ...iconCircle, background: "#f6d59d" }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.59 13.41 12 22l-9-9 8.59-8.59A2 2 0 0 1 13 4h5v5a2 2 0 0 1-.59 1.41Z" />
                          <path d="M7 7h.01" />
                          <path d="M10 10l4 4" />
                          <path d="M14 10l-4 4" />
                        </svg>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={title}>Flash Sale</div>
                        <p style={line}>
                          <strong>Flash Sale: 20% OFF</strong> — ends in <strong>02:15 hours</strong>
                        </p>
                      </div>
                      <span style={close} aria-hidden>×</span>
                    </div>

                    {/* Real order */}
                    <div style={{ ...popupBase, color: "#fff", background: "#6c1676" }} aria-label="Recent order popup">
                      <div style={{ width: 50, height: 50, borderRadius: 12, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flex: "0 0 50px" }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6c1676" strokeWidth="1.8">
                          <rect x="3" y="3" width="18" height="18" rx="3" />
                          <circle cx="8.5" cy="9" r="1.5" />
                          <path d="M3 17l5.5-5.5L14 17l3-3 4 3" />
                        </svg>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={title}>Someone from Location</div>
                        <p style={line}>bought this product recently Product Name</p>
                        <p style={small}>12 Hours Ago</p>
                      </div>
                      <span style={close} aria-hidden>×</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEO copy block below preview */}
              <section style={seoBox} itemScope itemType="https://schema.org/SoftwareApplication">
                <h3 style={seoH3}><span itemProp="name">Fomoify Sales Popup &amp; Proof</span> </h3>
                <p style={seoP} itemProp="description">
                  Add conversion-focused <strong>sales popups</strong>, <strong>recent purchase notifications</strong>, Fomoify creates instant trust and urgency so more visitors become buyers.
                </p>
                <ul style={seoUl}>
                  <li><strong>Social proof</strong>: show real orders, location &amp; time to validate product demand.</li>
                  <li><strong>Urgency</strong>: flash-sale message with a live end time to reduce cart hesitation.</li>
                  <li><strong>Customizable</strong>: colors, timing, visibility, and page targeting fit your brand.</li>
                  <li><strong>Lightweight</strong>: theme app embed; no code required to enable/disable.</li>
                </ul>
                <meta itemProp="applicationCategory" content="MarketingApplication" />
                <meta itemProp="operatingSystem" content="Shopify" />
              </section>
            </BlockStack>
          </Card>
      </BlockStack>
    </Page>
  );
}
