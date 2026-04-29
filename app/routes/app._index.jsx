// app/routes/app._index.jsx
// Updated: 2026-03-30 - Backfill shop owner data on index page load for existing users
import { defer, json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  useLocation,
  useNavigate,
  useRevalidator,
} from "@remix-run/react";
import { useEffect, useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { upsertInstalledShop } from "../utils/upsertShop.server";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  InlineGrid,
  Box,
  Badge,
  Modal,
  Pagination,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import { APP_EMBED_HANDLE } from "../utils/themeEmbed.shared";
import { getEmbedPingStatus } from "../utils/embedPingStatus.server";
import { sendOwnerEmail } from "../utils/sendOwnerEmail.server";
import { maybeSendAnnouncementEmail } from "../utils/sendAnnouncementEmail.server";

const CONTACT_SUBJECT_DEFAULT = "Support Request (FOMO Shopify App)";
const CONTACT_ACK_SUBJECT = "We received your support request (FOMO Shopify App)";
const CONTACT_FORM_INITIAL = {
  name: "",
  email: "",
  subject: CONTACT_SUBJECT_DEFAULT,
  message: "",
};
const SUPPORT_HELP_URL = "https://fomoifysalespopupproof.tawk.help/category/features";
const SCHEDULE_CALL_URL =
  "https://outlook.office.com/book/ShopifyGrowthConsultationCall@m2webdesigning.com/";
const PROMOTED_UPSELL_APP_URL = "https://apps.shopify.com/cartlift-cart-drawer-upsell";
const POPUPS_PER_SLIDE = 2;
const POPUP_CARD_DATA = [
  {
    key: "recent",
    title: "Recent Purchases Popup",
    desc: "Show real-time customer activity to create social proof and FOMO.",
    path: "/app/notification/recent",
    imageName: "Recent cart.png",
  },
  {
    key: "flash",
    title: "Flash Sale",
    desc: "Announce limited-time offers with a sticky top bar and timer.",
    path: "/app/notification/flash",
    imageName: "Flash Sale.png",
  },
  {
    key: "visitor",
    title: "Visitor Popup",
    desc: "Show live visitor activity and product interest notifications.",
    path: "/app/notification/visitor",
    imageName: "Visitor Popup - new.png",
  },
  {
    key: "lowstock",
    title: "Low Stock Popup",
    desc: "Create urgency when inventory is running low.",
    path: "/app/notification/lowstock",
    imageName: "low stock popup.png",
  },
  {
    key: "addtocart",
    title: "Add to Cart Notification",
    desc: "Show live add-to-cart activity to build social proof.",
    path: "/app/notification/addtocart",
    imageName: "add to cart notification.png",
  },
  {
    key: "review",
    title: "Review Notification",
    desc: "Show new product reviews to build trust and social proof.",
    path: "/app/notification/review",
    imageName: "Review notification.png",
  },
];


function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function PopupSliderCard({
  title,
  desc,
  imageName,
  onCreate,
  onManage,
  loading,
}) {
  const imageSrc = `/images/${encodeURIComponent(imageName)}`;

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start" gap="300" wrap={false}>
          <Box minWidth="0">
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                {title}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {desc}
              </Text>
            </BlockStack>
          </Box>
          <Thumbnail
            source={imageSrc}
            alt={`${title} preview`}
            size="large"
            transparent
          />
        </InlineStack>
        <InlineStack gap="200">
          <Button variant="primary" onClick={onCreate} loading={loading} disabled={loading}>
            {loading ? "Opening..." : "Create"}
          </Button>
          <Button onClick={onManage} disabled={loading}>
            Manage
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { getAppEmbedContext } = await import(
    "../utils/themeEmbed.server"
  );
  const url = new URL(request.url);
  const normalizeShop = (value) => String(value || "").trim().toLowerCase();
  const toShopSlug = (value) => {
    const raw = normalizeShop(value).replace(/^https?:\/\//, "");
    if (!raw) return "";

    const storeMatch = raw.match(/\/store\/([a-z0-9-]+)/);
    if (storeMatch?.[1]) return storeMatch[1];

    const domainMatch = raw.match(/^([a-z0-9-]+)\.myshopify\.com\b/);
    if (domainMatch?.[1]) return domainMatch[1];

    const pathOnly = raw.split(/[?#]/)[0];
    const parts = pathOnly
      .split("/")
      .filter(Boolean)
      .filter((part) => part !== "store");
    return parts[0] || "";
  };
  const toShopDomain = (value) => {
    const slug = toShopSlug(value);
    return slug ? `${slug}.myshopify.com` : "";
  };
  const shop =
    normalizeShop(session?.shop) ||
    normalizeShop(url.searchParams.get("shop"));
  if (!shop) throw new Response("Unauthorized", { status: 401 });
  const slug =
    toShopSlug(shop) ||
    normalizeShop(shop)
      .replace(".myshopify.com", "")
      .split("/")
      .filter(Boolean)
      .filter((part) => part !== "store")[0] ||
    "";
  const shopDomain = toShopDomain(shop);

  // Fire announcement email in background ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â does not block page load
  maybeSendAnnouncementEmail(shopDomain, session?.email ?? null).catch((err) =>
    console.error("[announcement email] error:", err.message)
  );

  // Backfill shop owner data in background if any field is missing
  prisma.shop
    .findUnique({ where: { shop }, select: { name: true, email: true } })
    .then(async (shopRow) => {
      if (!shopRow?.name || !shopRow?.email) {
        try {
          const resp = await admin.graphql(
            `#graphql
            query ShopOwnerInfo {
              shop {
                name email contactEmail myshopifyDomain currencyCode
                plan { displayName }
                primaryDomain { host }
                billingAddress { country city phone }
              }
            }`
          );
          const js = await resp.json();
          if (js.errors) {
            console.error("[FOMO][index] GraphQL errors:", JSON.stringify(js.errors));
            return;
          }
          const sd = js?.data?.shop || {};
          if (sd.name) {
            await upsertInstalledShop({
              shop,
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
            console.log("[FOMO][index] shop data backfilled for", shop, sd.name);
          }
        } catch (e) {
          console.error("[FOMO][index] failed to backfill shop data:", e);
        }
      }
    })
    .catch((e) => console.error("[FOMO][index] shop lookup failed:", e));

  const apiKey =
    process.env.SHOPIFY_API_KEY ||
    process.env.SHOPIFY_APP_BRIDGE_APP_ID ||
    "";
  const extId = process.env.SHOPIFY_THEME_EXTENSION_ID || "";

  // Deferred: starts fetch immediately but does NOT block the page render.
  // Resolves to { themeId, appEmbedEnabled, appEmbedFound, appEmbedChecked }
  const embedContextPromise = shop
    ? getAppEmbedContext({ admin, shop, apiKey, extId, embedHandle: APP_EMBED_HANDLE })
    : Promise.resolve({ themeId: null, appEmbedEnabled: false, appEmbedFound: false, appEmbedChecked: false });

  const embedPingStatusPromise = getEmbedPingStatus(shop);

  return defer({
    slug,
    shopDomain,
    apiKey,
    embedPingStatus: embedPingStatusPromise,
    embedContext: embedContextPromise,
  });
};

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;
  if (!shop) throw new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const search = new URLSearchParams(url.search);
  const form = await request.formData();
  const _action = form.get("_action");
  const isFetch = request.headers.get("X-Remix-Request") === "yes";

  const safeJson = (data, init = {}) => json(data, init);

  if (_action === "delete") {
    const id = Number(form.get("id"));
    const key = String(form.get("key") || "").toLowerCase();
    try {
      const model =
        key === "recent"
          ? prisma.recentpopupconfig || prisma.recentPopupConfig
        : key === "flash"
          ? prisma.flashpopupconfig || prisma.flashPopupConfig
        : key === "visitor"
          ? prisma.visitorpopupconfig || prisma.visitorPopupConfig
        : key === "lowstock"
          ? prisma.lowstockpopupconfig || prisma.lowStockPopupConfig
        : key === "addtocart"
          ? prisma.addtocartpopupconfig || prisma.addToCartPopupConfig
        : key === "review"
          ? prisma.reviewpopupconfig || prisma.reviewPopupConfig
        : null;
      if (id && model?.deleteMany) {
        await model.deleteMany({ where: { id, shop } });
      }
      if (isFetch) return safeJson({ ok: true });
      search.set("deleted", "1");
      return redirect(`/app?${search.toString()}`);
    } catch (e) {
      console.error("[home.action:delete] error:", e);
      if (isFetch) {
        return safeJson({ ok: false, error: "Delete failed" }, { status: 500 });
      }
      search.set("error", "1");
      return redirect(`/app?${search.toString()}`);
    }
  }

  if (_action === "update") {
    const id = Number(form.get("id"));
    const key = String(form.get("key") || "").toLowerCase();
    const messageText = form.get("messageText")?.toString() ?? "";
    const showType = form.get("showType")?.toString() ?? "allpage";
    const enabled = form.get("enabled") === "on";

    try {
      const model =
        key === "recent"
          ? prisma.recentpopupconfig || prisma.recentPopupConfig
        : key === "flash"
          ? prisma.flashpopupconfig || prisma.flashPopupConfig
        : key === "visitor"
          ? prisma.visitorpopupconfig || prisma.visitorPopupConfig
        : key === "lowstock"
          ? prisma.lowstockpopupconfig || prisma.lowStockPopupConfig
        : key === "addtocart"
          ? prisma.addtocartpopupconfig || prisma.addToCartPopupConfig
        : key === "review"
          ? prisma.reviewpopupconfig || prisma.reviewPopupConfig
        : null;
      const data =
        key === "recent" || key === "flash"
          ? { messageText, showType, enabled }
          : { enabled };
      if (id && model?.updateMany) {
        await model.updateMany({
          where: { id, shop },
          data,
        });
      }
      if (isFetch) return safeJson({ ok: true, saved: true });
      search.set("saved", "1");
      return redirect(`/app?${search.toString()}`);
    } catch (e) {
      console.error("[home.action:update] error:", e);
      if (isFetch) {
        return safeJson({ ok: false, error: "Update failed" }, { status: 500 });
      }
      search.set("error", "1");
      return redirect(`/app?${search.toString()}`);
    }
  }

  if (_action === "toggle-enabled") {
    const id = Number(form.get("id"));
    const key = String(form.get("key") || "").toLowerCase();
    const enabled = form.get("enabled") === "on";
    try {
      const model =
        key === "recent"
          ? prisma.recentpopupconfig || prisma.recentPopupConfig
        : key === "flash"
          ? prisma.flashpopupconfig || prisma.flashPopupConfig
        : key === "visitor"
          ? prisma.visitorpopupconfig || prisma.visitorPopupConfig
        : key === "lowstock"
          ? prisma.lowstockpopupconfig || prisma.lowStockPopupConfig
        : key === "addtocart"
          ? prisma.addtocartpopupconfig || prisma.addToCartPopupConfig
        : key === "review"
          ? prisma.reviewpopupconfig || prisma.reviewPopupConfig
        : null;
      if (id && model?.updateMany) {
        await model.updateMany({
          where: { id, shop },
          data: { enabled },
        });
      }
      if (isFetch) return safeJson({ ok: true });
      return redirect(`/app?${search.toString()}`);
    } catch (e) {
      console.error("[home.action:toggle] error:", e);
      if (isFetch) {
        return safeJson({ ok: false, error: "Toggle failed" }, { status: 500 });
      }
      search.set("error", "1");
      return redirect(`/app?${search.toString()}`);
    }
  }

  if (_action === "report-issue") {
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const subjectRaw = String(form.get("subject") || "").trim();
    const message = String(form.get("message") || "").trim();
    const ownerEmail = String(process.env.APP_OWNER_FALLBACK_EMAIL || "").trim();
    const smtpConfigured = Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    );

    if (!message) {
      return safeJson(
        { ok: false, error: "Message is required." },
        { status: 400 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return safeJson(
        {
          ok: false,
          error: "Valid email is required so our team can contact you.",
        },
        { status: 400 }
      );
    }

    if (!ownerEmail) {
      return safeJson(
        {
          ok: false,
          error: "Owner email is not configured. Set APP_OWNER_FALLBACK_EMAIL.",
        },
        { status: 500 }
      );
    }

    if (!smtpConfigured) {
      return safeJson(
        {
          ok: false,
          error: "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.",
        },
        { status: 500 }
      );
    }

    const subject = subjectRaw || CONTACT_SUBJECT_DEFAULT;
    const submittedAt = new Date().toISOString();
    const safeShop = String(shop || "").trim() || "-";
    const textBody = [
      "New issue report from app dashboard.",
      "",
      `Submitted at: ${submittedAt}`,
      `Shop: ${safeShop}`,
      `Name: ${name || "-"}`,
      `Email: ${email || "-"}`,
      "",
      "Message:",
      message,
    ].join("\n");

    const htmlBody = `
      <html>
        <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
          <h2 style="margin:0 0 12px;">New issue report from app dashboard</h2>
          <p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>
          <p><strong>Shop:</strong> ${escapeHtml(safeShop)}</p>
          <p><strong>Name:</strong> ${escapeHtml(name || "-")}</p>
          <p><strong>Email:</strong> ${escapeHtml(email || "-")}</p>
          <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
          <p><strong>Message:</strong></p>
          <pre style="white-space:pre-wrap;background:#f8f9fb;padding:12px;border-radius:8px;">${escapeHtml(message)}</pre>
        </body>
      </html>
    `.trim();

    const customerTextBody = [
      "Hi,",
      "",
      "We received your support request for Fomoify Sales Popup & Proof.",
      "Our team will contact you soon.",
      "",
      `Shop: ${safeShop}`,
      `Submitted at: ${submittedAt}`,
      `Subject: ${subject}`,
      "",
      "Your message:",
      message,
      "",
      "Thanks,",
      "Fomoify Support Team",
    ].join("\n");

    const customerHtmlBody = `
      <html>
        <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
          <h2 style="margin:0 0 12px;">Support request received</h2>
          <p>Hi,</p>
          <p>We received your support request for <strong>Fomoify Sales Popup &amp; Proof</strong>.</p>
          <p>Our team will contact you soon.</p>
          <p><strong>Shop:</strong> ${escapeHtml(safeShop)}</p>
          <p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>
          <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
          <p><strong>Your message:</strong></p>
          <pre style="white-space:pre-wrap;background:#f8f9fb;padding:12px;border-radius:8px;">${escapeHtml(message)}</pre>
          <p>Thanks,<br/>Fomoify Support Team</p>
        </body>
      </html>
    `.trim();

    try {
      await sendOwnerEmail({
        to: ownerEmail,
        subject: `[Issue Report] ${subject}`,
        text: textBody,
        html: htmlBody,
      });
      await sendOwnerEmail({
        to: email,
        subject: CONTACT_ACK_SUBJECT,
        text: customerTextBody,
        html: customerHtmlBody,
      });
      return safeJson({ ok: true });
    } catch (e) {
      console.error("[home.action:report-issue] error:", e);
      return safeJson(
        { ok: false, error: "Failed to send issue email." },
        { status: 500 }
      );
    }
  }

  return safeJson({ ok: false, error: "Unknown action" }, { status: 400 });
}

export default function AppIndex() {
  const {
    slug,
    shopDomain,
    apiKey,
    embedPingStatus,
    embedContext,
  } = useLoaderData();
  const contactFetcher = useFetcher();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const location = useLocation();
  const [resolvedThemeId, setResolvedThemeId] = useState(null);
  const [isEmbedContextLoading, setIsEmbedContextLoading] = useState(true);
  const [embedContextState, setEmbedContextState] = useState({
    appEmbedEnabled: false,
    appEmbedFound: false,
    appEmbedChecked: false,
  });
  const [isEmbedPingLoading, setIsEmbedPingLoading] = useState(true);
  const [embedPing, setEmbedPing] = useState({
    isOn: false,
    isFresh: false,
    lastPingAt: null,
    checkedAt: null,
  });
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState(CONTACT_FORM_INITIAL);
  const [contactError, setContactError] = useState("");
  const [popupLoadingKey, setPopupLoadingKey] = useState(null);
  const [popupSlideIndex, setPopupSlideIndex] = useState(0);
  const search = location.search || "";
  const appUrl = useCallback((path) => `${path}${search}`, [search]);
  const hasThemeEmbedCheck = embedContextState.appEmbedChecked === true;
  const hasThemeEmbedSignal =
    hasThemeEmbedCheck && embedContextState.appEmbedFound === true;
  const hasFreshPingSignal =
    embedPing?.isFresh === true || embedPing?.isOn === true;
  // Use theme result when embed block is positively identified; otherwise trust ping fallback.
  const isEmbedActive = hasThemeEmbedSignal
    ? Boolean(embedContextState.appEmbedEnabled)
    : hasFreshPingSignal;
  const embedBadgeTone = isEmbedActive ? "success" : "critical";
  const embedBadgeText = `App embed: ${isEmbedActive ? "ON" : "OFF"}`;
  const maxPopupSlideIndex = Math.max(
    Math.ceil(POPUP_CARD_DATA.length / POPUPS_PER_SLIDE) - 1,
    0
  );
  const popupSlideCards = POPUP_CARD_DATA.slice(
    popupSlideIndex * POPUPS_PER_SLIDE,
    popupSlideIndex * POPUPS_PER_SLIDE + POPUPS_PER_SLIDE
  );

  useEffect(() => {
    let active = true;
    setIsEmbedContextLoading(true);
    Promise.resolve(embedContext)
      .then((ctx) => {
        if (!active) return;
        setResolvedThemeId(ctx?.themeId ?? null);
        setEmbedContextState({
          appEmbedEnabled: Boolean(ctx?.appEmbedEnabled),
          appEmbedFound: Boolean(ctx?.appEmbedFound),
          appEmbedChecked: Boolean(ctx?.appEmbedChecked),
        });
      })
      .catch(() => {
        if (!active) return;
        setEmbedContextState({ appEmbedEnabled: false, appEmbedFound: false, appEmbedChecked: false });
      })
      .finally(() => {
        if (active) setIsEmbedContextLoading(false);
      });
    return () => {
      active = false;
    };
  }, [embedContext]);

  useEffect(() => {
    let active = true;
    setIsEmbedPingLoading(true);
    Promise.resolve(embedPingStatus)
      .then((state) => {
        if (!active) return;
        setEmbedPing({
          isOn: Boolean(state?.isOn),
          isFresh: Boolean(state?.isFresh ?? state?.isOn),
          lastPingAt: state?.lastPingAt || null,
          checkedAt: state?.checkedAt || null,
        });
      })
      .catch(() => {
        if (!active) return;
        setEmbedPing({
          isOn: false,
          isFresh: false,
          lastPingAt: null,
          checkedAt: null,
        });
      })
      .finally(() => {
        if (active) setIsEmbedPingLoading(false);
      });
    return () => {
      active = false;
    };
  }, [embedPingStatus]);

  useEffect(() => {
    const refreshStatus = () => {
      if (revalidator.state === "idle") revalidator.revalidate();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshStatus();
    };
    window.addEventListener("focus", refreshStatus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshStatus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [revalidator]);

  useEffect(() => {
    const data = contactFetcher.data;
    if (!data) return;
    if (data.ok) {
      setContactForm(CONTACT_FORM_INITIAL);
      setContactError("");
      setIsContactModalOpen(false);
      return;
    }
    setContactError(String(data.error || "Failed to send issue email."));
  }, [contactFetcher.data]);

  const toThemeEditorThemeId = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "current";
    const idMatch = raw.match(/\d+/);
    return idMatch ? idMatch[0] : "current";
  };

  const openThemeEditor = (id, mode = "open") => {
    const safeThemeId = toThemeEditorThemeId(id);
    const params = new URLSearchParams({ context: "apps" });
    if (mode === "activate" && apiKey) {
      const embedId = `${apiKey}/${APP_EMBED_HANDLE}`;
      params.set("activateAppId", embedId);
    }
    const editorBase = shopDomain
      ? `https://${shopDomain}/admin`
      : `https://admin.shopify.com/store/${slug}`;
    const url = `${editorBase}/themes/${safeThemeId}/editor?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const goPopupCreate = useCallback(
    (path, key) => {
      if (popupLoadingKey) return;
      setPopupLoadingKey(`${key}-create`);
      setTimeout(() => navigate(appUrl(path)), 350);
    },
    [appUrl, navigate, popupLoadingKey]
  );

  const goPopupManage = useCallback(
    (key) => {
      if (popupLoadingKey) return;
      setPopupLoadingKey(`${key}-manage`);
      setTimeout(() => navigate(appUrl("/app/notification/manage")), 350);
    },
    [appUrl, navigate, popupLoadingKey]
  );

  const previousPopupSlide = useCallback(() => {
    setPopupSlideIndex((index) => Math.max(index - 1, 0));
  }, []);

  const nextPopupSlide = useCallback(() => {
    setPopupSlideIndex((index) => Math.min(index + 1, maxPopupSlideIndex));
  }, [maxPopupSlideIndex]);

  const updateContactField = (field) => (value) => {
    setContactForm((prev) => ({ ...prev, [field]: value }));
  };

  const openContactModal = () => {
    setContactError("");
    setIsContactModalOpen(true);
  };

  const closeContactModal = () => {
    setIsContactModalOpen(false);
  };

  const submitContactIssue = () => {
    setContactError("");
    const subject = String(contactForm.subject || "").trim() || CONTACT_SUBJECT_DEFAULT;
    const message = String(contactForm.message || "").trim();
    const email = String(contactForm.email || "").trim();
    if (!message) {
      setContactError("Message is required.");
      return;
    }
    if (!email || !isValidEmail(email)) {
      setContactError("Valid email is required so our team can contact you.");
      return;
    }

    const payload = new FormData();
    payload.set("_action", "report-issue");
    payload.set("name", String(contactForm.name || "").trim());
    payload.set("email", email);
    payload.set("subject", subject);
    payload.set("message", message);
    contactFetcher.submit(payload, { method: "post" });
  };

  return (
    <Page>
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" gap="300">
              <BlockStack gap="100">
                <Text as="h2" variant="headingSm">
                  App embed status
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Keep the storefront embed enabled so popups can appear on your theme.
                </Text>
              </BlockStack>
              <Badge tone={embedBadgeTone}>{embedBadgeText}</Badge>
            </InlineStack>
            <InlineStack gap="300" align="start">
              <Button
                variant="primary"
                onClick={() => openThemeEditor(resolvedThemeId, "activate")}
                loading={isEmbedContextLoading || isEmbedPingLoading}
              >
                Open App Embeds
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center" gap="300">
              <BlockStack gap="100">
                <Text as="h2" variant="headingSm">
                  Campaign popups
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Pick a notification type and launch it in a few clicks.
                </Text>
              </BlockStack>
              <Pagination
                hasPrevious={popupSlideIndex > 0}
                hasNext={popupSlideIndex < maxPopupSlideIndex}
                onPrevious={previousPopupSlide}
                onNext={nextPopupSlide}
                label={`${popupSlideIndex + 1} of ${maxPopupSlideIndex + 1}`}
                accessibilityLabel="Campaign popup slides"
              />
            </InlineStack>
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
              {popupSlideCards.map((card) => (
                <PopupSliderCard
                  key={card.key}
                  title={card.title}
                  desc={card.desc}
                  imageName={card.imageName}
                  onCreate={() => goPopupCreate(card.path, card.key)}
                  onManage={() => goPopupManage(card.key)}
                  loading={
                    popupLoadingKey === `${card.key}-create` ||
                    popupLoadingKey === `${card.key}-manage`
                  }
                />
              ))}
            </InlineGrid>
          </BlockStack>
        </Card>

        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Card>
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text as="h2" variant="headingSm">
                  Support
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Get setup help or find answers in the help center.
                </Text>
              </BlockStack>
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingSm">
                      Support Ticket
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Support, reply, and assist instantly in office hours.
                    </Text>
                    <Button onClick={openContactModal}>Report an issue</Button>
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingSm">
                      Knowledge base
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Find a solution for your problem with our documents.
                    </Text>
                    <Button
                      onClick={() => window.open(SUPPORT_HELP_URL, "_blank", "noopener,noreferrer")}
                    >
                      Open help center
                    </Button>
                  </BlockStack>
                </Card>
              </InlineGrid>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">
                Book a Free 30-Minute Setup Call
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Get personalized guidance for app configuration, best practices, and growth strategy.
              </Text>
              <InlineStack gap="200" wrap>
                <Badge>App configuration</Badge>
                <Badge>Best practices</Badge>
                <Badge>Growth strategy</Badge>
              </InlineStack>
              <InlineStack gap="300" blockAlign="center">
                <Button
                  variant="primary"
                  onClick={() => window.open(SCHEDULE_CALL_URL, "_blank", "noopener,noreferrer")}
                >
                  Schedule Free Call
                </Button>
                <Text as="span" variant="bodySm" tone="subdued">
                  Free | 30 mins | No commitment
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Boost your store performance with our apps
            </Text>
            <InlineStack gap="300" blockAlign="center" wrap={false}>
              <Thumbnail source="/images/cartlift.png" alt="CartLift app" size="medium" />
              <Box minWidth="0">
                <BlockStack gap="100">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h3" variant="headingSm">
                      CartLift: Cart Drawer &amp; Upsell
                    </Text>
                    <Badge tone="info">Upsell</Badge>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Grow average order value with cart drawer upsells and smart cart offers.
                  </Text>
                </BlockStack>
              </Box>
              <Button
                variant="primary"
                onClick={() => window.open(PROMOTED_UPSELL_APP_URL, "_blank", "noopener,noreferrer")}
              >
                Add app
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Modal
          open={isContactModalOpen}
          onClose={closeContactModal}
          title="Contact Support"
          primaryAction={{
            content: "Send",
            onAction: submitContactIssue,
            loading: contactFetcher.state !== "idle",
            disabled:
              contactFetcher.state !== "idle" ||
              !String(contactForm.email || "").trim() ||
              !String(contactForm.message || "").trim(),
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: closeContactModal,
              disabled: contactFetcher.state !== "idle",
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodySm" tone="subdued">
                Share issue details with your email. Our team will contact you soon.
              </Text>
              <TextField
                label="Name"
                value={contactForm.name}
                onChange={updateContactField("name")}
                autoComplete="name"
              />
              <TextField
                label="Email"
                type="email"
                value={contactForm.email}
                onChange={updateContactField("email")}
                autoComplete="email"
              />
              <TextField
                label="Subject"
                value={contactForm.subject}
                onChange={updateContactField("subject")}
                autoComplete="off"
              />
              <TextField
                label="Message"
                value={contactForm.message}
                onChange={updateContactField("message")}
                multiline={6}
                autoComplete="off"
              />
              {contactError ? (
                <Text as="p" variant="bodySm" tone="critical">
                  {contactError}
                </Text>
              ) : null}
            </BlockStack>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}

