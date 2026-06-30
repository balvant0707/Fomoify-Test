// app/routes/app._index.jsx
import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  useLocation,
  useNavigate,
  useRevalidator,
} from "@remix-run/react";
import dashboardStyles from "../styles/dashboard-index.css?url";
import { useEffect, useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { upsertInstalledShop } from "../utils/upsertShop.server";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  InlineGrid,
  Box,
  Text,
  Button,
  Badge,
  Modal,
  TextField,
  Banner,
  Divider,
  Icon,
  Link as PolarisLink,
} from "@shopify/polaris";
import {
  AppsIcon,
  ChatIcon,
  ExternalIcon,
  HeartIcon,
  StarIcon,
} from "@shopify/polaris-icons";
import { APP_EMBED_HANDLE } from "../utils/themeEmbed.shared";
import { sendOwnerEmail } from "../utils/sendOwnerEmail.server";
import { maybeSendAnnouncementEmail } from "../utils/sendAnnouncementEmail.server";
import { getNotificationManageVisibility } from "../utils/notificationConfigStatus.server";
import { getDashboardReviewPopupStatus } from "../utils/reviewPopupStatus.server";

export const links = () => [{ rel: "stylesheet", href: dashboardStyles }];

const CONTACT_SUBJECT_DEFAULT = "Support Request (FOMO Shopify App)";
const CONTACT_ACK_SUBJECT = "We received your support request (FOMO Shopify App)";
const CONTACT_FORM_INITIAL = {
  name: "",
  email: "",
  subject: CONTACT_SUBJECT_DEFAULT,
  message: "",
};
const SUPPORT_HELP_URL = "https://fomoifysalespopupproof.tawk.help/category/features";
const WHATSAPP_SUPPORT_MESSAGE =
  "Hi Fomoify Support, I need help with my Shopify app.";
const SCHEDULE_CALL_URL =
  "https://outlook.office.com/book/ShopifyGrowthConsultationCall@m2webdesigning.com/";
const PROMOTED_UPSELL_APP_URL = "https://apps.shopify.com/cartlift-cart-drawer-upsell";
const PROMOTED_APPS = [
  {
    title: "CartLift: Cart Drawer & Upsell",
    category: "Upsell",
    description:
      "Grow average order value with cart drawer upsells and smart cart offers.",
    href: PROMOTED_UPSELL_APP_URL,
    imageSrc: "/images/cartlift.png",
    imageAlt: "CartLift: Cart Drawer & Upsell",
  },
  {
    title: "MixBox - Box & Bundle Builder",
    category: "Bundle",
    description:
      "Build custom bundles and boxed products to increase average order value.",
    href: "https://apps.shopify.com/mixbox-box-bundle-builder",
    imageSrc: "/images/mixbox-box-bundle-builder.jpg",
    imageAlt: "MixBox - Box & Bundle Builder",
  },
  {
    title: "Nex AI SEO Product Description",
    category: "SEO",
    description:
      "Generate SEO-friendly content to improve visibility and conversion.",
    href: "https://apps.shopify.com/ai-seo-product-description",
    imageSrc: "/images/ai-content-logo.png",
    imageAlt: "Nex AI SEO Product Description",
  },
];
const WRITE_REVIEW_URL =
  "https://apps.shopify.com/fomoify-sales-popup-proof#modal-show=WriteReviewModal";
const REVIEW_MODAL_APP_NAME = "Fomoify Sales Popup & Proof";
const AUTO_REVIEW_MODAL_ENABLED = true;
const REVIEW_SNOOZE_UNTIL_KEY = "__fomo_review_snooze_until__";
const REVIEW_SUBMITTED_KEY = "__fomo_review_submitted__";
const REVIEW_TOP_BANNER_DISMISSED_KEY = "__fomo_review_top_banner_dismissed__";
const NOTIFICATIONS_PER_SLIDE = 3;
const INDEX_PAGE_INLINE_CSS = `
  .dashboard-index-page h1,
  .dashboard-index-page h2,
  .dashboard-index-page h3,
  .dashboard-index-page h4,
  .dashboard-index-page h5,
  .dashboard-index-page h6,
  .dashboard-index-page .Polaris-Text--headingXs,
  .dashboard-index-page .Polaris-Text--headingSm,
  .dashboard-index-page .Polaris-Text--headingMd,
  .dashboard-index-page .Polaris-Text--headingLg,
  .dashboard-index-page .Polaris-Text--headingXl {
    font-size: 14px !important;
    line-height: 1.25 !important;
    font-weight: bold !important;
  }

  .dashboard-index-page,
  .dashboard-index-page p,
  .dashboard-index-page span,
  .dashboard-index-page label,
  .dashboard-index-page input,
  .dashboard-index-page textarea {
    font-size: 12px !important;
    line-height: 1.3 !important;
  }
  .dashboard-gradient-panel {
    padding: 15px;
    border-radius: 10px;
}
`;
const FEATURED_NOTIFICATION_CARDS = [
  {
    key: "recent",
    title: "Recent Purchase Notification",
    desc: "Show real recent purchases to build FOMO and trust with shoppers",
    badge: "Social proof",
    path: "/app/notification/recent",
    imageName: "recentpu.webp",
    previewType: "order",
  },
  {
    key: "flash",
    title: "Flash Sale Notification",
    desc: "Promote limited-time discounts with a countdown bar on your storefront",
    badge: "Urgency",
    path: "/app/notification/flash",
    imageName: "flashsale.webp",
    previewType: "flash",
  },
  {
    key: "visitor",
    title: "Visitor Notification",
    desc: "Show real-time visitor count to create urgency on your storefront",
    badge: "Social proof",
    path: "/app/notification/visitor",
    imageName: "visitor.webp",
    previewType: "visitor",
  },
  {
    key: "lowstock",
    title: "Low Stock Notification",
    desc: "Alert shoppers when stock is running low to trigger urgency",
    badge: "Social proof",
    path: "/app/notification/lowstock",
    imageName: "lowstock.jpg",
    previewType: "lowstock",
  },
  {
    key: "addtocart",
    title: "Add to Cart Notification",
    desc: "Show live add-to-cart activity to build social proof with shoppers",
    badge: "Social proof",
    path: "/app/notification/addtocart",
    imageName: "add to cart notification.png",
    previewType: "addtocart",
  },
  {
    key: "review",
    title: "Review Notification",
    desc: "Show product reviews to build trust and confidence with shoppers",
    badge: "Social proof",
    path: "/app/notification/review",
    imageName: "review.webp",
    previewType: "review",
  },
  {
    key: "visitor-block",
    title: "Visitor Announcement Bar",
    desc: "Show visitor count inside product information on selected products",
    badge: "Social proof",
    path: "/app/visitor-announcement",
    imageName: "visitorannouncement.webp",
    previewType: "visitor-block",
  },
  {
    key: "stock-block",
    title: "Stock Announcement Bar",
    desc: "Show stock status inside product information on selected products",
    badge: "Urgency",
    path: "/app/stock-announcement",
    imageName: "low stock popup.png",
    previewType: "stock-block",
  },
];
const POPUP_CARD_DATA = [
  {
    key: "recent",
    title: "Recent Purchase Notification",
    desc: "Show real-time customer activity to create social proof and FOMO.",
    path: "/app/notification/recent",
    imageName: "Recent cart.png",
  },
  {
    key: "flash",
    title: "Flash Sale Notification",
    desc: "Announce limited-time offers with a sticky top bar and timer.",
    path: "/app/notification/flash",
    imageName: "Flash Sale.png",
  },
  {
    key: "visitor",
    title: "Visitor Notification",
    desc: "Show live visitor activity and product interest notifications.",
    path: "/app/notification/visitor",
    imageName: "Visitor Popup - new.png",
  },
  {
    key: "lowstock",
    title: "Low Stock Notification",
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
  {
    key: "visitor-block",
    title: "Visitor Announcement Bar",
    desc: "Show visitor count inside product information on all or selected products.",
    path: "/app/visitor-announcement",
    managePath: "/app/notification/manage?type=visitor-block",
    imageName: "Visitor Popup - new.png",
  },
  {
    key: "stock-block",
    title: "Stock Announcement Bar",
    desc: "Show stock status inside product information on all or selected products.",
    path: "/app/stock-announcement",
    managePath: "/app/notification/manage?type=stock-block",
    imageName: "low stock popup.png",
  },
];

function splitIntoSlides(items, perSlide) {
  const out = [];
  for (let idx = 0; idx < items.length; idx += perSlide) {
    out.push(items.slice(idx, idx + perSlide));
  }
  return out;
}

const FEATURED_NOTIFICATION_SLIDES = splitIntoSlides(
  FEATURED_NOTIFICATION_CARDS,
  NOTIFICATIONS_PER_SLIDE
);

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

function FeaturedNotificationCard({
  title,
  desc,
  badge,
  imageName,
  previewType,
  onCreate,
  loading,
}) {
  const imageSrc = `/images/${encodeURIComponent(imageName)}`;

  return (
    <Box
      className="dashboard-feature-card"
      borderWidth="025"
      borderRadius="300"
      borderColor="border"
      background="bg-surface"
    >
      <Box className={`dashboard-feature-preview dashboard-feature-preview--${previewType}`}>
        <img src={imageSrc} alt="" aria-hidden />
      </Box>
      <Box padding="400">
        <BlockStack gap="300">
          <InlineStack gap="200" blockAlign="center" wrap>
            <Text as="h3" variant="headingMd" fontWeight="bold">
              {title}
            </Text>
            <Badge tone="info">{badge}</Badge>
          </InlineStack>
          <Text as="p" tone="subdued">
            {desc}
          </Text>
          <InlineStack align="end">
            <Button onClick={onCreate} loading={loading} disabled={loading}>
              {loading ? "Opening..." : "Create"}
            </Button>
          </InlineStack>
        </BlockStack>
      </Box>
    </Box>
  );
}

function PromotedAppCard({ app }) {
  return (
    <Box borderWidth="025" borderRadius="300" borderColor="border" padding="400">
      <BlockStack gap="300">
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <Box
            className="dashboard-app-icon"
            borderRadius="300"
            borderWidth="025"
            borderColor="border"
          >
            <img src={app.imageSrc} alt={app.imageAlt} />
          </Box>
          <BlockStack gap="100">
            <InlineStack gap="200" blockAlign="center" wrap>
              <Text as="h3" variant="headingSm" fontWeight="bold">
                {app.title}
              </Text>
              <Badge>{app.category}</Badge>
            </InlineStack>
          </BlockStack>
        </InlineStack>
        <Text tone="subdued">{app.description}</Text>
        <InlineStack>
          <Button
            variant="primary"
            icon={ExternalIcon}
            onClick={() => window.open(app.href, "_blank", "noopener,noreferrer")}
          >
            Add app
          </Button>
        </InlineStack>
      </BlockStack>
    </Box>
  );
}

function DashboardIcon({ source, tone = "info", shape = "square" }) {
  return (
    <Box className={`dashboard-icon dashboard-icon--${tone} dashboard-icon--${shape}`}>
      <Icon source={source} />
    </Box>
  );
}

function ReviewStars({ rating, hoverRating, onHover, onLeave, onSelect }) {
  const activeValue = hoverRating || rating;
  return (
    <InlineStack gap="100" aria-label="Rate this app">
      {[1, 2, 3, 4, 5].map((value) => (
        <Box
          as="button"
          key={value}
          type="button"
          className={`review-star-btn${value <= activeValue ? " is-active" : ""}`}
          aria-label={`${value} star${value > 1 ? "s" : ""}`}
          onMouseEnter={() => onHover(value)}
          onMouseLeave={onLeave}
          onFocus={() => onHover(value)}
          onBlur={onLeave}
          onClick={() => onSelect(value)}
        >
          <Icon source={StarIcon} />
        </Box>
      ))}
    </InlineStack>
  );
}
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { getAppEmbedContext } = await import(
    "../utils/themeEmbed.server"
  );
  const { getEmbedPingStatus } = await import(
    "../utils/embedPingStatus.server"
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

  // Fire announcement email in background — does not block page load
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

  // Resolve before first render so the dashboard badge is immediately ON/OFF.
  const embedContextState = shop
    ? getAppEmbedContext({ admin, shop, apiKey, extId, embedHandle: APP_EMBED_HANDLE })
    : Promise.resolve({ themeId: null, appEmbedEnabled: false, appEmbedFound: false, appEmbedChecked: false });

  const [embedContext, embedPingStatus] = await Promise.all([
    embedContextState,
    getEmbedPingStatus(shopDomain || shop),
  ]);
  const dashboardReviewPopupStatus = await getDashboardReviewPopupStatus(shop);
  const popupManageByKey = await getNotificationManageVisibility(
    shop,
    POPUP_CARD_DATA.map((card) => card.key)
  );

  return json({
    slug,
    shopDomain,
    apiKey,
    extId,
    dashboardReviewPopupStatus,
    popupManageByKey,
    embedContext,
    embedPingStatus,
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
    extId,
    dashboardReviewPopupStatus,
    embedContext,
    embedPingStatus,
  } = useLoaderData();
  const contactFetcher = useFetcher();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const location = useLocation();
  const [resolvedThemeId, setResolvedThemeId] = useState(
    embedContext?.themeId ?? null
  );
  const [embedContextState, setEmbedContextState] = useState({
    appEmbedEnabled: Boolean(embedContext?.appEmbedEnabled),
    appEmbedFound: Boolean(embedContext?.appEmbedFound),
    appEmbedChecked: Boolean(embedContext?.appEmbedChecked),
    pingFresh: Boolean(embedPingStatus?.isFresh),
  });
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewMessage, setReviewMessage] = useState("");
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState(CONTACT_FORM_INITIAL);
  const [contactError, setContactError] = useState("");
  const [showTopReviewBanner, setShowTopReviewBanner] = useState(true);
  const [showSuccessHelpSection] = useState(true);
  const [popupLoadingKey, setPopupLoadingKey] = useState(null);
  const [notificationSlideIndex, setNotificationSlideIndex] = useState(0);
  const search = location.search || "";
  const appUrl = useCallback(
    (path) => {
      if (!search) return path;
      return `${path}${path.includes("?") ? "&" : "?"}${search.slice(1)}`;
    },
    [search]
  );
  const hasThemeEmbedCheck = embedContextState.appEmbedChecked === true;
  const hasThemeEmbedSignal =
    (hasThemeEmbedCheck && embedContextState.appEmbedFound === true) ||
    embedContextState.pingFresh === true;
  const isEmbedActive =
    hasThemeEmbedSignal &&
    ((hasThemeEmbedCheck && Boolean(embedContextState.appEmbedEnabled)) ||
      embedContextState.pingFresh === true);
  const embedStatusTone = isEmbedActive ? "on" : "off";
  const embedBadgeText = isEmbedActive ? "ON" : "OFF";
  const whatsappSupportUrl = `https://wa.me/?text=${encodeURIComponent(
    `${WHATSAPP_SUPPORT_MESSAGE}${shopDomain ? ` Store: ${shopDomain}` : ""}`
  )}`;
  const shouldShowReviewPopup = Boolean(
    dashboardReviewPopupStatus?.shouldShowReviewPopup
  );

  useEffect(() => {
    let active = true;
    Promise.resolve(embedContext)
      .then((ctx) => {
        if (!active) return;
        setResolvedThemeId(ctx?.themeId ?? null);
        setEmbedContextState({
          appEmbedEnabled: Boolean(ctx?.appEmbedEnabled),
          appEmbedFound: Boolean(ctx?.appEmbedFound),
          appEmbedChecked: Boolean(ctx?.appEmbedChecked),
          pingFresh: Boolean(embedPingStatus?.isFresh),
        });
      })
      .catch(() => {
        if (!active) return;
        setEmbedContextState({
          appEmbedEnabled: false,
          appEmbedFound: false,
          appEmbedChecked: false,
          pingFresh: Boolean(embedPingStatus?.isFresh),
        });
      });
    return () => {
      active = false;
    };
  }, [embedContext, embedPingStatus]);

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
      params.set("template", "index");
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

  const updateContactField = (field) => (value) => {
    setContactForm((prev) => ({ ...prev, [field]: value }));
  };

  const reviewSnoozeUntilSlot = `${REVIEW_SNOOZE_UNTIL_KEY}:${shopDomain || slug || "store"}`;
  const reviewSubmittedSlot = `${REVIEW_SUBMITTED_KEY}:${shopDomain || slug || "store"}`;
  const reviewTopBannerDismissedSlot = `${REVIEW_TOP_BANNER_DISMISSED_KEY}:${shopDomain || slug || "store"}`;
  const isReviewSubmitted = useCallback(() => {
    try {
      return localStorage.getItem(reviewSubmittedSlot) === "1";
    } catch {
      return false;
    }
  }, [reviewSubmittedSlot]);
  const isReviewSnoozed = useCallback(() => {
    try {
      const until = Number(localStorage.getItem(reviewSnoozeUntilSlot) || 0);
      return Number.isFinite(until) && until > Date.now();
    } catch {
      return false;
    }
  }, [reviewSnoozeUntilSlot]);
  const snoozeReviewPrompt = useCallback((days = 3) => {
    const millis = Number(days) * 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem(reviewSnoozeUntilSlot, String(Date.now() + millis));
    } catch {}
  }, [reviewSnoozeUntilSlot]);
  const markReviewSubmitted = useCallback(() => {
    try {
      localStorage.setItem(reviewSubmittedSlot, "1");
      localStorage.removeItem(reviewSnoozeUntilSlot);
    } catch {}
  }, [reviewSubmittedSlot, reviewSnoozeUntilSlot]);
  const dismissTopReviewBanner = useCallback(() => {
    setShowTopReviewBanner(false);
    try { localStorage.setItem(reviewTopBannerDismissedSlot, "1"); } catch {}
  }, [reviewTopBannerDismissedSlot]);

  const resetReviewDraft = () => {
    setReviewRating(0);
    setReviewHoverRating(0);
    setReviewMessage("");
  };

  const closeReviewModal = () => {
    setReviewHoverRating(0);
    setIsReviewModalOpen(false);
    snoozeReviewPrompt(3);
  };

  const openContactModal = () => {
    setContactError("");
    setIsContactModalOpen(true);
  };

  const closeContactModal = () => {
    setIsContactModalOpen(false);
  };

  const openSupportFromReview = () => {
    closeReviewModal();
    openContactModal();
  };

  const submitReviewModal = () => {
    if (!reviewRating) return;
    window.open(WRITE_REVIEW_URL, "_blank", "noopener,noreferrer");
    markReviewSubmitted();
    setReviewHoverRating(0);
    setIsReviewModalOpen(false);
  };
  // Auto-open review modal only when backend status allows it
  // (including install age from shop.createdAt). If merchant closes, snooze 3 days.
  useEffect(() => {
    if (!AUTO_REVIEW_MODAL_ENABLED) return;
    if (!shouldShowReviewPopup) return;
    if (isReviewSubmitted()) return;
    if (isReviewSnoozed()) return;
    resetReviewDraft();
    setIsReviewModalOpen(true);
  }, [shouldShowReviewPopup, isReviewSubmitted, isReviewSnoozed]);

  useEffect(() => {
    try {
      if (localStorage.getItem(reviewTopBannerDismissedSlot) === "1") {
        setShowTopReviewBanner(false);
      }
    } catch {}
  }, [reviewTopBannerDismissedSlot]);

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
      <Box className="dashboard-index-page">
      <style>{INDEX_PAGE_INLINE_CSS}</style>
      <BlockStack gap="400">
        <Card padding="0">
          <Box className="dashboard-app-status-card" padding="400">
            <InlineStack align="space-between" blockAlign="center" gap="400" wrap>
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h2" variant="headingMd" fontWeight="bold">
                    App status
                  </Text>
                  <Badge tone={embedStatusTone === "on" ? "success" : "warning"}>
                    {embedBadgeText}
                  </Badge>
                </InlineStack>
                <Text as="p" tone="subdued">
                  Your notification won't appear on storefront until App Embed is enabled.
                </Text>
              </BlockStack>
              <Button onClick={() => openThemeEditor(resolvedThemeId, "activate")}>
                Enable Snap Noti
              </Button>
            </InlineStack>
          </Box>
        </Card>

        {/* Review top banner */}
        {showTopReviewBanner && (
          <Banner
            title="Loving Fomoify Sales Popup?"
            tone="info"
            onDismiss={dismissTopReviewBanner}
            action={{
              content: "Write Review",
              onAction: () => window.open(WRITE_REVIEW_URL, "_blank", "noopener,noreferrer"),
            }}
          >
            <Text>
              We are love to hear your feedback. Your review helps us improve and support more merchants like you.
            </Text>
          </Banner>
        )}

        {/* Featured notification types */}
        <Card padding="0">
          <Box className="dashboard-feature-section" padding="400">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
                <Text as="h2" variant="headingMd" fontWeight="bold">
                  Build trust & boost conversions with notifications
                </Text>
                <Box className="dashboard-see-all-action">
                  <Button
                    variant="primary"
                    onClick={() => navigate(appUrl("/app/notification"))}
                  >
                    See all notifications types -&gt;
                  </Button>
                </Box>
              </InlineStack>
              <Box className="dashboard-feature-slider-window">
                <Box
                  className="dashboard-feature-slider-track"
                  style={{ "--notification-slide-index": notificationSlideIndex }}
                >
                  {FEATURED_NOTIFICATION_SLIDES.map((slide, slideIdx) => (
                    <Box
                      className="dashboard-feature-slide"
                      key={`notification-slide-${slideIdx}`}
                    >
                      <InlineGrid columns={{ xs: 1, md: 3 }} gap="500">
                        {slide.map((card) => (
                          <FeaturedNotificationCard
                            key={card.key}
                            title={card.title}
                            desc={card.desc}
                            badge={card.badge}
                            imageName={card.imageName}
                            previewType={card.previewType}
                            onCreate={() => goPopupCreate(card.path, card.key)}
                            loading={popupLoadingKey === `${card.key}-create`}
                          />
                        ))}
                      </InlineGrid>
                    </Box>
                  ))}
                </Box>
              </Box>
              {FEATURED_NOTIFICATION_SLIDES.length > 1 && (
                <InlineStack align="center" gap="100">
                  {FEATURED_NOTIFICATION_SLIDES.map((_, idx) => (
                    <Button
                      key={`notification-dot-${idx}`}
                      variant="plain"
                      accessibilityLabel={`Go to notification slide ${idx + 1}`}
                      pressed={idx === notificationSlideIndex}
                      onClick={() => setNotificationSlideIndex(idx)}
                    >
                      <Box
                        className={`dashboard-feature-dot${
                          idx === notificationSlideIndex ? " is-active" : ""
                        }`}
                      />
                    </Button>
                  ))}
                </InlineStack>
              )}
            </BlockStack>
          </Box>
        </Card>

        {/* Success help section */}
        {showSuccessHelpSection && (
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="500">
            <Card padding="0">
              <Box className="dashboard-support-panel">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd" fontWeight="bold">
                    Support
                  </Text>
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                    <Box borderWidth="025" borderRadius="300" borderColor="border" padding="400" background="bg-surface">
                      <BlockStack gap="300">
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          <Box className="dashboard-support-card-icon">
                            <Icon source={ChatIcon} />
                          </Box>
                          <Text as="h3" variant="headingSm" fontWeight="bold">
                            Live chat
                          </Text>
                        </InlineStack>
                        <Text as="p" tone="subdued">
                          Support, reply, and assist instantly in office hours.
                        </Text>
                        <InlineStack>
                          <Button
                            icon={ChatIcon}
                            onClick={() =>
                              window.open(whatsappSupportUrl, "_blank", "noopener,noreferrer")
                            }
                          >
                            Open chat
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Box>

                    <Box borderWidth="025" borderRadius="300" borderColor="border" padding="400" background="bg-surface">
                      <BlockStack gap="300">
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          <Box className="dashboard-support-card-icon">
                            <Icon source={ExternalIcon} />
                          </Box>
                          <Text as="h3" variant="headingSm" fontWeight="bold">
                            Knowledge base
                          </Text>
                        </InlineStack>
                        <Text as="p" tone="subdued">
                          Find a solution for your problem with our documents.
                        </Text>
                        <InlineStack>
                          <Button
                            icon={ExternalIcon}
                            onClick={() =>
                              window.open(SUPPORT_HELP_URL, "_blank", "noopener,noreferrer")
                            }
                          >
                            Open docs
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </InlineGrid>
                </BlockStack>
              </Box>
            </Card>

            <Card>
              <BlockStack gap="400" align="center" inlineAlign="center">
                <Box className="dashboard-review-heart" aria-hidden>
                  <Icon source={HeartIcon} />
                </Box>
                <BlockStack gap="100" inlineAlign="center">
                  <Text as="h2" variant="headingMd" fontWeight="bold">
                    Motivate our team
                  </Text>
                  <Text as="p" fontWeight="bold" tone="subdued">
                    for future app development
                  </Text>
                </BlockStack>
                <InlineStack gap="200" align="center" wrap>
                  <Button
                    variant="primary"
                    icon={StarIcon}
                    onClick={() => window.open(WRITE_REVIEW_URL, "_blank", "noopener,noreferrer")}
                  >
                    Write a review
                  </Button>
                  <Button icon={ChatIcon} onClick={openContactModal}>
                    Report an issue
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </InlineGrid>
        )}

        {/* Growth / promoted app */}
        <Card>
          <BlockStack gap="400">
            <Text as="h3" variant="headingLg" fontWeight="bold">
              Boost your store performance with our apps
            </Text>
            <Box className="dashboard-promoted-app">
              <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                {PROMOTED_APPS.map((app) => (
                  <PromotedAppCard key={app.href} app={app} />
                ))}
              </InlineGrid>
            </Box>
          </BlockStack>
        </Card>

        {/* Review modal */}
        <Modal
          open={isReviewModalOpen}
          onClose={closeReviewModal}
          title="Review this app"
          size="large"
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Banner tone="info">
                Development stores aren&apos;t eligible to review apps. This is for testing purposes only.
              </Banner>

              <InlineStack gap="300" blockAlign="start">
                <Box
                  borderWidth="025"
                  borderRadius="200"
                  borderColor="border"
                  padding="300"
                  background="bg-surface-secondary"
                  className="dashboard-modal-icon"
                >
                  <Icon source={AppsIcon} tone="base" />
                </Box>
                <BlockStack gap="200">
                  <Text >
                    {`How would you rate ${REVIEW_MODAL_APP_NAME}?`}
                  </Text>
                  <ReviewStars
                    rating={reviewRating}
                    hoverRating={reviewHoverRating}
                    onHover={setReviewHoverRating}
                    onLeave={() => setReviewHoverRating(0)}
                    onSelect={setReviewRating}
                  />
                </BlockStack>
              </InlineStack>

              <TextField
                label="Describe your experience (optional)"
                value={reviewMessage}
                onChange={setReviewMessage}
                multiline={6}
                placeholder="What should other merchants know about this app?"
                autoComplete="off"
              />

              <Box borderBlockStartWidth="025" borderColor="border" paddingBlockStart="400">
                <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
                  <Text tone="subdued" variant="bodySm">
                    If your review is published on the Shopify App Store, we&apos;ll include some details about your store.
                  </Text>
                  <InlineStack gap="200">
                    <Button onClick={openSupportFromReview}>Get support</Button>
                    <Button variant="primary" onClick={submitReviewModal} disabled={!reviewRating}>
                      Submit
                    </Button>
                  </InlineStack>
                </InlineStack>
              </Box>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Contact support modal */}
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
              <Text as="p" tone="subdued">
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
              {contactError && (
                <Text as="p" tone="critical">{contactError}</Text>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>

      </BlockStack>
      </Box>
    </Page>
  );
}
