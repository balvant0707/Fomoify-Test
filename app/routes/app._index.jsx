// app/routes/app._index.jsx
// Updated: 2026-03-30 â€” Backfill shop owner data on index page load for existing users
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
  Box,
  BlockStack,
  Text,
  Button,
  InlineStack,
  InlineGrid,
  Badge,
  Banner,
  Divider,
  Modal,
  TextField,
} from "@shopify/polaris";
import { APP_EMBED_HANDLE } from "../utils/themeEmbed.shared";
import { getEmbedPingStatus } from "../utils/embedPingStatus.server";
import { sendOwnerEmail } from "../utils/sendOwnerEmail.server";
import { maybeSendAnnouncementEmail } from "../utils/sendAnnouncementEmail.server";
import { getDashboardReviewPopupStatus } from "../utils/reviewPopupStatus.server";

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
const WRITE_REVIEW_URL =
  "https://apps.shopify.com/fomoify-sales-popup-proof#modal-show=WriteReviewModal";
const REVIEW_MODAL_APP_NAME = "Fomoify Sales Popup & Proof";
const AUTO_REVIEW_MODAL_ENABLED = true;
const REVIEW_SNOOZE_UNTIL_KEY = "__fomo_review_snooze_until__";
const REVIEW_SUBMITTED_KEY = "__fomo_review_submitted__";
const REVIEW_TOP_BANNER_DISMISSED_KEY = "__fomo_review_top_banner_dismissed__";
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

const POPUP_TYPE_CARD_STYLES = `
.popup-type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.popup-type-card {
  min-height: 188px;
  border: 1px solid #dfe3e8;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
.popup-type-card-body {
  min-height: 188px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  gap: 16px;
  align-items: center;
}
.popup-type-copy {
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.popup-type-title {
  color: #3d3d3d;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 800;
}
.popup-type-description {
  margin-top: 14px;
  color: #5f6368;
  font-size: 18px;
  line-height: 1.35;
  font-weight: 600;
}
.popup-type-actions {
  margin-top: auto;
  padding-top: 18px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.popup-type-actions .Polaris-Button--variantPrimary {
  min-height: 36px;
  min-width: 78px;
  border-radius: 10px;
  border: 1px solid #111111;
  background: linear-gradient(#3e3e3e, #202020);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.28);
}
.popup-type-actions .Polaris-Button--variantPrimary .Polaris-Text--root {
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
}
.popup-type-image {
  min-height: 112px;
  display: grid;
  place-items: center;
}
.popup-type-image img {
  max-width: 108px;
  max-height: 108px;
  object-fit: contain;
  opacity: 0.9;
}
@media (max-width: 1100px) {
  .popup-type-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px) {
  .popup-type-grid {
    grid-template-columns: 1fr;
  }
  .popup-type-card-body {
    grid-template-columns: minmax(0, 1fr) 96px;
  }
  .popup-type-description {
    font-size: 16px;
  }
}
`;


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

function PopupSliderCard({ title, desc, imageName, onCreate, onManage, loading }) {
  const imageSrc = `/images/${encodeURIComponent(imageName)}`;
  return (
    <Box className="popup-type-card">
      <Box padding="400" className="popup-type-card-body">
        <Box className="popup-type-copy">
          <BlockStack gap="0">
            <Text as="h3" className="popup-type-title">
              {title}
            </Text>
            <Text as="p" className="popup-type-description">
              {desc}
            </Text>
          </BlockStack>
          <Box className="popup-type-actions">
            <Button variant="primary" onClick={onCreate} loading={loading} disabled={loading}>
              {loading ? "Opening..." : "Create"}
            </Button>
            <Button onClick={onManage} disabled={loading}>
              Manage
            </Button>
          </Box>
        </Box>
        <Box className="popup-type-image" aria-hidden>
          <img
            src={imageSrc}
            alt=""
            width={108}
            height={108}
          />
        </Box>
      </Box>
    </Box>
  );
}

function PopupCardSlider({ cards, onCreateItem, onManageItem, popupLoadingKey }) {
  return (
    <Box className="popup-type-grid">
      {cards.map((card) => (
        <PopupSliderCard
          key={card.key}
          title={card.title}
          desc={card.desc}
          imageName={card.imageName}
          onCreate={() => onCreateItem(card.path, card.key)}
          onManage={() => onManageItem(card.key)}
          loading={
            popupLoadingKey === `${card.key}-create` ||
            popupLoadingKey === `${card.key}-manage`
          }
        />
      ))}
    </Box>
  );
}

function ReviewStars({ rating, hoverRating, onHover, onLeave, onSelect }) {
  const activeValue = hoverRating || rating;
  return (
    <InlineStack gap="100" aria-label="Rate this app">
      {[1, 2, 3, 4, 5].map((value) => {
        const active = value <= activeValue;
        return (
          <button
            key={value}
            type="button"
            aria-label={`${value} star${value > 1 ? "s" : ""}`}
            onMouseEnter={() => onHover(value)}
            onMouseLeave={onLeave}
            onFocus={() => onHover(value)}
            onBlur={onLeave}
            onClick={() => onSelect(value)}
            style={{ border: 0, background: "transparent", color: active ? "#ffb800" : "#c9cccf", fontSize: 28, lineHeight: 1, cursor: "pointer", padding: 0 }}
          >
            â˜…
          </button>
        );
      })}
    </InlineStack>
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

  // Fire announcement email in background â€” does not block page load
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
  const dashboardReviewPopupStatus = await getDashboardReviewPopupStatus(shop);

  return defer({
    slug,
    shopDomain,
    apiKey,
    dashboardReviewPopupStatus,
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
    dashboardReviewPopupStatus,
    embedPingStatus,
    embedContext,
  } = useLoaderData();
  const contactFetcher = useFetcher();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const location = useLocation();
  const [resolvedThemeId, setResolvedThemeId] = useState(null);
  const [, setIsEmbedContextLoading] = useState(true);
  const [embedContextState, setEmbedContextState] = useState({
    appEmbedEnabled: false,
    appEmbedFound: false,
    appEmbedChecked: false,
  });
  const [, setIsEmbedPingLoading] = useState(true);
  const [embedPing, setEmbedPing] = useState({
    isOn: false,
    isFresh: false,
    lastPingAt: null,
    checkedAt: null,
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
  const shouldShowReviewPopup = Boolean(
    dashboardReviewPopupStatus?.shouldShowReviewPopup
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
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && revalidator.state === "idle") {
        revalidator.revalidate();
      }
    }, 10000);
    return () => clearInterval(id);
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
    <Page title="Dashboard" subtitle="Manage social proof popups and notifications for your store">
      <BlockStack gap="400">
        <style>{POPUP_TYPE_CARD_STYLES}</style>

        {/* Top Review Banner */}
        {showTopReviewBanner ? (
          <Banner
            title="Loving Fomoify Sales Popup?"
            tone="success"
            fontWeight="semibold"
            action={{
              content: "Write a Review",
              onAction: () => window.open(WRITE_REVIEW_URL, "_blank", "noopener,noreferrer"),
            }}
            onDismiss={dismissTopReviewBanner}
          >
            <Text variant="bodyMd">
              Your review helps us improve and support more merchants like you.
            </Text>
          </Banner>
        ) : null}

        {/* App Embed Block */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd" fontWeight="semibold">
                  App Embed Block
                </Text>
                <Text variant="bodyMd" tone="subdued">
                  Required for popups to appear on your storefront.
                </Text>
              </BlockStack>
              <Badge tone={embedBadgeTone} size="large">{embedBadgeText}</Badge>
            </InlineStack>
            {!isEmbedActive ? (
              <Banner tone="warning">
                <BlockStack gap="300">
                  <Text variant="bodyMd">
                    The app embed block is not enabled in your theme. Popups will not be visible to customers until you activate it.
                  </Text>
                  <Button
                    variant="primary"
                    size="slim"
                    onClick={() => openThemeEditor(resolvedThemeId, "activate")}
                  >
                    Enable in Theme Editor
                  </Button>
                </BlockStack>
              </Banner>
            ) : (
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="success">Active</Badge>
                <Button size="slim" onClick={() => openThemeEditor(resolvedThemeId, "open")}>
                  Manage in Theme Editor
                </Button>
              </InlineStack>
            )}
          </BlockStack>
        </Card>

        {/* Popup Types */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd" fontWeight="semibold">
                Popup Types
              </Text>
              <Text variant="bodyMd" tone="subdued">
                Choose a popup type to create and configure for your store.
              </Text>
            </BlockStack>
            <PopupCardSlider
              cards={POPUP_CARD_DATA}
              onCreateItem={goPopupCreate}
              onManageItem={goPopupManage}
              popupLoadingKey={popupLoadingKey}
            />
          </BlockStack>
        </Card>

        {/* Support + Review Row */}
        <InlineGrid columns={{ xs: 1, sm: "3fr 2fr" }} gap="400">
          {/* Support */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd" fontWeight="semibold">
                Get Support
              </Text>
              <InlineGrid columns={2} gap="300">
                <Box background="bg-surface-secondary" borderRadius="200" padding="400">
                  <BlockStack gap="200" inlineAlign="center">
                    <div
                      aria-hidden
                      style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                        <path d="M7.4 17.5H4V14a7 7 0 0 1 7-7h2a7 7 0 1 1 0 14h-2.6L7.4 23v-5.5z" />
                        <path d="M9 12h6M9 9h3" />
                      </svg>
                    </div>
                    <Text variant="headingXs" fontWeight="semibold" alignment="center">Support Ticket</Text>
                    <Text variant="bodyMd" tone="subdued" alignment="center">Reply and assist in office hours.</Text>
                    <Button size="slim" onClick={() => window.open(SUPPORT_HELP_URL, "_blank", "noopener,noreferrer")}>Open Chat</Button>
                  </BlockStack>
                </Box>
                <Box background="bg-surface-secondary" borderRadius="200" padding="400">
                  <BlockStack gap="200" inlineAlign="center">
                    <div
                      aria-hidden
                      style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                        <path d="M4 6.8A2.8 2.8 0 0 1 6.8 4H19v14H6.8A2.8 2.8 0 0 0 4 20.8V6.8z" />
                        <path d="M6.8 4A2.8 2.8 0 0 0 4 6.8v14" />
                        <path d="M9 8h7M9 11h7M9 14h5" />
                      </svg>
                    </div>
                    <Text variant="headingXs" fontWeight="semibold" alignment="center">Knowledge Base</Text>
                    <Text variant="bodyMd" tone="subdued" alignment="center">Browse docs &amp; guides.</Text>
                    <Button size="slim" onClick={() => window.open(SUPPORT_HELP_URL, "_blank", "noopener,noreferrer")}>Browse Docs</Button>
                  </BlockStack>
                </Box>
              </InlineGrid>
            </BlockStack>
          </Card>

          {/* Review */}
          <Card>
            <BlockStack gap="300" inlineAlign="center">
              <div
                aria-hidden
                style={{ width: 60, height: 60, borderRadius: 16, background: "linear-gradient(135deg, #ff9eb0 0%, #f14e72 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                  <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 11c0 5.6-7 10-7 10z" />
                </svg>
              </div>
              <Text variant="headingSm" fontWeight="semibold" alignment="center">
                Motivate our team for future app development
              </Text>
              <BlockStack gap="200" inlineAlign="stretch">
                <Button variant="primary" onClick={() => window.open(WRITE_REVIEW_URL, "_blank", "noopener,noreferrer")}>
                  Write a Review
                </Button>
                <Button onClick={openContactModal}>Report an Issue</Button>
              </BlockStack>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Help & Setup Call */}
        {showSuccessHelpSection ? (
          <Card>
            <BlockStack gap="400">
              <InlineStack blockAlign="center" gap="200">
                <svg viewBox="0 0 24 24" fill="none" stroke="#22a3e8" strokeWidth="2" width="20" height="20">
                  <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 11c0 5.6-7 10-7 10z" />
                </svg>
                <Text as="h2" variant="headingMd" fontWeight="semibold">
                  We're Here to Help You Succeed
                </Text>
              </InlineStack>
              <Divider />
              <InlineGrid columns={{ xs: 1, md: "3fr 2fr" }} gap="400">
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#22a3e8" strokeWidth="2" width="18" height="18">
                      <rect x="3" y="4" width="18" height="17" rx="3" />
                      <path d="M8 2v4M16 2v4M3 10h18" />
                    </svg>
                    <Text variant="headingXs" fontWeight="semibold">Book a Free 30-Min Setup Call</Text>
                  </InlineStack>
                  <Text variant="bodyMd" tone="subdued">
                    Get personalized guidance to accelerate your growth.
                  </Text>
                  <InlineStack gap="200">
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
                    <Text variant="bodySm" tone="subdued">Free · 30 mins · No commitment</Text>
                  </InlineStack>
                </BlockStack>
                <Box background="bg-surface-secondary" borderRadius="200" padding="400">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#22a3e8" strokeWidth="2" width="18" height="18">
                        <path d="M4 5h16v10H8l-4 4V5z" />
                        <path d="M8 9h8M8 12h5" />
                      </svg>
                      <Text variant="headingXs" fontWeight="semibold">Need Quick Help?</Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">
                      Reach out anytime for support, feedback, or to share your progress.
                    </Text>
                    <InlineStack gap="200">
                      <Button size="slim" onClick={openContactModal}>WhatsApp</Button>
                      <Button size="slim" onClick={() => window.open(SUPPORT_HELP_URL, "_blank", "noopener,noreferrer")}>Knowledge base</Button>
                    </InlineStack>
                  </BlockStack>
                </Box>
              </InlineGrid>
            </BlockStack>
          </Card>
        ) : null}

        {/* Boost Store / App Promo */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd" fontWeight="semibold">
              Boost Your Store Performance
            </Text>
            <Divider />
            <InlineStack gap="300" blockAlign="center" wrap={false}>
              <img
                src="/images/cartlift.png"
                alt="CartLift"
                width={44}
                height={44}
                style={{ borderRadius: 10, border: "1px solid #e5e7eb", flexShrink: 0 }}
              />
              <BlockStack gap="050">
                <InlineStack gap="200" blockAlign="center">
                  <Text variant="headingXs" fontWeight="semibold">
                    <a
                      href={PROMOTED_UPSELL_APP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      CartLift: Cart Drawer &amp; Upsell
                    </a>
                  </Text>
                  <Badge tone="info">Upsell</Badge>
                </InlineStack>
                <Text variant="bodyMd" tone="subdued">
                  Grow average order value with cart drawer upsells and smart cart offers.
                </Text>
              </BlockStack>
              <Box flexShrink="0">
                <Button
                  variant="primary"
                  size="slim"
                  onClick={() => window.open(PROMOTED_UPSELL_APP_URL, "_blank", "noopener,noreferrer")}
                >
                  Add App
                </Button>
              </Box>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Review Modal */}
        <Modal
          open={isReviewModalOpen}
          onClose={closeReviewModal}
          title="Review this app"
          size="large"
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Banner tone="info">
                <Text variant="bodySm">
                  Development stores aren't eligible to review apps. This is for testing purposes only.
                </Text>
              </Banner>
              <InlineStack gap="300" blockAlign="start">
                <Box background="bg-surface-secondary" borderRadius="200" padding="300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="24" height="24">
                    <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
                    <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
                    <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
                    <path d="M17 13.5v7M13.5 17h7" strokeLinecap="round" />
                  </svg>
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
              <BlockStack gap="100">
                <Text variant="bodySm" fontWeight="semibold">
                  <label htmlFor="review-app-message">Describe your experience (optional)</label>
                </Text>
                <textarea
                  id="review-app-message"
                  placeholder="What should other merchants know about this app?"
                  value={reviewMessage}
                  onChange={(e) => setReviewMessage(e.target.value)}
                  style={{ width: "100%", minHeight: 140, resize: "vertical", borderRadius: 8, border: "1px solid #c9cccf", padding: 12, fontFamily: "inherit", fontSize: 14, color: "#202223", boxSizing: "border-box" }}
                />
              </BlockStack>
              <Box borderColor="border" borderBlockStartWidth="025" paddingBlockStart="300">
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <Text variant="bodySm" tone="subdued">
                    If published, we'll include some details about your store.
                  </Text>
                  <InlineStack gap="200">
                    <Button onClick={openSupportFromReview}>Get support</Button>
                    <Button variant="primary" onClick={submitReviewModal} disabled={!reviewRating}>Submit</Button>
                  </InlineStack>
                </InlineStack>
              </Box>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Contact Modal */}
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
              <Text variant="bodySm" tone="subdued">
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
                <Banner tone="critical">
                  <Text variant="bodySm">{contactError}</Text>
                </Banner>
              ) : null}
            </BlockStack>
          </Modal.Section>
        </Modal>

      </BlockStack>
    </Page>
  );
}

