
// app/routes/app.notification.visitor.jsx
import React, { useMemo, useState, useEffect } from "react";
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
  RangeSlider,
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
import {
  useNavigate,
  useFetcher,
  useLocation,
  useLoaderData,
} from "@remix-run/react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { saveVisitorPopup } from "../models/popup-config.server";
import prisma from "../db.server";

const JUDGE_ME_INTEGRATION_KEY = "integration_judge_me";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session?.shop;

  const parseJsonLoose = (raw) => {
    if (raw === undefined || raw === null) return null;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const parseArr = (raw) => {
    const parsed = parseJsonLoose(raw);
    return Array.isArray(parsed) ? parsed : [];
  };
  const parseProductSelections = (source) => {
    const dataProducts = parseArr(source?.selectedDataProductsJson);
    const visibilityProducts = parseArr(source?.selectedVisibilityProductsJson);

    if (dataProducts.length || visibilityProducts.length) {
      return {
        dataProducts,
        visibilityProducts: visibilityProducts.length
          ? visibilityProducts
          : dataProducts,
      };
    }

    const legacy = parseJsonLoose(source?.selectedProductsJson);
    if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
      const legacyData = parseArr(
        legacy.dataProducts ?? legacy.products ?? legacy.selectedProducts
      );
      const legacyVisibility = parseArr(
        legacy.visibilityProducts ?? legacy.visibility ?? legacy.showOnProducts
      );
      return {
        dataProducts: legacyData,
        visibilityProducts: legacyVisibility.length
          ? legacyVisibility
          : legacyData,
      };
    }

    const legacyList = Array.isArray(legacy) ? legacy : parseArr(source?.selectedProductsJson);
    return {
      dataProducts: legacyList,
      visibilityProducts: legacyList,
    };
  };
  const toBool = (v, fallback = false) => {
    if (v === undefined || v === null) return fallback;
    return v === true || v === 1 || v === "1";
  };
  const toNum = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const toStr = (v, fallback = "") =>
    v === undefined || v === null ? fallback : String(v);

  let customerCount = null;
  let saved = null;
  let judgeMeConnected = false;
  let previewCustomer = null;

  try {
    const resp = await admin.graphql(
      "query { customersCount { count } }"
    );
    const payload = await resp.json();
    const count =
      payload?.data?.customersCount?.count ?? payload?.data?.customersCount;
    if (Number.isFinite(Number(count))) {
      customerCount = Number(count);
    }
  } catch (e) {
    console.warn("[Visitor Popup] customer count fetch failed:", e);
  }

  try {
    const resp = await admin.graphql(`
      query PreviewCustomers {
        customers(first: 25, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              firstName
              lastName
              defaultAddress {
                city
                country
              }
            }
          }
        }
      }
    `);
    const payload = await resp.json();
    const edges = Array.isArray(payload?.data?.customers?.edges)
      ? payload.data.customers.edges
      : [];
    const customers = edges
      .map((edge) => edge?.node)
      .filter(Boolean)
      .map((node) => {
        const first_name = String(node?.firstName || "").trim();
        const last_name = String(node?.lastName || "").trim();
        const full_name = [first_name, last_name].filter(Boolean).join(" ").trim();
        const city = String(node?.defaultAddress?.city || "").trim();
        const country = String(node?.defaultAddress?.country || "").trim();
        return { first_name, last_name, full_name, city, country };
      })
      .filter(
        (c) =>
          c.full_name || c.first_name || c.last_name || c.city || c.country
      );

    const preferred =
      customers.find((c) => c.full_name && c.country) ||
      customers.find((c) => c.full_name) ||
      customers[0] ||
      null;

    previewCustomer = preferred;
  } catch (e) {
    console.warn("[Visitor Popup] preview customer fetch failed:", e);
  }

  try {
    const model = prisma?.visitorpopupconfig || prisma?.visitorPopupConfig || null;
    const source =
      shop && model?.findFirst
        ? await model.findFirst({
            where: { shop },
            orderBy: { id: "desc" },
          })
        : null;

    if (source) {
      const { dataProducts, visibilityProducts } = parseProductSelections(source);
      saved = {
        design: {
          notiType: toStr(source.notiType, "visitor_list"),
          layout: toStr(source.layout, "landscape"),
          size: toNum(source.size, 30),
          transparent: toNum(source.transparent, 10),
          template: toStr(source.template, "solid"),
          imageAppearance: toStr(source.imageAppearance, "cover"),
          bgColor: toStr(source.bgColor, "#FFFFFF"),
          bgAlt: toStr(source.bgAlt, "#F3F4F6"),
          textColor: toStr(source.textColor, "#111111"),
          timestampColor: toStr(source.timestampColor, "#696969"),
          priceTagBg: toStr(source.priceTagBg, "#593E3F"),
          priceTagAlt: toStr(source.priceTagAlt, "#E66465"),
          priceColor: toStr(source.priceColor, "#FFFFFF"),
          starColor: toStr(source.starColor, "#FFD240"),
        },
        textSize: {
          content: toStr(source.textSizeContent, "14"),
          compareAt: toStr(source.textSizeCompareAt, "13"),
          price: toStr(source.textSizePrice, "13"),
        },
        content: {
          message: toStr(
            source.message,
            "{full_name} from {country} just viewed this {product_name}"
          ),
          timestamp: toStr(source.timestamp, "Just now"),
          avgTime: toStr(source.avgTime, "2"),
          avgUnit: toStr(source.avgUnit, "mins"),
        },
        productNameMode: toStr(source.productNameMode, "full"),
        productNameLimit: toStr(source.productNameLimit, DEFAULT_PRODUCT_NAME_LIMIT),
        data: {
          directProductPage: toBool(source.directProductPage, true),
          showProductImage: toBool(source.showProductImage, true),
          showPriceTag: toBool(source.showPriceTag, true),
          showRating: toBool(source.showRating, false),
          ratingSource: toStr(source.ratingSource, "judge_me"),
          customerInfo: toStr(source.customerInfo, "shopify"),
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
        selectedDataProducts: dataProducts,
        selectedVisibilityProducts: visibilityProducts,
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
    console.warn("[Visitor Popup] saved config fetch failed:", e);
  }

  return json({
    title: "Visitor Popup",
    customerCount,
    saved,
    judgeMeConnected,
    previewCustomer,
  });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;
  if (!shop) return json({ success: false, error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { form } = body || {};
  if (!form) {
    return json({ success: false, error: "Missing form" }, { status: 400 });
  }

  console.log("[Visitor Popup] form payload:", JSON.stringify(form, null, 2));
  try {
    const saved = await saveVisitorPopup(shop, form);
    console.log("[Visitor Popup] saved id:", saved?.id);
    return json({ success: true, id: saved?.id });
  } catch (e) {
    console.error("[Visitor Popup] save failed:", e);
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

const NOTI_TYPES = [
  { label: "Visitor list", value: "visitor_list" },
  { label: "Visitor counter", value: "visitor_counter" },
];
const LAYOUTS = [
  { label: "Landscape", value: "landscape" },
  { label: "Portrait", value: "portrait" },
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

const TOKEN_OPTIONS = [
  "full_name",
  "first_name",
  "last_name",
  "product_name",
  "country",
  "city",
  "price",
];
const TIME_TOKENS = ["time", "unit"];
const DEFAULT_PRODUCT_NAME_LIMIT = "15";

const VISITOR_STYLES = `
.visitor-shell {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.visitor-sidebar {
  width: 80px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.visitor-nav-btn {
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
.visitor-nav-btn:hover {
  border-color: #cbd5e1;
}
.visitor-nav-btn.is-active {
  background: #2f855a;
  color: #ffffff;
  border-color: #2f855a;
}
.visitor-nav-icon {
  width: 20px;
  height: 20px;
}
.visitor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.visitor-columns {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.visitor-form {
  flex: 1;
  min-width: 360px;
}
.visitor-preview {
  flex: 1;
  min-width: 320px;
}
.visitor-preview-box {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 12px;
  min-height: 340px;
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
.visitor-help {
  margin-top: 24px;
  text-align: center;
  color: #6b7280;
  font-size: 13px;
}
.visitor-help a {
  color: #111827;
  text-decoration: underline;
}
@media (max-width: 1100px) {
  .visitor-shell {
    flex-direction: column;
  }
  .visitor-sidebar {
    width: 100%;
    flex-direction: row;
  }
  .visitor-nav-btn {
    flex: 1;
    flex-direction: row;
    justify-content: center;
  }
  .visitor-columns {
    flex-direction: column;
  }
}
@media (max-width: 640px) {
  .visitor-nav-btn {
    padding: 10px;
    font-size: 12px;
  }
  .visitor-form,
  .visitor-preview {
    min-width: 0;
  }
}
`;

function LayoutIcon() {
  return (
    <svg
      className="visitor-nav-icon"
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
      className="visitor-nav-icon"
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
      className="visitor-nav-icon"
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
      className="visitor-nav-icon"
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
    title: "Antique Drawers",
    image:
      "https://cdn.shopify.com/s/files/1/0000/0001/products/Antique-Drawers.jpg?v=1",
    price: "Rs. 250.00",
    compareAt: "Rs. 300.00",
    rating: 4,
  },
  {
    id: "p2",
    title: "Bedside Table",
    image:
      "https://cdn.shopify.com/s/files/1/0000/0001/products/Bedside-Table.jpg?v=1",
    price: "Rs. 299.00",
    compareAt: "Rs. 349.00",
    rating: 5,
  },
  {
    id: "p3",
    title: "Black Beanbag",
    image:
      "https://cdn.shopify.com/s/files/1/0000/0001/products/Black-Beanbag.jpg?v=1",
    price: "Rs. 449.00",
    compareAt: "Rs. 499.00",
    rating: 4,
  },
  {
    id: "p4",
    title: "Brown Throw Pillows",
    image:
      "https://cdn.shopify.com/s/files/1/0000/0001/products/Brown-Throw-Pillows.jpg?v=1",
    price: "Rs. 129.00",
    compareAt: "Rs. 159.00",
    rating: 3,
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
  const normalized = {};
  if (map && typeof map === "object") {
    for (const [key, val] of Object.entries(map)) {
      normalized[String(key || "").trim().toLowerCase()] = val;
    }
  }
  return String(value || "")
    .trim()
    .replace(/\{([^{}]+)\}/g, (match, rawKey) => {
      const key = String(rawKey || "").trim().toLowerCase();
      return normalized[key] ?? match;
    });
}

function PreviewCard({
  layout,
  size,
  transparency,
  bgColor,
  bgAlt,
  textColor,
  timestampColor,
  priceTagBg,
  priceTagAlt,
  priceColor,
  starColor,
  imageAppearance,
  textSizeContent,
  textSizeCompare,
  textSizePrice,
  contentText,
  timestampText,
  avgTime,
  avgUnit,
  showProductImage,
  showPriceTag,
  showRating,
  showClose,
  product,
  template,
  productNameMode,
  productNameLimit,
  previewCustomer,
}) {
  const scale = 0.8 + (size / 100) * 0.4;
  const opacity = 1 - (transparency / 100) * 0.7;
  const background =
    template === "gradient"
      ? `linear-gradient(135deg, ${bgColor} 0%, ${bgAlt} 100%)`
      : bgColor;

  const isPortrait = layout === "portrait";
  const imageModeRaw = String(imageAppearance || "cover")
    .toLowerCase()
    .trim();
  const isContainMode =
    imageModeRaw === "contain" ||
    imageModeRaw === "contaion" ||
    imageModeRaw.includes("contain") ||
    imageModeRaw.includes("fit");
  const imageFit = isContainMode ? "contain" : "cover";
  const portraitVisitor = isPortrait;
  const avatarSize = isPortrait ? 72 : 64;
  const avatarOffset = Math.round(avatarSize * 0.62);
  const pad = 16;
  const imageOverflow = showProductImage && !isContainMode && !isPortrait;
  const rawName = product?.title || "Your product will show here";
  const safeName = formatProductName(rawName, productNameMode, productNameLimit);
  const templateContent = String(
    contentText || "{full_name} from {country} just viewed this {product_name}"
  );
  const hasProductToken = /\{\s*product_name\s*\}/i.test(templateContent);
  const toText = (v) => String(v ?? "").trim();
  const previewFirst = toText(previewCustomer?.first_name);
  const previewLast = toText(previewCustomer?.last_name);
  const previewFull = toText(previewCustomer?.full_name);
  const previewCity = toText(previewCustomer?.city);
  const previewCountry = toText(previewCustomer?.country);
  const hasRealCustomer = Boolean(
    previewFull ||
      previewFirst ||
      previewLast ||
      previewCity ||
      previewCountry
  );
  const resolvedFullName = hasRealCustomer
    ? previewFull || [previewFirst, previewLast].filter(Boolean).join(" ").trim() || "Someone"
    : "Jenna Doe";
  const resolvedFirstName = hasRealCustomer
    ? previewFirst || (resolvedFullName ? resolvedFullName.split(/\s+/)[0] : "")
    : "Jenna";
  const resolvedLastName = hasRealCustomer
    ? previewLast ||
      (() => {
        const parts = resolvedFullName.split(/\s+/).filter(Boolean);
        return parts.length > 1 ? parts.slice(1).join(" ") : "";
      })()
    : "Doe";
  const tokenValues = {
    full_name: resolvedFullName,
    first_name: resolvedFirstName,
    last_name: resolvedLastName,
    product_name: safeName,
    country: hasRealCustomer ? previewCountry : "United States",
    city: hasRealCustomer ? previewCity : "New York",
    price: product?.price || "Rs. 299.00",
    time: String(avgTime || "2"),
    unit: String(avgUnit || "mins"),
  };
  const resolvedContent = resolveTemplate(templateContent, tokenValues);
  const resolvedTimestamp = resolveTemplate(
    timestampText || "Just now",
    tokenValues
  );
  const contentNode = (() => {
    const normalized = {};
    Object.entries(tokenValues).forEach(([k, v]) => {
      normalized[String(k || "").trim().toLowerCase()] = v;
    });
    const rx = /\{([^{}]+)\}/g;
    const out = [];
    let idx = 0;
    let last = 0;
    let found = false;
    let m = null;
    while ((m = rx.exec(templateContent))) {
      found = true;
      const key = String(m[1] || "").trim().toLowerCase();
      let before = templateContent.slice(last, m.index);
      if (key === "product_name" && before) {
        before = before.replace(/\s+$/, "");
      }
      if (before) out.push(<span key={`t-${idx++}`}>{before}</span>);
      if (key === "product_name") {
        out.push(<br key={`br-${idx++}`} />);
      }
      const rawVal = normalized[key];
      const valueText =
        rawVal === undefined || rawVal === null || rawVal === ""
          ? m[0]
          : String(rawVal);
      const tokenStyle =
        key === "product_name"
          ? { fontWeight: 700, textDecoration: "underline" }
          : { fontWeight: 700 };
      out.push(
        <span key={`v-${idx++}`} style={tokenStyle}>
          {valueText}
        </span>
      );
      last = m.index + m[0].length;
    }
    if (!found) return resolvedContent;
    const tail = templateContent.slice(last);
    if (tail) out.push(<span key={`t-${idx++}`}>{tail}</span>);
    return out;
  })();
  const cardStyle = {
    transform: `scale(${scale})`,
    opacity,
    background,
    color: textColor,
    borderRadius: 18,
    boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
    border: "1px solid rgba(0,0,0,0.06)",
    padding: pad,
    paddingLeft: imageOverflow ? pad + avatarOffset : pad,
    display: "flex",
    position: "relative",
    flexDirection: isPortrait ? "column" : "row",
    gap: isPortrait ? 14 : imageOverflow ? 14 : 12,
    alignItems: "flex-start",
    maxWidth: layout === "portrait" ? 360 : 460,
  };

  return (
    <div style={cardStyle}>
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
              background: portraitVisitor ? "#ffffff" : "#f3f4f6",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              boxShadow: portraitVisitor
                ? "0 10px 22px rgba(0,0,0,0.14)"
                : "0 6px 14px rgba(0,0,0,0.12)",
              border: "1px solid rgba(15,23,42,0.08)",
              alignSelf: isPortrait ? "center" : "flex-start",
              margin: portraitVisitor ? "2px auto 2px" : undefined,
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

      <div
        style={{
          display: "grid",
          gap: portraitVisitor ? 8 : 6,
          minWidth: 0,
          flex: 1,
          width: portraitVisitor ? "100%" : undefined,
        }}
      >
        {showRating && (
          <div
            style={{
              color: starColor,
              fontSize: portraitVisitor ? 18 : 12,
              lineHeight: 1,
            }}
          >
            {"★".repeat(Math.max(0, Math.min(5, product?.rating || 4)))}
            <span style={{ color: "#9ca3af" }}>
              {"★".repeat(Math.max(0, 5 - (product?.rating || 4)))}
            </span>
          </div>
        )}
        <div style={{ fontSize: textSizeContent, fontWeight: 400 }}>
          {contentNode}
        </div>
        {!hasProductToken && (
          <div
            style={{
              fontSize: textSizeContent,
              fontWeight: 600,
              textDecoration: "underline",
              lineHeight: 1.4,
            }}
          >
            {safeName}
          </div>
        )}
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
              {product?.price || "Rs. 299.00"}
            </span>
            <span
              style={{
                color: priceTagAlt,
                fontSize: textSizeCompare,
                textDecoration: "line-through",
              }}
            >
              {product?.compareAt || "Rs. 349.00"}
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
export default function VisitorPopupPage() {
  const { customerCount, saved, judgeMeConnected, previewCustomer } = useLoaderData();
  const navigate = useNavigate();
  const location = useLocation();
  const notificationUrl = `/app/notification${location.search || ""}`;
  const notificationManageUrl = `/app/notification/manage${location.search || ""}`;
  const [activeSection, setActiveSection] = useState("layout");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ active: false, error: false, msg: "" });

  const [design, setDesign] = useState({
    notiType: "visitor_list",
    layout: "landscape",
    size: 30,
    transparent: 10,
    template: "solid",
    imageAppearance: "cover",
    bgColor: "#FFFFFF",
    bgAlt: "#F3F4F6",
    textColor: "#111111",
    timestampColor: "#696969",
    priceTagBg: "#593E3F",
    priceTagAlt: "#E66465",
    priceColor: "#FFFFFF",
    starColor: "#FFD240",
  });

  const [textSize, setTextSize] = useState({
    content: "14",
    compareAt: "13",
    price: "13",
  });

  const [content, setContent] = useState({
    message: "{full_name} from {country} just viewed this {product_name}",
    timestamp: "Just now",
    avgTime: "2",
    avgUnit: "mins",
  });
  const [productNameMode, setProductNameMode] = useState("full");
  const [productNameLimit, setProductNameLimit] = useState(
    DEFAULT_PRODUCT_NAME_LIMIT
  );

  const [data, setData] = useState({
    directProductPage: true,
    showProductImage: true,
    showPriceTag: true,
    showRating: false,
    ratingSource: "judge_me",
    customerInfo: "shopify",
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

  const productFetcher = useFetcher();
  const collectionFetcher = useFetcher();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [page, setPage] = useState(1);
  const [collectionPage, setCollectionPage] = useState(1);
  const [hasLoadedProducts, setHasLoadedProducts] = useState(false);
  const [hasLoadedCollections, setHasLoadedCollections] = useState(false);

  const [selectedDataProducts, setSelectedDataProducts] = useState([]);
  const [selectedVisibilityProducts, setSelectedVisibilityProducts] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [pickerMode, setPickerMode] = useState("data");

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

    setSelectedDataProducts(
      Array.isArray(saved.selectedDataProducts) ? saved.selectedDataProducts : []
    );
    setSelectedVisibilityProducts(
      Array.isArray(saved.selectedVisibilityProducts)
        ? saved.selectedVisibilityProducts
        : []
    );
    setSelectedCollections(
      Array.isArray(saved.selectedCollections) ? saved.selectedCollections : []
    );
  }, [saved]);

  useEffect(() => {
    if (hasLoadedProducts) return;
    const params = new URLSearchParams();
    params.set("page", "1");
    productFetcher.load(`/app/products-picker?${params.toString()}`);
    setHasLoadedProducts(true);
  }, [hasLoadedProducts, productFetcher]);

  useEffect(() => {
    if (!pickerOpen) return;
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("page", String(page));
    productFetcher.load(`/app/products-picker?${params.toString()}`);
  }, [pickerOpen, search, page, productFetcher]);

  useEffect(() => {
    if (hasLoadedCollections) return;
    const params = new URLSearchParams();
    params.set("page", "1");
    collectionFetcher.load(`/app/collections-picker?${params.toString()}`);
    setHasLoadedCollections(true);
  }, [hasLoadedCollections, collectionFetcher]);

  useEffect(() => {
    if (!collectionPickerOpen) return;
    const params = new URLSearchParams();
    if (collectionSearch) params.set("q", collectionSearch);
    params.set("page", String(collectionPage));
    collectionFetcher.load(`/app/collections-picker?${params.toString()}`);
  }, [collectionPickerOpen, collectionSearch, collectionPage, collectionFetcher]);

  const storeProducts = useMemo(() => {
    const items = productFetcher.data?.items || [];
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
  }, [productFetcher.data]);

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

  const fallbackProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return MOCK_PRODUCTS;
    return MOCK_PRODUCTS.filter((p) => p.title.toLowerCase().includes(term));
  }, [search]);

  const products = storeProducts.length ? storeProducts : fallbackProducts;

  const needsProductSelection =
    visibility.productScope === "specific" &&
    selectedVisibilityProducts.length === 0;
  const needsCollectionSelection =
    visibility.collectionScope === "specific" &&
    selectedCollections.length === 0;

  const preferredDataProduct = selectedDataProducts[0] || null;
  const preferredVisibilityProduct = selectedVisibilityProducts[0] || null;
  const scopedProduct =
    visibility.productScope === "specific" ? preferredVisibilityProduct : null;
  const scopedCollectionProduct =
    visibility.collectionScope === "specific"
      ? selectedCollections[0]?.sampleProduct
      : null;
  const previewProduct =
    preferredDataProduct ||
    scopedProduct ||
    scopedCollectionProduct ||
    storeProducts[0] ||
    null;
  const previewMessage = needsProductSelection
    ? "Select a product to preview."
    : needsCollectionSelection
      ? "Select a collection to preview."
      : !previewProduct
        ? "Preview will appear once a product is available."
        : null;

  const togglePick = (item, mode = pickerMode) => {
    const id = typeof item === "object" ? item?.id : item;
    if (!id) return;
    const setSelection =
      mode === "visibility" ? setSelectedVisibilityProducts : setSelectedDataProducts;
    setSelection((prev) => {
      const exists = prev.some((p) => p.id === id);
      if (exists) return prev.filter((p) => p.id !== id);
      if (typeof item === "object") return [...prev, item];
      return prev;
    });
  };

  const openProductPicker = (mode) => {
    setPickerMode(mode === "visibility" ? "visibility" : "data");
    setPickerOpen(true);
  };

  const activeProductSelection =
    pickerMode === "visibility" ? selectedVisibilityProducts : selectedDataProducts;
  const selectedProductCount = activeProductSelection.length;

  const toggleCollection = (item) => {
    setSelectedCollections((prev) => {
      const exists = prev.some((c) => c.id === item.id);
      if (exists) return prev.filter((c) => c.id !== item.id);
      return [...prev, item];
    });
  };

  const hasNextPage = Boolean(productFetcher.data?.hasNextPage);
  const hasNextCollectionPage = Boolean(collectionFetcher.data?.hasNextPage);
  const collectionItems = storeCollections;

  const insertToken = (token) => {
    setContent((c) => ({
      ...c,
      message: `${c.message}${c.message ? " " : ""}{${token}}`,
    }));
  };

  const insertTimeToken = (token) => {
    setContent((c) => ({
      ...c,
      timestamp: `${c.timestamp}${c.timestamp ? " " : ""}{${token}}`,
    }));
  };
  const customerInfoText = Number.isFinite(customerCount)
    ? `${customerCount} customer profile${
        customerCount === 1 ? "" : "s"
      } are imported automatically from Shopify.`
    : "Customer profiles are imported automatically from Shopify.";

  const save = async () => {
    setSaving(true);
    try {
      if (
        visibility.productScope === "specific" &&
        selectedVisibilityProducts.length === 0
      ) {
        setToast({
          active: true,
          error: true,
          msg: "Please select at least 1 visibility product before saving.",
        });
        setSaving(false);
        return;
      }
      const endpoint = `${location.pathname}${location.search || ""}`;
      const form = {
        enabled: true,
        design,
        textSize,
        content,
        productNameMode,
        productNameLimit,
        data,
        visibility,
        behavior,
        selectedDataProducts,
        selectedVisibilityProducts,
        selectedProducts: selectedDataProducts,
        selectedCollections,
      };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ form }),
      });
      const raw = await res.text();
      let out = null;
      if (raw) {
        try {
          out = JSON.parse(raw);
        } catch {
          out = null;
        }
      }
      const isExplicitFailure = out?.success === false;
      if (!res.ok || isExplicitFailure) {
        const msg =
          out?.error ||
          (raw && raw.length < 240 ? raw : "") ||
          "Save failed";
        throw new Error(msg);
      }
      setToast({ active: true, error: false, msg: "Saved." });
      setTimeout(() => navigate(notificationManageUrl), 900);
    } catch (e) {
      setToast({
        active: true,
        error: true,
        msg: e?.message || "Save failed",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Frame>
      <Page
        title="Update Visitor notification"
        backAction={{ content: "Back", onAction: () => navigate(notificationUrl) }}
        primaryAction={{ content: "Save", onAction: save, loading: saving }}
      >
        <style>{VISITOR_STYLES}</style>
        <div className="visitor-shell">
          <div className="visitor-sidebar">
            {NAV_ITEMS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`visitor-nav-btn ${activeSection === id ? "is-active" : ""}`}
                onClick={() => setActiveSection(id)}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="visitor-main">
            <div className="visitor-columns">
              <div className="visitor-form">
                <BlockStack gap="400">
                  {activeSection === "layout" && (
                    <>
                      <Card>
                <Box padding="4">
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingMd">
                      Design
                    </Text>
                    <InlineStack gap="400" wrap={false}>
                      {/* <Box width="50%">
                        <Select
                          label="Noti type"
                          options={NOTI_TYPES}
                          value={design.notiType}
                          onChange={(v) =>
                            setDesign((d) => ({ ...d, notiType: v }))
                          }
                        />
                      </Box> */}
                      <Box width="100%">
                        <Select
                          label="Layout"
                          options={LAYOUTS}
                          value={design.layout}
                          onChange={(v) =>
                            setDesign((d) => ({ ...d, layout: v }))
                          }
                        />
                      </Box>
                    </InlineStack>

                    <BlockStack gap="200">
                      <Text>Size</Text>
                      <RangeSlider
                        min={0}
                        max={100}
                        value={design.size}
                        onChange={(v) =>
                          setDesign((d) => ({ ...d, size: v }))
                        }
                      />
                    </BlockStack>

                    <BlockStack gap="200">
                      <Text>Transparent</Text>
                      <RangeSlider
                        min={0}
                        max={100}
                        value={design.transparent}
                        onChange={(v) =>
                          setDesign((d) => ({ ...d, transparent: v }))
                        }
                      />
                    </BlockStack>

                    <ChoiceList
                      title="Color template"
                      choices={[
                        { label: "Solid", value: "solid" },
                        { label: "Gradient", value: "gradient" },
                      ]}
                      selected={[design.template]}
                      onChange={(v) =>
                        setDesign((d) => ({ ...d, template: v[0] }))
                      }
                    />

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
                          fallback="#111111"
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
                            setDesign((d) => ({ ...d, timestampColor: v }))
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
                            setDesign((d) => ({ ...d, priceTagBg: v }))
                          }
                        />
                      </Box>
                      <Box width="50%">
                        <ColorField
                          label="Price tag background (alt)"
                          value={design.priceTagAlt}
                          fallback="#E66465"
                          onChange={(v) =>
                            setDesign((d) => ({ ...d, priceTagAlt: v }))
                          }
                        />
                      </Box>
                    </InlineStack>

                    <InlineStack gap="400" wrap={false}>
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
                      <Box width="50%">
                        <ColorField
                          label="Star color"
                          value={design.starColor}
                          fallback="#FFD240"
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
                        {
                          label: "Fit within container",
                          value: "contain",
                        },
                      ]}
                      selected={[design.imageAppearance]}
                      onChange={(v) =>
                        setDesign((d) => ({
                          ...d,
                          imageAppearance: v[0] || "cover",
                        }))
                      }
                    />
                  </BlockStack>
                </Box>
                      </Card>
                    </>
                  )}
                  {activeSection === "layout" && (
                    <>
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
                            setTextSize((s) => ({ ...s, content: v }))
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
                            setTextSize((s) => ({ ...s, compareAt: v }))
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
                      label="Notification content"
                      value={content.message}
                      onChange={(v) =>
                        setContent((c) => ({ ...c, message: v }))
                      }
                      multiline={4}
                      autoComplete="off"
                      helpText={`${content.message.length}/250`}
                    />
                    <InlineStack gap="150" wrap>
                      {TOKEN_OPTIONS.map((token) => (
                        <button
                          key={token}
                          type="button"
                          className="token-pill"
                          onClick={() => insertToken(token)}
                        >
                          {token}
                        </button>
                      ))}
                    </InlineStack>
                    <BlockStack gap="200">
                      <Text as="p" variant="bodySm">
                        Product name display
                      </Text>
                      <InlineStack gap="400">
                        <RadioButton
                          id="product-name-full"
                          name="product_name_mode"
                          label="Show full product name"
                          checked={productNameMode === "full"}
                          onChange={() => setProductNameMode("full")}
                        />
                        <RadioButton
                          id="product-name-half"
                          name="product_name_mode"
                          label="Show half product name"
                          checked={productNameMode === "half"}
                          onChange={() => setProductNameMode("half")}
                        />
                      </InlineStack>
                      {productNameMode === "half" && (
                        <Box width="50%">
                          <TextField
                            label="Character limit"
                            type="number"
                            value={productNameLimit}
                            onChange={setProductNameLimit}
                            autoComplete="off"
                          />
                        </Box>
                      )}
                    </BlockStack>

                    <TextField
                      label="Timestamp"
                      value={content.timestamp}
                      onChange={(v) =>
                        setContent((c) => ({ ...c, timestamp: v }))
                      }
                      autoComplete="off"
                      helpText={`${content.timestamp.length}/30`}
                    />
                    <InlineStack gap="150" wrap>
                      {TIME_TOKENS.map((token) => (
                        <button
                          key={token}
                          type="button"
                          className="token-pill"
                          onClick={() => insertTimeToken(token)}
                        >
                          {token}
                        </button>
                      ))}
                    </InlineStack>

                    <InlineStack gap="400" wrap={false}>
                      <Box width="50%">
                        <TextField
                          label="Average time"
                          value={content.avgTime}
                          onChange={(v) =>
                            setContent((c) => ({ ...c, avgTime: v }))
                          }
                          autoComplete="off"
                        />
                      </Box>
                      <Box width="50%">
                        <Select
                          label=" "
                          labelHidden
                          options={TIME_UNITS}
                          value={content.avgUnit}
                          onChange={(v) =>
                            setContent((c) => ({ ...c, avgUnit: v }))
                          }
                        />
                      </Box>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">
                      Time will be randomized around this time
                    </Text>
                  </BlockStack>
                </Box>
              </Card>
              <Card>
                <Box padding="4">
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">
                      Data (maximum 250 entries)
                    </Text>
                    <InlineStack align="space-between" blockAlign="center" wrap>
                      <Button onClick={() => openProductPicker("data")}>
                        Browse products
                      </Button>
                      <Text tone="subdued">
                        {selectedDataProducts.length} products selected
                      </Text>
                    </InlineStack>
                    <BlockStack gap="150">
                      <Checkbox
                        label="Notification direct to specific product page"
                        checked={data.directProductPage}
                        onChange={(v) =>
                          setData((d) => ({ ...d, directProductPage: v }))
                        }
                      />
                      <Checkbox
                        label="Show product/avatar image"
                        checked={data.showProductImage}
                        onChange={(v) =>
                          setData((d) => ({ ...d, showProductImage: v }))
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

                    {data.showRating && (
                      <BlockStack gap="200">
                        <Select
                          label="Rating source"
                          options={[
                            { label: "Judge.me", value: "judge_me" },
                          ]}
                          value={data.ratingSource}
                          onChange={(v) =>
                            setData((d) => ({ ...d, ratingSource: v }))
                          }
                        />
                        {data.ratingSource === "judge_me" &&
                          (judgeMeConnected ? (
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
                              variant="primary"
                              onClick={() =>
                                navigate(`/app/integrations${location.search || ""}`)
                              }
                            >
                              Connect with Judge.me
                            </Button>
                          ))}
                      </BlockStack>
                    )}

                    <Text as="h4" variant="headingSm">
                      Customer info
                    </Text>
                    <BlockStack gap="150">
                      <div>
                        <RadioButton
                          id="customer-info-shopify"
                          name="customer_info"
                          label="Data from Shopify"
                          checked={data.customerInfo === "shopify"}
                          onChange={() =>
                            setData((d) => ({ ...d, customerInfo: "shopify" }))
                          }
                          disabled
                        />
                        <div style={{ marginLeft: 28 }}>
                          <Text tone="subdued">
                            {customerInfoText}
                          </Text>
                        </div>
                      </div>
                    </BlockStack>

                    {selectedDataProducts.length > 0 && (
                      <BlockStack gap="200">
                        <Text as="h4" variant="headingSm">
                          Selected products
                        </Text>
                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 10,
                            padding: 8,
                            maxHeight: 240,
                            overflow: "auto",
                          }}
                        >
                          <BlockStack gap="200">
                            {selectedDataProducts.map((item) => (
                              <InlineStack
                                key={item.id}
                                align="space-between"
                                blockAlign="center"
                              >
                                <InlineStack gap="200" blockAlign="center">
                                  <Thumbnail
                                    source={item.image}
                                    alt={item.title}
                                    size="small"
                                  />
                                  <Text>{item.title}</Text>
                                </InlineStack>
                                <Button
                                  tone="critical"
                                  variant="plain"
                                  onClick={() => togglePick(item.id, "data")}
                                >
                                  Remove
                                </Button>
                              </InlineStack>
                            ))}
                          </BlockStack>
                        </div>
                      </BlockStack>
                    )}
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
                            setVisibility((s) => ({ ...s, productScope: "all" }))
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
                            <Button onClick={() => openProductPicker("visibility")}>
                              Select Product
                            </Button>
                            <Text tone="subdued">
                              {selectedVisibilityProducts.length} products selected
                            </Text>
                          </InlineStack>
                        )}
                      </div>
                      <Checkbox
                        label="Collection list"
                        checked={visibility.showCollectionList}
                        onChange={(v) =>
                          setVisibility((s) => ({ ...s, showCollectionList: v }))
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
                      label="Display a close button"
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
                            setBehavior((b) => ({ ...b, intervalUnit: v }))
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
              <div className="visitor-preview">
            <Card>
              <Box padding="4">
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Preview
                  </Text>
                  <div className="visitor-preview-box">
                    {previewMessage ? (
                      <div style={{ textAlign: "center" }}>
                        <Text as="p" tone="subdued">
                          {previewMessage}
                        </Text>
                      </div>
                    ) : (
                      <PreviewCard
                        layout={design.layout}
                        size={design.size}
                        transparency={design.transparent}
                        bgColor={normalizeHex(design.bgColor, "#FFFFFF")}
                        bgAlt={normalizeHex(design.bgAlt, "#F3F4F6")}
                        textColor={normalizeHex(design.textColor, "#111111")}
                        timestampColor={normalizeHex(
                          design.timestampColor,
                          "#696969"
                        )}
                        priceTagBg={normalizeHex(design.priceTagBg, "#593E3F")}
                        priceTagAlt={normalizeHex(
                          design.priceTagAlt,
                          "#E66465"
                        )}
                        priceColor={normalizeHex(design.priceColor, "#FFFFFF")}
                        starColor={normalizeHex(design.starColor, "#FFD240")}
                        imageAppearance={design.imageAppearance}
                        textSizeContent={Number(textSize.content) || 14}
                        textSizeCompare={Number(textSize.compareAt) || 13}
                        textSizePrice={Number(textSize.price) || 13}
                        contentText={content.message}
                        timestampText={content.timestamp}
                        avgTime={content.avgTime}
                        avgUnit={content.avgUnit}
                        showProductImage={data.showProductImage}
                        showPriceTag={data.showPriceTag}
                        showRating={data.showRating}
                        showClose={behavior.showClose}
                        product={previewProduct}
                        template={design.template}
                        productNameMode={productNameMode}
                        productNameLimit={productNameLimit}
                        previewCustomer={previewCustomer}
                      />
                    )}
                  </div>
                </BlockStack>
              </Box>
            </Card>
              </div>
            </div>
            <div className="visitor-help">
              We're here to help! Contact support or refer to the{" "}
              <a href="#">User guide</a>
            </div>
          </div>
        </div>
      </Page>
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={
          pickerMode === "visibility"
            ? "Select products for visibility"
            : "Select products for popup data"
        }
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
              itemCount={products.length}
              selectable={false}
              headings={[
                { title: "Select" },
                { title: "Product" },
                { title: "Status" },
              ]}
            >
              {products.map((item, index) => {
                const checked = activeProductSelection.some((p) => p.id === item.id);
                return (
                  <IndexTable.Row id={item.id} key={item.id} position={index}>
                    <IndexTable.Cell>
                      <Checkbox
                        label=""
                        checked={checked}
                        onChange={() => togglePick(item, pickerMode)}
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
                      <Badge tone="success">active</Badge>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>

            <InlineStack gap="200" align="space-between" blockAlign="center">
              <Text tone="subdued">
                {selectedProductCount} products selected
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
