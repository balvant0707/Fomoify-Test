// app/routes/app._index.jsx
// Updated: 2026-03-30 — Backfill shop owner data on index page load for existing users
import { defer, json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  useLocation,
  useNavigate,
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
  Badge,
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
const WRITE_REVIEW_URL =
  "https://apps.shopify.com/fomoify-sales-popup-proof#modal-show=WriteReviewModal";
const REVIEW_MODAL_APP_NAME = "Fomoify Sales Popup & Proof";
const POPUPS_PER_SLIDE = 2;
const POPUP_AUTOSLIDE_MS = 3500;
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

function splitIntoSlides(items, perSlide) {
  const out = [];
  for (let idx = 0; idx < items.length; idx += perSlide) {
    out.push(items.slice(idx, idx + perSlide));
  }
  return out;
}

const POPUP_SLIDES = splitIntoSlides(POPUP_CARD_DATA, POPUPS_PER_SLIDE);

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
    <div className="home-popup-card">
      <div className="home-popup-card-content">
        <div className="home-popup-card-title">{title}</div>
        <div className="home-popup-card-desc">{desc}</div>
        <div className="home-popup-card-actions">
          <Button primary onClick={onCreate} loading={loading} disabled={loading}>
            {loading ? "Opening..." : "Create"}
          </Button>
          <Button onClick={onManage} disabled={loading}>
            Manage
          </Button>
        </div>
      </div>
      <div className="home-popup-card-image" aria-hidden>
        <img
          src={imageSrc}
          alt={`${title} preview`}
          width={96}
          height={96}
          style={{ borderRadius: 8, objectFit: "contain" }}
        />
      </div>
    </div>
  );
}

function ReviewStars({ rating, hoverRating, onHover, onLeave, onSelect }) {
  const activeValue = hoverRating || rating;

  return (
    <div className="review-app-stars" aria-label="Rate this app">
      {[1, 2, 3, 4, 5].map((value) => {
        const active = value <= activeValue;
        return (
          <button
            key={value}
            type="button"
            className={`review-app-star${active ? " is-active" : ""}`}
            aria-label={`${value} star${value > 1 ? "s" : ""}`}
            onMouseEnter={() => onHover(value)}
            onMouseLeave={onLeave}
            onFocus={() => onHover(value)}
            onBlur={onLeave}
            onClick={() => onSelect(value)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

const INDEX_SUPPORT_STYLES = `
.home-popup-slider {
  display: grid;
  gap: 14px;
}
.home-popup-slider-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.home-popup-slider-nav {
  display: inline-flex;
  gap: 8px;
}
.home-popup-nav-btn {
  border: 1px solid #d2d6dc;
  background: #ffffff;
  color: #111827;
  border-radius: 10px;
  padding: 7px 12px;
  font-size: 13px;
  cursor: pointer;
}
.home-popup-nav-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.home-popup-slider-window {
  overflow: hidden;
  border-radius: 14px;
}
.home-popup-slider-track {
  display: flex;
  transition: transform 260ms ease;
}
.home-popup-slide {
  flex: 0 0 100%;
}
.home-popup-slide-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.home-popup-card {
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 20px rgba(17, 24, 39, 0.05);
}
.home-popup-card-content {
  display: grid;
  gap: 8px;
}
.home-popup-card-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}
.home-popup-card-desc {
  font-size: 13px;
  color: #6b7280;
}
.home-popup-card-actions {
  display: flex;
  gap: 8px;
}
.home-popup-card-image {
  flex: 0 0 auto;
}
.home-popup-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
}
.home-popup-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  border: 0;
  background: #d1d5db;
  cursor: pointer;
}
.home-popup-dot.is-active {
  width: 22px;
  background: #2563eb;
}
.home-support-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 16px;
}
.home-support-panel {
    border: 1px solid #e6e6e8;
    border-radius: 16px;
    padding: 18px;
    background-size: 36px 36px, 36px 36px, auto;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
    border-color: #c8d7f3;
        background-image: linear-gradient(0deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(150deg, #bca9e4 0%, #d2c4f1 100%);
}
.home-support-items {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 10px;
}
.home-support-item {
  border: 1px solid #d8dadd;
  border-radius: 14px;
  padding: 14px;
  text-align: left;
  cursor: pointer;
  transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
  position: relative;
  overflow: hidden;
  background-image:
    linear-gradient(0deg, rgba(255,255,255,0.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px),
    linear-gradient(150deg, #f1f5ff 0%, #e5edff 100%);
  background-size: 24px 24px, 24px 24px, auto;
}
.home-support-item.chat {
  border-color: #c8d7f3;
      background-image: linear-gradient(0deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(150deg, #bca9e4 0%, #d2c4f1 100%);
}
.home-support-item.knowledge {
  border-color: #c8d7f3;
      background-image: linear-gradient(0deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(150deg, #bca9e4 0%, #d2c4f1 100%);
}
.home-support-item:hover {
  border-color: #a982fd;
  box-shadow: 0 0 0 2px rgba(47, 133, 90, 0.08);
  transform: translateY(-1px);
}

.home-support-item-row {
  display: grid;
  align-items: center;
  gap: 12px;
  text-align: center;
}
.home-support-item-icon {
  width: 60px;
  height: 60px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  flex: 0 0 60px;
  color: #ffffff;
  box-shadow: 0 8px 14px rgba(0, 0, 0, 0.12);
  margin: 0 auto;
}
.home-support-item.chat .home-support-item-icon {
  background: radial-gradient(circle at 35% 35%, #76a7ff 12%, #2f6de7 60%, #1e4ba8 100%);
}
.home-support-item.knowledge .home-support-item-icon {
  background: radial-gradient(circle at 35% 35%, #76a7ff 12%, #2f6de7 60%, #1e4ba8 100%);
}
.home-support-item-icon svg {
  width: 24px;
  height: 24px;
}
.home-support-item-body {
    min-width: 0;
    display: grid;
    gap: 15px;
}
.home-support-item-link {
  color: #1d4ed8;
  font-weight: 700;
  margin-bottom: 2px;
}
.home-support-item.knowledge .home-support-item-link {
 
}
.home-review-panel {
  border: 1px solid #aec69c;
  border-radius: 20px;
  padding: 20px;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-color: #c8d7f3;
  border-color: #c8d7f3;
  background-image: linear-gradient(0deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(150deg, #bca9e4 0%, #d2c4f1 100%);
  background-size: 36px 36px, 36px 36px, auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.home-review-balloon {
  width: 60px;
  height: 60px;
  border-radius: 24px;
  margin: 2px auto 12px;
  background: radial-gradient(circle at 35% 32%, #ff9eb0 8%, #f14e72 56%, #cf2f55 100%);
  display: grid;
  place-items: center;
  color: #ffffff;
  box-shadow: 0 12px 22px rgba(181, 44, 83, 0.34);
}
.home-review-balloon svg {
  width: 31px;
  height: 31px;
}
.home-review-copy {
  max-width: 290px;
  margin: 0 auto;
  color: #1f2937;
  font-size: 16px;
  line-height: 1.35;
}
.home-review-actions {
  display: flex;
  gap: 10px;
}
.home-review-btn {
  flex: 1;
  border-radius: 14px;
  border: 1px solid transparent;
  font-size: 12px;
  line-height: 1.2;
  padding: 12px 14px;
  cursor: pointer;
}
.home-review-btn.primary {
  background: #111111;
  color: #ffffff;
  border-color: #111111;
}
.home-review-btn.secondary {
  background: #ffffff;
  color: #111827;
  border-color: #d8dadd;
}
.review-app-modal {
  display: grid;
  gap: 18px;
}
.review-app-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #e9f2ff;
  color: #2f6fad;
  font-size: 14px;
  font-weight: 600;
}
.review-app-banner svg {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}
.review-app-rating-card {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.review-app-rating-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 1px solid #d8dadd;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8c9196;
  background: #f6f6f7;
}
.review-app-rating-icon svg {
  width: 24px;
  height: 24px;
}
.review-app-rating-title {
  font-size: 18px;
  font-weight: 700;
  color: #202223;
  margin-bottom: 10px;
}
.review-app-stars {
  display: inline-flex;
  gap: 8px;
}
.review-app-star {
  border: 0;
  background: transparent;
  color: #c9cccf;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}
.review-app-star.is-active {
  color: #ffb800;
}
.review-app-field-label {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: #202223;
  margin-bottom: 10px;
}
.review-app-textarea {
  width: 100%;
  min-height: 160px;
  resize: vertical;
  border-radius: 12px;
  border: 1px solid #c9cccf;
  padding: 16px;
  font: inherit;
  color: #202223;
  background: #ffffff;
}
.review-app-textarea:focus {
  outline: none;
  border-color: #5c6ac4;
  box-shadow: 0 0 0 1px #5c6ac4;
}
.review-app-footer {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  border-top: 1px solid #e1e3e5;
  padding-top: 16px;
}
.review-app-footer-copy {
  font-size: 13px;
  color: #6d7175;
}
.review-app-footer-copy strong {
  color: #202223;
}
.review-app-footer-actions {
  display: inline-flex;
  gap: 12px;
}
.review-app-action {
  border-radius: 12px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid #c9cccf;
}
.review-app-action.secondary {
  background: #ffffff;
  color: #202223;
}
.review-app-action.primary {
  background: #111827;
  color: #ffffff;
  border-color: #111827;
}
.review-app-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
@media (max-width: 980px) {
  .home-support-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 740px) {
  .home-popup-slide-grid {
    grid-template-columns: 1fr;
  }
  .home-popup-card {
    align-items: flex-start;
  }
  .home-popup-card-image {
    display: none;
  }
  .home-popup-slider-head {
    flex-direction: column;
    align-items: flex-start;
  }
  .home-support-items {
    grid-template-columns: 1fr;
  }
  .home-review-panel {
    min-height: 220px;
  }
  .home-review-copy {
    font-size: 16px;
  }
  .home-review-btn {
    font-size: 15px;
  }
  .review-app-rating-card {
    grid-template-columns: 1fr;
  }
  .review-app-footer {
    flex-direction: column;
    align-items: stretch;
  }
  .review-app-footer-actions {
    width: 100%;
  }
  .review-app-action {
    flex: 1 1 0;
  }
}
@media (max-width: 420px) {
  .home-review-actions {
    flex-direction: column;
  }
}
`;

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
  const reviewPopupStatusFetcher = useFetcher();
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
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewPopupCount, setReviewPopupCount] = useState(
    Number(dashboardReviewPopupStatus?.popupOrderCount || 0)
  );
  const [lastShownReviewPopupCount, setLastShownReviewPopupCount] = useState(0);
  const [isReviewPopupDelayElapsed, setIsReviewPopupDelayElapsed] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState(CONTACT_FORM_INITIAL);
  const [contactError, setContactError] = useState("");
  const [popupLoadingKey, setPopupLoadingKey] = useState(null);
  const [popupSlideIndex, setPopupSlideIndex] = useState(0);
  const [isPopupSliderPaused, setIsPopupSliderPaused] = useState(false);
  const search = location.search || "";
  const appUrl = useCallback((path) => `${path}${search}`, [search]);
  const hasThemeEmbedCheck = embedContextState.appEmbedChecked === true;
  const hasFreshPingSignal =
    embedPing?.isFresh === true || embedPing?.isOn === true;
  // Theme check is authoritative when it completed; fall back to ping only if check failed
  const isEmbedActive = hasThemeEmbedCheck
    ? Boolean(embedContextState.appEmbedEnabled)
    : hasFreshPingSignal;
  const embedBadgeTone = isEmbedActive ? "success" : "critical";
  const embedBadgeText = `App embed: ${isEmbedActive ? "ON" : "OFF"}`;

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

  const maxPopupSlideIndex = Math.max(POPUP_SLIDES.length - 1, 0);
  const canPopupSlidePrev = popupSlideIndex > 0;
  const canPopupSlideNext = popupSlideIndex < maxPopupSlideIndex;

  useEffect(() => {
    if (POPUP_SLIDES.length <= 1 || isPopupSliderPaused) return undefined;
    const timer = setInterval(() => {
      setPopupSlideIndex((prev) =>
        prev >= maxPopupSlideIndex ? 0 : prev + 1
      );
    }, POPUP_AUTOSLIDE_MS);
    return () => clearInterval(timer);
  }, [isPopupSliderPaused, maxPopupSlideIndex]);

  const prevPopupSlide = useCallback(() => {
    setPopupSlideIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const nextPopupSlide = useCallback(() => {
    setPopupSlideIndex((prev) => Math.min(prev + 1, maxPopupSlideIndex));
  }, [maxPopupSlideIndex]);

  const updateContactField = (field) => (value) => {
    setContactForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetReviewDraft = () => {
    setReviewRating(0);
    setReviewHoverRating(0);
    setReviewMessage("");
  };

  const closeReviewModal = () => {
    setReviewHoverRating(0);
    setIsReviewModalOpen(false);
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
    closeReviewModal();
  };

  // Step 1: 20-second delay before any review popup logic runs
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReviewPopupDelayElapsed(true);
    }, 20000);
    return () => clearTimeout(timer);
  }, []);

  // Step 2: Start polling /app/review-popup-status every 30s after delay
  useEffect(() => {
    if (!isReviewPopupDelayElapsed) return;
    const loadStatus = () =>
      reviewPopupStatusFetcher.load("/app/review-popup-status");
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, [isReviewPopupDelayElapsed]);

  // Step 3: Keep reviewPopupCount updated from poll results (only ever goes up)
  useEffect(() => {
    const nextCount = Number(
      reviewPopupStatusFetcher.data?.popupOrderCount || 0
    );
    if (!nextCount) return;
    setReviewPopupCount((prev) => Math.max(prev, nextCount));
  }, [reviewPopupStatusFetcher.data]);

  // Step 4: Open modal when there is at least 1 order and the count is new
  useEffect(() => {
    if (!isReviewPopupDelayElapsed) return;
    if (reviewPopupCount < 1) return;
    if (reviewPopupCount <= lastShownReviewPopupCount) return;
    resetReviewDraft();
    setIsReviewModalOpen(true);
    setLastShownReviewPopupCount(reviewPopupCount);
  }, [isReviewPopupDelayElapsed, reviewPopupCount, lastShownReviewPopupCount]);

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
        <style>{INDEX_SUPPORT_STYLES}</style>
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingMd">
                App embed status
              </Text>
              <Badge tone={embedBadgeTone}>
                {embedBadgeText}
              </Badge>
            </InlineStack>
            
            <InlineStack gap="300" align="start">
              <Button
                variant="primary"
                onClick={() => openThemeEditor(resolvedThemeId, "activate")}
              >
                Open App Embeds
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <div
            className="home-popup-slider"
            onMouseEnter={() => setIsPopupSliderPaused(true)}
            onMouseLeave={() => setIsPopupSliderPaused(false)}
            onFocusCapture={() => setIsPopupSliderPaused(true)}
            onBlurCapture={() => setIsPopupSliderPaused(false)}
            onTouchStart={() => setIsPopupSliderPaused(true)}
            onTouchEnd={() => setIsPopupSliderPaused(false)}
          >
            {/* <div className="home-popup-slider-head">
              <Text as="h3" variant="headingMd">
                All Popups
              </Text>
              <div className="home-popup-slider-nav">
                <button
                  type="button"
                  className="home-popup-nav-btn"
                  onClick={prevPopupSlide}
                  disabled={!canPopupSlidePrev}
                  aria-label="Previous popup slide"
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="home-popup-nav-btn"
                  onClick={nextPopupSlide}
                  disabled={!canPopupSlideNext}
                  aria-label="Next popup slide"
                >
                  Next
                </button>
              </div>
            </div> */}

            <div className="home-popup-slider-window">
              <div
                className="home-popup-slider-track"
                style={{ transform: `translateX(-${popupSlideIndex * 100}%)` }}
              >
                {POPUP_SLIDES.map((slide, slideIdx) => (
                  <div className="home-popup-slide" key={`slide-${slideIdx}`}>
                    <div className="home-popup-slide-grid">
                      {slide.map((card) => (
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
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {POPUP_SLIDES.length > 1 ? (
              <div className="home-popup-dots" aria-label="Popup slides">
                {POPUP_SLIDES.map((_, idx) => (
                  <button
                    key={`dot-${idx}`}
                    type="button"
                    className={`home-popup-dot${idx === popupSlideIndex ? " is-active" : ""}`}
                    aria-label={`Go to slide ${idx + 1}`}
                    onClick={() => setPopupSlideIndex(idx)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </Card>

        <div className="home-support-grid">
          <div className="home-support-panel">
            <Text as="h3" variant="headingMd">
              Support
            </Text>
            <div className="home-support-items">
              <button
                type="button"
                className="home-support-item chat"
                onClick={() => window.open("https://fomoifysalespopupproof.tawk.help/category/features", "_blank", "noopener,noreferrer")}
              >
                <div className="home-support-item-row">
                  <div className="home-support-item-icon" aria-hidden>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M7.4 17.5H4V14a7 7 0 0 1 7-7h2a7 7 0 1 1 0 14h-2.6L7.4 23v-5.5z" />
                      <path d="M9 12h6M9 9h3" />
                    </svg>
                  </div>
                  <div className="home-support-item-body">
                    <div className="home-support-item-link">Support Ticket</div>
                    <Text as="p">
                      Support, reply, and assist instantly in office hours.
                    </Text>
                  </div>
                </div>
              </button>
              <button
                type="button"
                className="home-support-item knowledge"
                onClick={() => window.open("https://fomoifysalespopupproof.tawk.help/category/features", "_blank")}
              >
                <div className="home-support-item-row">
                  <div className="home-support-item-icon" aria-hidden>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 6.8A2.8 2.8 0 0 1 6.8 4H19v14H6.8A2.8 2.8 0 0 0 4 20.8V6.8z" />
                      <path d="M6.8 4A2.8 2.8 0 0 0 4 6.8v14" />
                      <path d="M9 8h7M9 11h7M9 14h5" />
                    </svg>
                  </div>
                  <div className="home-support-item-body">
                    <div className="home-support-item-link">Knowledge base</div>
                    <Text as="p">
                      Find a solution for your problem with our documents.
                    </Text>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="home-review-panel">
            <div>
              <div className="home-review-balloon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 11c0 5.6-7 10-7 10z" />
                </svg>
              </div>
              <Text
                as="p"
                alignment="center"
                fontWeight="semibold"
                className="home-review-copy"
              >
                Motivate our team for future app development
              </Text>
            </div>
            <div className="home-review-actions">
              <button
                type="button"
                className="home-review-btn primary"
                onClick={() => window.open(WRITE_REVIEW_URL, "_blank", "noopener,noreferrer")}
              >
                Write a review
              </button>
              <button
                type="button"
                className="home-review-btn secondary"
                onClick={openContactModal}
              >
                Report an issue
              </button>
            </div>
          </div>
        </div>

        <Modal
          open={isReviewModalOpen}
          onClose={closeReviewModal}
          title="Review this app"
          size="large"
        >
          <Modal.Section>
            <div className="review-app-modal">
              <div className="review-app-banner">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden>
                  <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M10 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="10" cy="5.6" r="1" fill="currentColor" />
                </svg>
                <span>
                  Development stores aren't eligible to review apps. This is for testing purposes only.
                </span>
              </div>

              <div className="review-app-rating-card">
                <div className="review-app-rating-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
                    <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
                    <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
                    <path d="M17 13.5v7M13.5 17h7" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="review-app-rating-title">
                    {`How would you rate ${REVIEW_MODAL_APP_NAME}?`}
                  </div>
                  <ReviewStars
                    rating={reviewRating}
                    hoverRating={reviewHoverRating}
                    onHover={setReviewHoverRating}
                    onLeave={() => setReviewHoverRating(0)}
                    onSelect={setReviewRating}
                  />
                </div>
              </div>

              <div>
                <label className="review-app-field-label" htmlFor="review-app-message">
                  Describe your experience (optional)
                </label>
                <textarea
                  id="review-app-message"
                  className="review-app-textarea"
                  placeholder="What should other merchants know about this app?"
                  value={reviewMessage}
                  onChange={(event) => setReviewMessage(event.target.value)}
                />
              </div>

              <div className="review-app-footer">
                <div className="review-app-footer-copy">
                  If your review is published on the Shopify App Store, we'll include some details about your store.
                </div>
                <div className="review-app-footer-actions">
                  <button
                    type="button"
                    className="review-app-action secondary"
                    onClick={openSupportFromReview}
                  >
                    Get support
                  </button>
                  <button
                    type="button"
                    className="review-app-action primary"
                    onClick={submitReviewModal}
                    disabled={!reviewRating}
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </Modal.Section>
        </Modal>

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
              {contactError ? (
                <Text as="p" tone="critical">
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
