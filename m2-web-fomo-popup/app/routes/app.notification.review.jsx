// app/routes/app.notification.review.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  Page,
  Card,
  Button,
  TextField,
  Select,
  ChoiceList,
  Box,
  BlockStack,
  InlineStack,
  Text,
  Frame,
  Modal,
  IndexTable,
  Thumbnail,
  Badge,
  Checkbox,
  RadioButton,
  Toast,
  Loading,
} from "@shopify/polaris";
import { useNavigate, useFetcher, useLocation, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { saveReviewPopup } from "../models/popup-config.server";
import prisma from "../db.server";

const JUDGE_ME_INTEGRATION_KEY = "integration_judge_me";
const isTransientDbError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const msg = String(error?.message || "").toLowerCase();
  const causeMsg = String(error?.cause?.message || "").toLowerCase();
  const combined = `${msg} ${causeMsg}`;

  if (code === "P1001" || code === "P1008" || code === "P1017") return true;
  return (
    combined.includes("too many database connections") ||
    combined.includes("max_user_connections") ||
    combined.includes("too many connections") ||
    combined.includes("connection pool timeout") ||
    combined.includes("can't reach database server")
  );
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function saveWithRetry(shop, form, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await saveReviewPopup(shop, form);
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === retries) break;
      await sleep(200 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function loader({ request }) {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("[Review Popup] auth failed in loader:", error);
    return json({
      title: "Review Notification",
      saved: null,
      judgeMeConnected: false,
    });
  }
  const shop = session?.shop;

  const parseArr = (raw) => {
    if (Array.isArray(raw)) return raw;
    try {
      const value = JSON.parse(raw || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const toBool = (v, fallback = false) => {
    if (v === undefined || v === null) return fallback;
    return v === true || v === 1 || v === "1";
  };
  const toStr = (v, fallback = "") =>
    v === undefined || v === null ? fallback : String(v);

  let saved = null;
  let judgeMeConnected = false;
  try {
    const model = prisma?.reviewpopupconfig || prisma?.reviewPopupConfig || null;
    const source =
      shop && model?.findFirst
        ? await model.findFirst({
            where: { shop },
            orderBy: { id: "desc" },
          })
        : null;

    if (source) {
      saved = {
        id: source.id,
        design: {
          reviewType: toStr(source.reviewType, "new_review"),
          template: toStr(source.template, "solid"),
          imageAppearance: toStr(source.imageAppearance, "cover"),
          bgColor: toStr(source.bgColor, "#FFFFFF"),
          bgAlt: toStr(source.bgAlt, "#F3F4F6"),
          textColor: toStr(source.textColor, "#000000"),
          timestampColor: toStr(source.timestampColor, "#696969"),
          priceTagBg: toStr(source.priceTagBg, "#593E3F"),
          priceTagAlt: toStr(source.priceTagAlt, "#E66465"),
          priceColor: toStr(source.priceColor, "#FFFFFF"),
          starColor: toStr(source.starColor, "#FFCF0D"),
        },
        textSize: {
          content: toStr(source.textSizeContent, "14"),
          compareAt: toStr(source.textSizeCompareAt, "12"),
          price: toStr(source.textSizePrice, "12"),
        },
        content: {
          message: toStr(
            source.message,
            '{reviewer_name} - "{review_title}: {review_body}"'
          ),
          timestamp: toStr(source.timestamp, "{review_date}"),
        },
        productNameMode: toStr(source.productNameMode, "full"),
        productNameLimit: toStr(source.productNameLimit, DEFAULT_PRODUCT_NAME_LIMIT),
        data: {
          dataSource: toStr(source.dataSource, "judge_me"),
          directProductPage: toBool(source.directProductPage, true),
          showProductImage: toBool(source.showProductImage, true),
          showPriceTag: toBool(source.showPriceTag, true),
          showRating: toBool(source.showRating, true),
        },
        visibility: {
          showHome: toBool(source.showHome, true),
          showProduct: toBool(source.showProduct, true),
          productScope: toStr(source.productScope, "all"),
          showCollectionList: toBool(source.showCollectionList, true),
          showCollection: toBool(source.showCollection, true),
          collectionScope: toStr(source.collectionScope, "all"),
          showCart: toBool(source.showCart, true),
          position: toStr(source.position, "bottom-right"),
        },
        behavior: {
          showClose: toBool(source.showClose, true),
          hideOnMobile: toBool(source.hideOnMobile, false),
          delay: toStr(source.delay, "1"),
          duration: toStr(source.duration, "10"),
          interval: toStr(source.interval, "1"),
          intervalUnit: toStr(source.intervalUnit, "mins"),
          randomize: toBool(source.randomize, false),
        },
        selectedProducts: parseArr(
          source.selectedDataProductsJson ?? source.selectedProductsJson
        ),
        selectedCollections: parseArr(source.selectedCollectionsJson),
      };
    }

    const integrationModel = prisma?.notificationconfig || null;
    if (shop && integrationModel?.findFirst) {
      const integration = await integrationModel.findFirst({
        where: { shop, key: JUDGE_ME_INTEGRATION_KEY },
        orderBy: { id: "desc" },
      });
      judgeMeConnected = Boolean(integration?.messageText);
    }
  } catch (e) {
    console.warn("[Review Popup] saved config fetch failed:", e);
  }

  return json({ title: "Review Notification", saved, judgeMeConnected });
}

export async function action({ request }) {
  try {
    let session;
    try {
      ({ session } = await authenticate.admin(request));
    } catch (error) {
      console.error("[Review Popup] auth failed:", error);
      return json(
        {
          success: false,
          error: "Session/auth temporarily unavailable. Please try again.",
        },
        { status: 503 }
      );
    }
    const shop = session?.shop;
    if (!shop) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const rawForm = body?.form;
    const form =
      rawForm && typeof rawForm === "object" && !Array.isArray(rawForm)
        ? rawForm
        : body && typeof body === "object" && !Array.isArray(body)
          ? body
          : null;
    if (!form) {
      return json({ success: false, error: "Missing form" }, { status: 400 });
    }

    console.log("[Review Popup] form payload:", JSON.stringify(form, null, 2));
    try {
      const saved = await saveWithRetry(shop, form, 2);
      console.log("[Review Popup] saved id:", saved?.id);
      return json({ success: true, id: saved?.id });
    } catch (e) {
      console.error("[Review Popup] save failed:", e);
      return json(
        {
          success: false,
          error: e?.message || "Save failed",
          code: e?.code || null,
        },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error("[Review Popup] unexpected action error:", e);
    return json(
      {
        success: false,
        error: e?.message || "Save failed",
        code: e?.code || null,
      },
      { status: 500 }
    );
  }
}

const REVIEW_TYPES = [
  { label: "Review content", value: "review_content" },
  { label: "New review", value: "new_review" },
];
const POSITIONS = [
  { label: "Bottom right", value: "bottom-right" },
  { label: "Bottom left", value: "bottom-left" },
  { label: "Top right", value: "top-right" },
  { label: "Top left", value: "top-left" },
];
const TIME_UNITS = [
  { label: "seconds", value: "seconds" },
  { label: "mins", value: "mins" },
  { label: "hours", value: "hours" },
];

const CONTENT_TOKENS = [
  "reviewer_name",
  "review_title",
  "review_body",
  "reviewer_country",
  "reviewer_city",
];
const TIME_TOKENS = ["review_date"];
const DEFAULT_PRODUCT_NAME_LIMIT = "15";
const MESSAGE_FIELD_ID = "review-content-message";
const TIMESTAMP_FIELD_ID = "review-content-timestamp";
const errorText = (value, fallback = "Save failed") => {
  const raw = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (
    lower.includes("unexpected token") ||
    lower.includes("json") ||
    lower.includes("<!doctype")
  ) {
    return fallback;
  }
  return raw;
};

const REVIEW_STYLES = `
.review-shell {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.review-sidebar {
  width: 80px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.review-nav-btn {
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 4px;
  padding: 5px 10px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
}
.review-nav-btn:hover {
  border-color: #cbd5e1;
}
.review-nav-btn.is-active {
  background: #2f855a;
  color: #ffffff;
  border-color: #2f855a;
}
.review-nav-icon {
  width: 20px;
  height: 20px;
}
.review-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.review-columns {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.review-form {
  flex: 1;
  min-width: 360px;
}
.review-preview {
  flex: 1;
  min-width: 320px;
}
.review-preview-box {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  min-height: 340px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.token-pill {
  border: none;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  color: #111827;
  cursor: pointer;
}
.token-pill:hover {
  background: #e5e7eb;
}
.review-help {
  margin-top: 24px;
  text-align: center;
  color: #6b7280;
  font-size: 13px;
}
.review-help a {
  color: #111827;
  text-decoration: underline;
}
@media (max-width: 1100px) {
  .review-shell {
    flex-direction: column;
  }
  .review-sidebar {
    width: 100%;
    flex-direction: row;
  }
  .review-nav-btn {
    flex: 1;
    flex-direction: row;
    justify-content: center;
  }
  .review-columns {
    flex-direction: column;
  }
}
@media (max-width: 640px) {
  .review-nav-btn {
    padding: 10px;
    font-size: 12px;
  }
  .review-form,
  .review-preview {
    min-width: 0;
  }
}
`;

function LayoutIcon() {
  return (
    <svg
      className="review-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="9" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg
      className="review-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <line x1="7" y1="9" x2="17" y2="9" />
      <line x1="7" y1="13" x2="15" y2="13" />
    </svg>
  );
}

function DisplayIcon() {
  return (
    <svg
      className="review-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function BehaviorIcon() {
  return (
    <svg
      className="review-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.08-1.06l2-1.55-2-3.46-2.44 1a7 7 0 0 0-1.84-1.06L14.4 2h-4.8l-.24 2.87a7 7 0 0 0-1.84 1.06l-2.44-1-2 3.46 2 1.55A7 7 0 0 0 5 12c0 .36.03.71.08 1.06l-2 1.55 2 3.46 2.44-1c.56.44 1.18.8 1.84 1.06L9.6 22h4.8l.24-2.87c.66-.26 1.28-.62 1.84-1.06l2.44 1 2-3.46-2-1.55c.05-.35.08-.7.08-1.06Z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { id: "layout", label: "Layout", Icon: LayoutIcon },
  { id: "content", label: "Content", Icon: ContentIcon },
  { id: "display", label: "Display", Icon: DisplayIcon },
  { id: "behavior", label: "Behavior", Icon: BehaviorIcon },
];

const MOCK_PRODUCTS = [
  {
    id: "p1",
    title: "DREAMY BLUE BALL GOWN",
    image:
      "https://cdn.shopify.com/s/files/1/0000/0001/products/Dreamy-Blue-Ball-Gown.jpg?v=1",
    price: "Rs. 14,099.00",
    compareAt: "Rs. 24,099.00",
    rating: 4,
  },
];

function normalizeHex(value, fallback) {
  const v = String(value || "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toUpperCase();
  return fallback;
}

function clampNameLimit(value, fallback = 15) {
  const n = parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(60, n);
}

function formatProductName(name, mode, limit) {
  if (!name) return "";
  if (mode !== "half") return name;
  const max = clampNameLimit(limit, 15);
  if (name.length <= max) return name;
  return `${name.slice(0, max).trimEnd()}...`;
}

function ColorField({ label, value, onChange, fallback }) {
  const safeValue = normalizeHex(value, fallback);
  const colorSwatch = (
    <span
      style={{
        width: 34,
        height: 31,
        margin: "0px -12px -5px 0px",
        borderLeft: "1px solid #c9cccf",
        borderRadius: "0 8px 8px 0",
        overflow: "hidden",
        cursor: "pointer",
        background: safeValue,
        display: "inline-block",
      }}
    >
      <input
        type="color"
        value={safeValue}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          opacity: 0,
          display: "block",
        }}
        aria-label={`${label} color`}
      />
    </span>
  );
  return (
    <TextField
      label={label}
      value={safeValue}
      onChange={onChange}
      autoComplete="off"
      suffix={colorSwatch}
    />
  );
}

function resolveTemplate(value, map) {
  return String(value || "")
    .trim()
    .replace(/\{(\w+)\}/g, (match, key) => map[key] ?? match);
}

function PreviewCard({
  bgColor,
  bgAlt,
  template,
  imageAppearance,
  textColor,
  timestampColor,
  priceTagBg,
  priceTagAlt,
  priceColor,
  starColor,
  textSizeContent,
  textSizeCompare,
  textSizePrice,
  contentText,
  timestampText,
  showProductImage,
  showPriceTag,
  showRating,
  showClose,
  product,
  productNameMode,
  productNameLimit,
}) {
  const background =
    template === "gradient"
      ? `linear-gradient(135deg, ${bgColor} 0%, ${bgAlt} 100%)`
      : bgColor;
  const imageMode = imageAppearance || "cover";
  const imageFit = imageMode === "contain" ? "contain" : "cover";
  const avatarSize = 56;
  const avatarOffset = Math.round(avatarSize * 0.45);
  const pad = 16;
  const imageOverflow = showProductImage && imageMode === "cover";

  const rawProductName = product?.title || "DREAMY BLUE BALL GOWN";
  const safeProductName = formatProductName(
    rawProductName,
    productNameMode,
    productNameLimit
  );
  const tokenValues = {
    reviewer_name: "Jane B.",
    review_title: "Great product!",
    review_body: "This product is amazing! I love it!!!",
    reviewer_country: "abroad",
    reviewer_city: "London",
    product_name: safeProductName,
    review_date: "2 days ago",
  };

  const resolvedContent = resolveTemplate(
    contentText || '{reviewer_name} - "{review_title}: {review_body}"',
    tokenValues
  );
  const resolvedTimestamp = resolveTemplate(
    timestampText || "{review_date}",
    tokenValues
  );
  const contentNode = resolvedContent;

  return (
    <div
      style={{
        background,
        color: textColor,
        borderRadius: 18,
        boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
        border: "1px solid rgba(0,0,0,0.06)",
        padding: pad,
        paddingLeft: imageOverflow ? pad + avatarOffset : pad,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        position: "relative",
        maxWidth: 460,
      }}
    >
      {showClose && (
        <button
          type="button"
          aria-label="Close"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            border: "none",
            background: "transparent",
            color: textColor,
            display: "grid",
            placeItems: "center",
            fontSize: 20,
            lineHeight: 1,
            padding: 0,
            cursor: "pointer",
          }}
        >
          x
        </button>
      )}
      {showProductImage &&
        (imageOverflow ? (
          <div
            style={{
              position: "absolute",
              left: "8px",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: avatarSize,
              height: avatarSize,
              borderRadius: Math.round(avatarSize * 0.22),
              overflow: "hidden",
              background: "#f3f4f6",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
              border: "2px solid rgba(255,255,255,0.75)",
            }}
          >
            {product?.image ? (
              <img
                src={product.image}
                alt={product.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span style={{ fontSize: 12, color: "#6b7280" }}>IMG</span>
            )}
          </div>
        ) : (
          <div
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: Math.round(avatarSize * 0.22),
              overflow: "hidden",
              background: "#f3f4f6",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
              border: "1px solid rgba(15,23,42,0.08)",
            }}
          >
            {product?.image ? (
              <img
                src={product.image}
                alt={product.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: imageFit,
                }}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span style={{ fontSize: 12, color: "#6b7280" }}>IMG</span>
            )}
          </div>
        ))}
      <div style={{ display: "grid", gap: 6, minWidth: 0, flex: 1 }}>
        {showRating && (
          <div style={{ color: starColor, fontSize: 20, letterSpacing: 1 }}>
            {"★★★★★".slice(0, product?.rating || 4)}
            <span style={{ color: "#d1d5db" }}>
              {"☆☆☆☆☆".slice(0, 5 - (product?.rating || 4))}
            </span>
          </div>
        )}
        <div style={{ fontSize: textSizeContent, lineHeight: 1.35 }}>
          {contentNode}
        </div>
        {showPriceTag && (
          <InlineStack gap="200" blockAlign="center">
            <span
              style={{
                background: priceTagBg,
                color: priceColor,
                fontSize: textSizePrice,
                padding: "2px 8px",
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              {product?.price || "Rs. 14,099.00"}
            </span>
            <span
              style={{
                color: priceTagAlt,
                fontSize: textSizeCompare,
                textDecoration: "line-through",
              }}
            >
              {product?.compareAt || "Rs. 24,099.00"}
            </span>
          </InlineStack>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 12,
            color: timestampColor,
          }}
        >
          <span>{resolvedTimestamp}</span>
        </div>
      </div>
    </div>
  );
}

function StyledPreviewCard({
  bgColor,
  bgAlt,
  template,
  imageAppearance,
  textColor,
  timestampColor,
  priceTagBg,
  priceTagAlt,
  priceColor,
  starColor,
  textSizeContent,
  textSizeCompare,
  textSizePrice,
  contentText,
  timestampText,
  showProductImage,
  showPriceTag,
  showRating,
  showClose,
  product,
  productNameMode,
  productNameLimit,
}) {
  const background =
    template === "gradient"
      ? `linear-gradient(135deg, ${bgColor} 0%, ${bgAlt} 100%)`
      : bgColor;
  const imageMode = imageAppearance || "cover";
  const imageFit = imageMode === "contain" ? "contain" : "cover";
  const avatarSize = 56;
  const avatarOffset = Math.round(avatarSize * 0.45);
  const pad = 16;
  const imageOverflow = showProductImage && imageMode === "cover";

  const rawProductName = product?.title || "DREAMY BLUE BALL GOWN";
  const safeProductName = formatProductName(
    rawProductName,
    productNameMode,
    productNameLimit
  );
  const tokenValues = {
    reviewer_name: "Jane B.",
    review_title: "Great product!",
    review_body: "This product is amazing! I love it!!!",
    reviewer_country: "abroad",
    reviewer_city: "London",
    product_name: safeProductName,
    review_date: "2 days ago",
  };

  const resolvedContent = resolveTemplate(
    contentText || '{reviewer_name} - "{review_title}: {review_body}"',
    tokenValues
  );
  const resolvedTimestamp = resolveTemplate(
    timestampText || "{review_date}",
    tokenValues
  );

  const rating = Math.max(0, Math.min(5, Number(product?.rating || 4)));
  const filledStars = "\u2605".repeat(rating);
  const emptyStars = "\u2605".repeat(5 - rating);

  return (
    <div
      style={{
        background,
        color: textColor,
        borderRadius: 18,
        boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
        border: "1px solid rgba(0,0,0,0.06)",
        padding: pad,
        paddingLeft: imageOverflow ? pad + avatarOffset : pad,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        position: "relative",
        maxWidth: 460,
      }}
    >
      {showClose && (
        <button
          type="button"
          aria-label="Close"
          style={{
            position: "absolute",
            top: -12,
            right: -12,
            border: "none",
            background: "transparent",
            color: textColor,
            display: "grid",
            placeItems: "center",
            fontSize: 20,
            lineHeight: 1,
            padding: 0,
            cursor: "pointer",
          }}
        >
          x
        </button>
      )}
      {showProductImage &&
        (imageOverflow ? (
          <div
            style={{
              position: "absolute",
              left: "8px",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: avatarSize,
              height: avatarSize,
              borderRadius: Math.round(avatarSize * 0.22),
              overflow: "hidden",
              background: "#f3f4f6",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
              border: "2px solid rgba(255,255,255,0.75)",
            }}
          >
            {product?.image ? (
              <img
                src={product.image}
                alt={product.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span style={{ fontSize: 12, color: "#6b7280" }}>IMG</span>
            )}
          </div>
        ) : (
          <div
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: Math.round(avatarSize * 0.22),
              overflow: "hidden",
              background: "#f3f4f6",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
              border: "1px solid rgba(15,23,42,0.08)",
            }}
          >
            {product?.image ? (
              <img
                src={product.image}
                alt={product.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: imageFit,
                }}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span style={{ fontSize: 12, color: "#6b7280" }}>IMG</span>
            )}
          </div>
        ))}
      <div style={{ display: "grid", gap: 6, minWidth: 0, flex: 1 }}>
        {showRating && (
          <div style={{ color: starColor, fontSize: 20, letterSpacing: 1 }}>
            {filledStars}
            <span style={{ color: "#d1d5db" }}>{emptyStars}</span>
          </div>
        )}
        <div
          style={{
            fontWeight: 800,
            fontSize: 16,
            lineHeight: 1.05,
            letterSpacing: 0.1,
            textTransform: "uppercase",
          }}
        >
          {safeProductName}
        </div>
        {showPriceTag && (
          <InlineStack gap="200" blockAlign="center">
            <span
              style={{
                background: priceTagBg,
                color: priceColor,
                fontSize: textSizePrice,
                padding: "2px 8px",
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              {product?.price || "Rs. 14,099.00"}
            </span>
            <span
              style={{
                color: priceTagAlt,
                fontSize: textSizeCompare,
                textDecoration: "line-through",
              }}
            >
              {product?.compareAt || "Rs. 24,099.00"}
            </span>
          </InlineStack>
        )}
        <div
          style={{
            fontSize: textSizeContent,
            lineHeight: 1.35,
            fontStyle: "italic",
          }}
        >
          {resolvedContent}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 12,
            color: timestampColor,
          }}
        >
          <span>{resolvedTimestamp}</span>
        </div>
      </div>
    </div>
  );
}

export default function ReviewNotificationPage() {
  const { saved, judgeMeConnected } = useLoaderData();
  const navigate = useNavigate();
  const location = useLocation();
  const notificationUrl = `/app/notification${location.search || ""}`;
  const notificationManageUrl = `/app/notification/manage${location.search || ""}`;
  const fetcher = useFetcher();
  const collectionFetcher = useFetcher();
  const [activeSection, setActiveSection] = useState("layout");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ active: false, error: false, msg: "" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [page, setPage] = useState(1);
  const [collectionPage, setCollectionPage] = useState(1);
  const [hasLoadedProducts, setHasLoadedProducts] = useState(false);

  const [design, setDesign] = useState({
    reviewType: "new_review",
    template: "solid",
    imageAppearance: "cover",
    bgColor: "#FFFFFF",
    bgAlt: "#F3F4F6",
    textColor: "#000000",
    timestampColor: "#696969",
    priceTagBg: "#593E3F",
    priceTagAlt: "#E66465",
    priceColor: "#FFFFFF",
    starColor: "#FFCF0D",
  });

  const [textSize, setTextSize] = useState({
    content: "14",
    compareAt: "12",
    price: "12",
  });

  const [content, setContent] = useState({
    message: '{reviewer_name} - "{review_title}: {review_body}"',
    timestamp: "{review_date}",
  });
  const [productNameMode, setProductNameMode] = useState("full");
  const [productNameLimit, setProductNameLimit] = useState(
    DEFAULT_PRODUCT_NAME_LIMIT
  );

  const [data, setData] = useState({
    dataSource: "judge_me",
    directProductPage: true,
    showProductImage: true,
    showPriceTag: true,
    showRating: true,
  });

  const [visibility, setVisibility] = useState({
    showHome: true,
    showProduct: true,
    productScope: "all",
    showCollectionList: true,
    showCollection: true,
    collectionScope: "all",
    showCart: true,
    position: "bottom-right",
  });

  const [behavior, setBehavior] = useState({
    showClose: true,
    hideOnMobile: false,
    delay: "1",
    duration: "10",
    interval: "1",
    intervalUnit: "mins",
    randomize: false,
  });

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const contentCursorRef = useRef({ message: null, timestamp: null });

  useEffect(() => {
    if (!saved) return;

    if (saved.design) setDesign((prev) => ({ ...prev, ...saved.design }));
    if (saved.textSize) setTextSize((prev) => ({ ...prev, ...saved.textSize }));
    if (saved.content) setContent((prev) => ({ ...prev, ...saved.content }));
    if (saved.data) setData((prev) => ({ ...prev, ...saved.data }));
    if (saved.visibility)
      setVisibility((prev) => ({ ...prev, ...saved.visibility }));
    if (saved.behavior) setBehavior((prev) => ({ ...prev, ...saved.behavior }));
    if (saved.productNameMode) setProductNameMode(saved.productNameMode);
    if (saved.productNameLimit !== undefined && saved.productNameLimit !== null) {
      setProductNameLimit(String(saved.productNameLimit));
    }

    setSelectedProducts(Array.isArray(saved.selectedProducts) ? saved.selectedProducts : []);
    setSelectedCollections(
      Array.isArray(saved.selectedCollections) ? saved.selectedCollections : []
    );
    setEditingId(
      Number.isInteger(Number(saved.id)) && Number(saved.id) > 0
        ? Number(saved.id)
        : null
    );
  }, [saved]);

  useEffect(() => {
    if (hasLoadedProducts) return;
    const params = new URLSearchParams();
    params.set("page", "1");
    fetcher.load(`/app/products-picker?${params.toString()}`);
    setHasLoadedProducts(true);
  }, [hasLoadedProducts, fetcher]);

  useEffect(() => {
    if (!pickerOpen) return;
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("page", String(page));
    fetcher.load(`/app/products-picker?${params.toString()}`);
  }, [pickerOpen, search, page, fetcher]);

  useEffect(() => {
    if (!collectionPickerOpen) return;
    const params = new URLSearchParams();
    if (collectionSearch) params.set("q", collectionSearch);
    params.set("page", String(collectionPage));
    collectionFetcher.load(`/app/collections-picker?${params.toString()}`);
  }, [collectionPickerOpen, collectionSearch, collectionPage, collectionFetcher]);

  const storeProducts = useMemo(() => {
    const items = fetcher.data?.items || [];
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      handle: item.handle || null,
      image: item.featuredImage || null,
      status: item.status,
      price: item.price || null,
      compareAt: item.compareAt || null,
      rating: 4,
    }));
  }, [fetcher.data]);

  const storeCollections = useMemo(() => {
    const items = collectionFetcher.data?.items || [];
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      handle: item.handle,
      image: item.image || null,
      productsCount: item.productsCount ?? 0,
      sampleProduct: item.sampleProduct || null,
    }));
  }, [collectionFetcher.data]);

  const allProducts = storeProducts.length ? storeProducts : MOCK_PRODUCTS;
  const fallbackPreviewProduct =
    storeProducts[0] || allProducts[0] || MOCK_PRODUCTS[0] || null;
  const needsProductSelection =
    visibility.productScope === "specific" &&
    selectedProducts.length === 0 &&
    !fallbackPreviewProduct;
  const needsCollectionSelection =
    visibility.collectionScope === "specific" &&
    selectedCollections.length === 0 &&
    !fallbackPreviewProduct;
  const scopedProduct =
    visibility.productScope === "specific" ? selectedProducts[0] : null;
  const scopedCollectionProduct =
    visibility.collectionScope === "specific"
      ? selectedCollections[0]?.sampleProduct
      : null;
  const previewProduct =
    scopedProduct ||
    scopedCollectionProduct ||
    fallbackPreviewProduct ||
    null;
  const previewMessage = needsProductSelection
    ? "Select a product to preview."
    : needsCollectionSelection
      ? "Select a collection to preview."
      : !previewProduct
        ? "Preview will appear once a product is available."
        : null;

  const togglePick = (item) => {
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.id === item.id);
      if (exists) return prev.filter((p) => p.id !== item.id);
      return [...prev, item];
    });
  };

  const toggleCollection = (item) => {
    setSelectedCollections((prev) => {
      const exists = prev.some((c) => c.id === item.id);
      if (exists) return prev.filter((c) => c.id !== item.id);
      return [...prev, item];
    });
  };

  const hasNextPage = Boolean(fetcher.data?.hasNextPage);
  const hasNextCollectionPage = Boolean(collectionFetcher.data?.hasNextPage);
  const collectionItems = storeCollections;

  const rememberCursor = (field, target) => {
    if (!target || typeof target.selectionStart !== "number") return;
    const start = Number(target.selectionStart) || 0;
    const end =
      typeof target.selectionEnd === "number"
        ? Number(target.selectionEnd)
        : start;
    contentCursorRef.current[field] = { start, end };
  };

  const handleTokenFieldSelection = (field) => (event) => {
    rememberCursor(field, event?.target);
  };

  const insertToken = (field, token) => {
    const tokenText = `{${token}}`;
    const targetId =
      field === "message"
        ? MESSAGE_FIELD_ID
        : field === "timestamp"
          ? TIMESTAMP_FIELD_ID
          : "";
    const target =
      typeof document !== "undefined" && targetId
        ? document.getElementById(targetId)
        : null;

    setContent((c) => {
      const current = String(c?.[field] || "");
      const liveStart =
        target && typeof target.selectionStart === "number"
          ? Number(target.selectionStart)
          : null;
      const liveEnd =
        target && typeof target.selectionEnd === "number"
          ? Number(target.selectionEnd)
          : liveStart;
      const saved = contentCursorRef.current[field];
      const fallbackPos = current.length;

      const rawStart =
        Number.isFinite(liveStart) && liveStart !== null
          ? liveStart
          : Number.isFinite(saved?.start)
            ? saved.start
            : fallbackPos;
      const rawEnd =
        Number.isFinite(liveEnd) && liveEnd !== null
          ? liveEnd
          : Number.isFinite(saved?.end)
            ? saved.end
            : rawStart;

      const start = Math.max(0, Math.min(current.length, rawStart));
      const end = Math.max(start, Math.min(current.length, rawEnd));
      const before = current.slice(0, start);
      const after = current.slice(end);
      const needsSpace = before.length > 0 && !/\s$/.test(before);
      const insertion = `${needsSpace ? " " : ""}${tokenText}`;
      const next = `${before}${insertion}${after}`;
      const nextCursor = before.length + insertion.length;

      contentCursorRef.current[field] = { start: nextCursor, end: nextCursor };
      setTimeout(() => {
        try {
          const input =
            typeof document !== "undefined" && targetId
              ? document.getElementById(targetId)
              : null;
          if (input && typeof input.setSelectionRange === "function") {
            input.focus();
            input.setSelectionRange(nextCursor, nextCursor);
          }
        } catch {}
      }, 0);

      return { ...c, [field]: next };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const endpoint = `${location.pathname}${location.search || ""}`;
      const form = {
        editId: editingId,
        design,
        textSize,
        content,
        productNameMode,
        productNameLimit,
        data,
        visibility,
        behavior,
        selectedDataProducts: selectedProducts,
        selectedVisibilityProducts: selectedProducts,
        selectedProducts,
        selectedCollections,
      };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ form }),
      });
      const raw = await res.text();
      let out = null;
      try {
        out = raw ? JSON.parse(raw) : null;
      } catch {
        out = null;
      }

      if (!res.ok) {
        throw new Error(
          errorText(
            out?.error,
            errorText(out?.message, `Save failed (HTTP ${res.status})`)
          )
        );
      }

      if (out && out.success === false) {
        throw new Error(errorText(out?.error));
      }

      const responseUrl = String(res.url || "");
      const redirectedToAuth =
        res.redirected && /\/auth|\/login|oauth|authorize/i.test(responseUrl);
      if (redirectedToAuth) {
        throw new Error("Session expired. Reload page and try again.");
      }

      if (Number.isInteger(Number(out?.id)) && Number(out.id) > 0) {
        setEditingId(Number(out.id));
      }
      setToast({ active: true, error: false, msg: "Saved." });
      setTimeout(() => navigate(notificationManageUrl), 900);
    } catch (e) {
      setToast({
        active: true,
        error: true,
        msg: errorText(e),
      });
    } finally {
      setSaving(false);
    }
  };

  const items = allProducts;
  const ActivePreviewCard = StyledPreviewCard || PreviewCard;

  return (
    <Frame>
      <Page
        title="Create Review notification"
        backAction={{
          content: "Back",
          onAction: () => navigate(notificationUrl),
        }}
        primaryAction={{ content: "Save", onAction: save, loading: saving }}
      >
        <style>{REVIEW_STYLES}</style>
        <div className="review-shell">
          <div className="review-sidebar">
            {NAV_ITEMS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`review-nav-btn ${activeSection === id ? "is-active" : ""}`}
                onClick={() => setActiveSection(id)}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="review-main">
            <div className="review-columns">
              <div className="review-form">
                <BlockStack gap="400">
                  {activeSection === "layout" && (
                    <>
                      <Card>
                        <Box padding="4">
                          <BlockStack gap="400">
                            <Text as="h3" variant="headingMd">
                              Design
                            </Text>
                            <Select
                              label="Type"
                              options={REVIEW_TYPES}
                              value={design.reviewType}
                              onChange={(v) =>
                                setDesign((d) => ({ ...d, reviewType: v }))
                              }
                            />

                            <BlockStack gap="200">
                              <Text as="p">Color template</Text>
                              <InlineStack gap="300">
                                <RadioButton
                                  id="template-solid"
                                  name="template"
                                  label="Solid"
                                  checked={design.template === "solid"}
                                  onChange={() =>
                                    setDesign((d) => ({ ...d, template: "solid" }))
                                  }
                                />
                                <RadioButton
                                  id="template-gradient"
                                  name="template"
                                  label="Gradient"
                                  checked={design.template === "gradient"}
                                  onChange={() =>
                                    setDesign((d) => ({
                                      ...d,
                                      template: "gradient",
                                    }))
                                  }
                                />
                              </InlineStack>
                            </BlockStack>

                            <ColorField
                              label="Background color"
                              value={design.bgColor}
                              fallback="#FFFFFF"
                              onChange={(v) =>
                                setDesign((d) => ({ ...d, bgColor: v }))
                              }
                            />
                            {design.template === "gradient" && (
                              <ColorField
                                label="Background color (alt)"
                                value={design.bgAlt}
                                fallback="#F3F4F6"
                                onChange={(v) =>
                                  setDesign((d) => ({ ...d, bgAlt: v }))
                                }
                              />
                            )}

                            <InlineStack gap="400" wrap={false}>
                              <Box width="50%">
                                <ColorField
                                  label="Text color"
                                  value={design.textColor}
                                  fallback="#000000"
                                  onChange={(v) =>
                                    setDesign((d) => ({ ...d, textColor: v }))
                                  }
                                />
                              </Box>
                              <Box width="50%">
                                <ColorField
                                  label="Timestamp color"
                                  value={design.timestampColor}
                                  fallback="#696969"
                                  onChange={(v) =>
                                    setDesign((d) => ({
                                      ...d,
                                      timestampColor: v,
                                    }))
                                  }
                                />
                              </Box>
                            </InlineStack>

                            <InlineStack gap="400" wrap={false}>
                              <Box width="50%">
                                <ColorField
                                  label="Price tag background"
                                  value={design.priceTagBg}
                                  fallback="#593E3F"
                                  onChange={(v) =>
                                    setDesign((d) => ({
                                      ...d,
                                      priceTagBg: v,
                                    }))
                                  }
                                />
                              </Box>
                              <Box width="50%">
                                <ColorField
                                  label="Price color"
                                  value={design.priceColor}
                                  fallback="#FFFFFF"
                                  onChange={(v) =>
                                    setDesign((d) => ({ ...d, priceColor: v }))
                                  }
                                />
                              </Box>
                            </InlineStack>

                            <InlineStack gap="400" wrap={false}>
                              <Box width="50%">
                                <ColorField
                                  label="Compare at price color"
                                  value={design.priceTagAlt}
                                  fallback="#E66465"
                                  onChange={(v) =>
                                    setDesign((d) => ({
                                      ...d,
                                      priceTagAlt: v,
                                    }))
                                  }
                                />
                              </Box>
                              <Box width="50%">
                                <ColorField
                                  label="Star rating color"
                                  value={design.starColor}
                                  fallback="#FFCF0D"
                                  onChange={(v) =>
                                    setDesign((d) => ({ ...d, starColor: v }))
                                  }
                                />
                              </Box>
                            </InlineStack>
                            <ChoiceList
                              title="Image appearance"
                              choices={[
                                {
                                  label: "Cover (Overflowing container)",
                                  value: "cover",
                                },
                                { label: "Fit within container", value: "contain" },
                              ]}
                              selected={[design.imageAppearance]}
                              onChange={(value) =>
                                setDesign((d) => ({
                                  ...d,
                                  imageAppearance: value?.[0] || "cover",
                                }))
                              }
                            />
                          </BlockStack>
                        </Box>
                      </Card>

                      <Card>
                        <Box padding="4">
                          <BlockStack gap="300">
                            <Text as="h3" variant="headingMd">
                              Text size
                            </Text>
                            <InlineStack gap="400" wrap={false}>
                              <Box width="50%">
                                <TextField
                                  label="Content"
                                  type="number"
                                  value={textSize.content}
                                  onChange={(v) =>
                                    setTextSize((s) => ({
                                      ...s,
                                      content: v,
                                    }))
                                  }
                                  autoComplete="off"
                                />
                              </Box>
                              <Box width="50%">
                                <TextField
                                  label="Compare at price"
                                  type="number"
                                  value={textSize.compareAt}
                                  onChange={(v) =>
                                    setTextSize((s) => ({
                                      ...s,
                                      compareAt: v,
                                    }))
                                  }
                                  autoComplete="off"
                                />
                              </Box>
                            </InlineStack>
                            <Box width="50%">
                              <TextField
                                label="Price"
                                type="number"
                                value={textSize.price}
                                onChange={(v) =>
                                  setTextSize((s) => ({ ...s, price: v }))
                                }
                                autoComplete="off"
                              />
                            </Box>
                          </BlockStack>
                        </Box>
                      </Card>
                    </>
                  )}
                  {activeSection === "content" && (
                    <>
                      <Card>
                        <Box padding="4">
                          <BlockStack gap="300">
                            <Text as="h3" variant="headingMd">
                              Content
                            </Text>
                            <TextField
                              id={MESSAGE_FIELD_ID}
                              label="Notification content"
                              value={content.message}
                              onChange={(v) =>
                                setContent((c) => ({ ...c, message: v }))
                              }
                              onFocus={handleTokenFieldSelection("message")}
                              onClick={handleTokenFieldSelection("message")}
                              onKeyUp={handleTokenFieldSelection("message")}
                              onSelect={handleTokenFieldSelection("message")}
                              multiline={3}
                              autoComplete="off"
                              helpText={`${content.message.length}/250`}
                            />
                            <InlineStack gap="150" wrap>
                              {CONTENT_TOKENS.map((token) => (
                                <button
                                  key={token}
                                  type="button"
                                  className="token-pill"
                                  onClick={() => insertToken("message", token)}
                                >
                                  {token}
                                </button>
                              ))}
                            </InlineStack>
                            <TextField
                              id={TIMESTAMP_FIELD_ID}
                              label="Timestamp"
                              value={content.timestamp}
                              onChange={(v) =>
                                setContent((c) => ({ ...c, timestamp: v }))
                              }
                              onFocus={handleTokenFieldSelection("timestamp")}
                              onClick={handleTokenFieldSelection("timestamp")}
                              onKeyUp={handleTokenFieldSelection("timestamp")}
                              onSelect={handleTokenFieldSelection("timestamp")}
                              autoComplete="off"
                              helpText={`${content.timestamp.length}/30`}
                            />
                            <InlineStack gap="150" wrap>
                              {TIME_TOKENS.map((token) => (
                                <button
                                  key={token}
                                  type="button"
                                  className="token-pill"
                                  onClick={() => insertToken("timestamp", token)}
                                >
                                  {token}
                                </button>
                              ))}
                            </InlineStack>

                            <Text as="h3" variant="headingMd">
                              Data
                            </Text>
                            <BlockStack gap="200">
                              <Text as="p" variant="bodyMd">
                                Data source
                              </Text>
                              <div>
                                <RadioButton
                                  id="data-judge"
                                  name="data_source"
                                  label="Sync Judge.me Review"
                                  checked={data.dataSource === "judge_me"}
                                  onChange={() =>
                                    setData((d) => ({
                                      ...d,
                                      dataSource: "judge_me",
                                    }))
                                  }
                                />
                                <div style={{ marginLeft: 36, marginTop: 6 }}>
                                  {judgeMeConnected ? (
                                    <Text
                                      as="span"
                                      style={{
                                        background: "#b7f5cb",
                                        color: "#095236",
                                        borderRadius: 10,
                                        padding: "6px 10px",
                                        fontWeight: 600,
                                        display: "inline-block",
                                      }}
                                    >
                                      Connected with Judge.me
                                    </Text>
                                  ) : (
                                    <Button
                                      onClick={() =>
                                        navigate(
                                          `/app/integrations${location.search || ""}`
                                        )
                                      }
                                    >
                                      Connect with Judge.me
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* <div>
                                <RadioButton
                                  id="data-csv"
                                  name="data_source"
                                  label="Import CSV"
                                  checked={data.dataSource === "csv"}
                                  onChange={() =>
                                    setData((d) => ({
                                      ...d,
                                      dataSource: "csv",
                                    }))
                                  }
                                />
                                <div style={{ marginLeft: 36, marginTop: 6 }}>
                                  <Text tone="subdued">
                                    Select a CSV file to import your review data
                                  </Text>
                                </div>
                              </div> */}
                            </BlockStack>

                            <BlockStack gap="150">
                              <Text as="p" variant="bodyMd">
                                Options
                              </Text>
                              <Checkbox
                                label="Notification direct to specific product page"
                                checked={data.directProductPage}
                                onChange={(v) =>
                                  setData((d) => ({
                                    ...d,
                                    directProductPage: v,
                                  }))
                                }
                              />
                              <Checkbox
                                label="Show product/avatar image"
                                checked={data.showProductImage}
                                onChange={(v) =>
                                  setData((d) => ({
                                    ...d,
                                    showProductImage: v,
                                  }))
                                }
                              />
                              <Checkbox
                                label="Show price tag"
                                checked={data.showPriceTag}
                                onChange={(v) =>
                                  setData((d) => ({ ...d, showPriceTag: v }))
                                }
                              />
                              <Checkbox
                                label="Show rating"
                                checked={data.showRating}
                                onChange={(v) =>
                                  setData((d) => ({ ...d, showRating: v }))
                                }
                              />
                            </BlockStack>
                          </BlockStack>
                        </Box>
                      </Card>
                    </>
                  )}
                  {activeSection === "display" && (
                    <>
                    <Card>
                      <Box padding="4">
                        <BlockStack gap="300">
                          <Text as="h3" variant="headingMd">
                            Visibility
                          </Text>
                          <Text as="h4" variant="headingSm">
                            Show on
                          </Text>
                          <BlockStack gap="200">
                            <Checkbox
                              label="Home page"
                              checked={visibility.showHome}
                              onChange={(v) =>
                                setVisibility((s) => ({ ...s, showHome: v }))
                              }
                            />
                            <Checkbox
                              label="Product page"
                              checked={visibility.showProduct}
                              onChange={(v) =>
                                setVisibility((s) => ({ ...s, showProduct: v }))
                              }
                            />
                            <div style={{ marginLeft: 28, display: "grid", gap: 8 }}>
                              <RadioButton
                                id="product-scope-all"
                                name="product_scope"
                                label="All products"
                                checked={visibility.productScope === "all"}
                                disabled={!visibility.showProduct}
                                onChange={() =>
                                  setVisibility((s) => ({
                                    ...s,
                                    productScope: "all",
                                  }))
                                }
                              />
                              <RadioButton
                                id="product-scope-specific"
                                name="product_scope"
                                label="Specific products"
                                checked={visibility.productScope === "specific"}
                                disabled={!visibility.showProduct}
                                onChange={() =>
                                  setVisibility((s) => ({
                                    ...s,
                                    productScope: "specific",
                                  }))
                                }
                              />
                              {visibility.productScope === "specific" && (
                                <InlineStack
                                  gap="200"
                                  blockAlign="center"
                                  wrap
                                  style={{ marginTop: 6 }}
                                >
                                  <Button onClick={() => setPickerOpen(true)}>
                                    Browse products
                                  </Button>
                                  <Text tone="subdued">
                                    {selectedProducts.length} products selected
                                  </Text>
                                </InlineStack>
                              )}
                            </div>
                            <Checkbox
                              label="Collection list"
                              checked={visibility.showCollectionList}
                              onChange={(v) =>
                                setVisibility((s) => ({
                                  ...s,
                                  showCollectionList: v,
                                }))
                              }
                            />
                            <Checkbox
                              label="Collection page"
                              checked={visibility.showCollection}
                              onChange={(v) =>
                                setVisibility((s) => ({ ...s, showCollection: v }))
                              }
                            />
                            <div style={{ marginLeft: 28, display: "grid", gap: 8 }}>
                              <RadioButton
                                id="collection-scope-all"
                                name="collection_scope"
                                label="All collections"
                                checked={visibility.collectionScope === "all"}
                                disabled={!visibility.showCollection}
                                onChange={() =>
                                  setVisibility((s) => ({
                                    ...s,
                                    collectionScope: "all",
                                  }))
                                }
                              />
                              <RadioButton
                                id="collection-scope-specific"
                                name="collection_scope"
                                label="Specific collections"
                                checked={visibility.collectionScope === "specific"}
                                disabled={!visibility.showCollection}
                                onChange={() =>
                                  setVisibility((s) => ({
                                    ...s,
                                    collectionScope: "specific",
                                  }))
                                }
                              />
                              {visibility.collectionScope === "specific" && (
                                <InlineStack
                                  gap="200"
                                  blockAlign="center"
                                  wrap
                                  style={{ marginTop: 6 }}
                                >
                                  <Button onClick={() => setCollectionPickerOpen(true)}>
                                    Browse collections
                                  </Button>
                                  <Text tone="subdued">
                                    {selectedCollections.length} collections selected
                                  </Text>
                                </InlineStack>
                              )}
                            </div>
                            <Checkbox
                              label="Cart page"
                              checked={visibility.showCart}
                              onChange={(v) =>
                                setVisibility((s) => ({ ...s, showCart: v }))
                              }
                            />
                          </BlockStack>
                          <Select
                            label="Position"
                            options={POSITIONS}
                            value={visibility.position}
                            onChange={(v) =>
                              setVisibility((s) => ({ ...s, position: v }))
                            }
                          />
                        </BlockStack>
                      </Box>
                    </Card>
                    </>
                  )}
                  {activeSection === "behavior" && (
                    <>
                      <Card>
                        <Box padding="4">
                          <BlockStack gap="300">
                            <Text as="h3" variant="headingMd">
                              Appearance
                            </Text>
                            <Checkbox
                              label="Display close button"
                              checked={behavior.showClose}
                              onChange={(v) =>
                                setBehavior((b) => ({ ...b, showClose: v }))
                              }
                            />
                            <Checkbox
                              label="Hide on mobile"
                              checked={behavior.hideOnMobile}
                              onChange={(v) =>
                                setBehavior((b) => ({ ...b, hideOnMobile: v }))
                              }
                            />
                          </BlockStack>
                        </Box>
                      </Card>

                      <Card>
                        <Box padding="4">
                          <BlockStack gap="300">
                            <Text as="h3" variant="headingMd">
                              Timing
                            </Text>
                            <TextField
                              label="Delay before first notification"
                              value={behavior.delay}
                              onChange={(v) =>
                                setBehavior((b) => ({ ...b, delay: v }))
                              }
                              suffix="seconds"
                              autoComplete="off"
                            />
                            <TextField
                              label="Display duration"
                              value={behavior.duration}
                              onChange={(v) =>
                                setBehavior((b) => ({ ...b, duration: v }))
                              }
                              suffix="seconds"
                              autoComplete="off"
                            />
                            <InlineStack gap="400" wrap={false}>
                              <Box width="50%">
                                <TextField
                                  label="Interval time"
                                  value={behavior.interval}
                                  onChange={(v) =>
                                    setBehavior((b) => ({ ...b, interval: v }))
                                  }
                                  autoComplete="off"
                                />
                              </Box>
                              <Box width="50%">
                                <Select
                                  label=" "
                                  labelHidden
                                  options={TIME_UNITS}
                                  value={behavior.intervalUnit}
                                  onChange={(v) =>
                                    setBehavior((b) => ({
                                      ...b,
                                      intervalUnit: v,
                                    }))
                                  }
                                />
                              </Box>
                            </InlineStack>
                            <Checkbox
                              label="Randomize interval time"
                              checked={behavior.randomize}
                              onChange={(v) =>
                                setBehavior((b) => ({ ...b, randomize: v }))
                              }
                            />
                            <Text variant="bodySm" tone="subdued">
                              Interval time will be randomized around the input above.
                            </Text>
                          </BlockStack>
                        </Box>
                      </Card>
                    </>
                  )}
                </BlockStack>
              </div>
              <div className="review-preview">
                <Card>
                  <Box padding="4">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        Preview
                      </Text>
                      <div className="review-preview-box">
                        {previewMessage ? (
                          <div style={{ textAlign: "center" }}>
                            <Text as="p" tone="subdued">
                              {previewMessage}
                            </Text>
                          </div>
                        ) : (
                          <ActivePreviewCard
                            bgColor={normalizeHex(design.bgColor, "#FFFFFF")}
                            bgAlt={normalizeHex(design.bgAlt, "#F3F4F6")}
                            template={design.template}
                            imageAppearance={design.imageAppearance}
                            textColor={normalizeHex(design.textColor, "#000000")}
                            timestampColor={normalizeHex(
                              design.timestampColor,
                              "#696969"
                            )}
                            priceTagBg={normalizeHex(
                              design.priceTagBg,
                              "#593E3F"
                            )}
                            priceTagAlt={normalizeHex(
                              design.priceTagAlt,
                              "#E66465"
                            )}
                            priceColor={normalizeHex(
                              design.priceColor,
                              "#FFFFFF"
                            )}
                            starColor={normalizeHex(design.starColor, "#FFCF0D")}
                            textSizeContent={Number(textSize.content) || 14}
                            textSizeCompare={Number(textSize.compareAt) || 12}
                            textSizePrice={Number(textSize.price) || 12}
                            contentText={content.message}
                            timestampText={content.timestamp}
                            showProductImage={data.showProductImage}
                            showPriceTag={data.showPriceTag}
                            showRating={data.showRating}
                            showClose={behavior.showClose}
                            product={previewProduct}
                            productNameMode={productNameMode}
                            productNameLimit={productNameLimit}
                          />
                        )}
                      </div>
                    </BlockStack>
                  </Box>
                </Card>
              </div>
            </div>
            <div className="review-help">
              We&apos;re here to help! Contact support or refer to the{" "}
              <a href="#">User guide</a>
            </div>
          </div>
        </div>
      </Page>
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Select products"
        primaryAction={{ content: "Select", onAction: () => setPickerOpen(false) }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setPickerOpen(false) },
        ]}
        large
      >
        <Modal.Section>
          <BlockStack gap="300">
            <InlineStack gap="200" wrap={false}>
              <Box width="70%">
                <TextField
                  label="Search products"
                  labelHidden
                  placeholder="Search products"
                  value={search}
                  onChange={(v) => {
                    setSearch(v);
                    setPage(1);
                  }}
                  autoComplete="off"
                />
              </Box>
              <Box width="30%">
                <Select
                  label="Search by"
                  labelHidden
                  options={[{ label: "All", value: "all" }]}
                  value="all"
                  onChange={() => {}}
                />
              </Box>
            </InlineStack>

            <IndexTable
              resourceName={{ singular: "product", plural: "products" }}
              itemCount={items.length}
              selectable={false}
              headings={[
                { title: "Select" },
                { title: "Product" },
                { title: "Status" },
              ]}
            >
              {items.map((item, index) => {
                const checked = selectedProducts.some((p) => p.id === item.id);
                return (
                  <IndexTable.Row id={item.id} key={item.id} position={index}>
                    <IndexTable.Cell>
                      <Checkbox
                        label=""
                        checked={checked}
                        onChange={() => togglePick(item)}
                      />
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="200" blockAlign="center">
                        <Thumbnail
                          source={item.image}
                          alt={item.title}
                          size="small"
                        />
                        <Text>{item.title}</Text>
                      </InlineStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone="success">
                        {item.status || "active"}
                      </Badge>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>

            <InlineStack gap="200" align="space-between" blockAlign="center">
              <Text tone="subdued">
                {selectedProducts.length} products selected
              </Text>
              <InlineStack gap="200">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  disabled={!hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </InlineStack>
            </InlineStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
      <Modal
        open={collectionPickerOpen}
        onClose={() => setCollectionPickerOpen(false)}
        title="Select collections"
        primaryAction={{ content: "Select", onAction: () => setCollectionPickerOpen(false) }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setCollectionPickerOpen(false) },
        ]}
        large
      >
        <Modal.Section>
          <BlockStack gap="300">
            <InlineStack gap="200" wrap={false}>
              <Box width="70%">
                <TextField
                  label="Search collections"
                  labelHidden
                  placeholder="Search collections"
                  value={collectionSearch}
                  onChange={(v) => {
                    setCollectionSearch(v);
                    setCollectionPage(1);
                  }}
                  autoComplete="off"
                />
              </Box>
              <Box width="30%">
                <Select
                  label="Search by"
                  labelHidden
                  options={[{ label: "All", value: "all" }]}
                  value="all"
                  onChange={() => {}}
                />
              </Box>
            </InlineStack>

            <IndexTable
              resourceName={{ singular: "collection", plural: "collections" }}
              itemCount={collectionItems.length}
              selectable={false}
              headings={[
                { title: "Select" },
                { title: "Collection" },
                { title: "Products" },
              ]}
            >
              {collectionItems.map((item, index) => {
                const checked = selectedCollections.some((c) => c.id === item.id);
                return (
                  <IndexTable.Row id={item.id} key={item.id} position={index}>
                    <IndexTable.Cell>
                      <Checkbox
                        label=""
                        checked={checked}
                        onChange={() => toggleCollection(item)}
                      />
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="200" blockAlign="center">
                        <Thumbnail
                          source={item.image}
                          alt={item.title}
                          size="small"
                        />
                        <Text>{item.title}</Text>
                      </InlineStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone="info">
                        {Number(item.productsCount ?? 0)} items
                      </Badge>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>

            <InlineStack gap="200" align="space-between" blockAlign="center">
              <Text tone="subdued">
                {selectedCollections.length} collections selected
              </Text>
              <InlineStack gap="200">
                <Button
                  disabled={collectionPage <= 1}
                  onClick={() => setCollectionPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  disabled={!hasNextCollectionPage}
                  onClick={() => setCollectionPage((p) => p + 1)}
                >
                  Next
                </Button>
              </InlineStack>
            </InlineStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
      {saving && <Loading />}
      {toast.active && (
        <Toast
          content={toast.msg}
          error={toast.error}
          onDismiss={() => setToast((t) => ({ ...t, active: false }))}
          duration={4000}
        />
      )}
    </Frame>
  );
}
