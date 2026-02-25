// app/routes/app.notification.addtocart.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Page,
  Card,
  Button,
  ChoiceList,
  TextField,
  Select,
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
import { useNavigate, useFetcher, useLocation, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { saveAddToCartPopup } from "../models/popup-config.server";
import prisma from "../db.server";

const SAMPLE_ADD_TO_CART_CUSTOMER = Object.freeze({
  first_name: "Jenna",
  last_name: "Doe",
  full_name: "Jenna Doe",
  city: "New York",
  country: "United States",
});

const errorText = (value, fallback = "Save failed") => {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value.message === "string" && value.message.trim()) {
    return value.message;
  }
  if (value && typeof value === "object") {
    try {
      const s = JSON.stringify(value);
      if (s && s !== "{}") return s;
    } catch {}
  }
  return fallback;
};
const DATA_PRODUCT_REQUIRED_MSG = "Please choose at least 1 product in Product info";
const isValidSelectedProduct = (item) => {
  if (!item) return false;
  if (typeof item === "string") return String(item).trim().length > 0;
  if (typeof item === "object") {
    return Boolean(String(item.id || item.handle || item.title || "").trim());
  }
  return false;
};
const hasAnyValidSelectedProduct = (list) =>
  Array.isArray(list) && list.some(isValidSelectedProduct);

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

const isMissingColumnError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const msg = String(error?.message || "").toLowerCase();
  return (
    code === "P2022" ||
    msg.includes("unknown column") ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_SCHEMA_FALLBACK_ATTEMPTS = 30;

const normalizeColumnName = (value) => {
  const raw = String(value || "")
    .replace(/[`'"]/g, "")
    .trim();
  if (!raw) return "";
  const parts = raw.split(".");
  return parts[parts.length - 1] || "";
};

const extractMissingColumn = (error) => {
  const fromMeta = normalizeColumnName(error?.meta?.column);
  if (fromMeta) return fromMeta;

  const msg = String(error?.message || "");
  const patterns = [
    /unknown column ['`"]([^'`"]+)['`"]/i,
    /the column ['`"]([^'`"]+)['`"] does not exist/i,
    /column ['`"]([^'`"]+)['`"] does not exist/i,
  ];
  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match?.[1]) return normalizeColumnName(match[1]);
  }
  return "";
};

const removeSelectKey = (select, column) => {
  if (!column) return false;
  if (Object.prototype.hasOwnProperty.call(select, column)) {
    delete select[column];
    return true;
  }
  return false;
};

const ADD_TO_CART_LEGACY_SELECT = {
  id: true,
  layout: true,
  size: true,
  transparent: true,
  template: true,
  imageAppearance: true,
  bgColor: true,
  bgAlt: true,
  textColor: true,
  timestampColor: true,
  priceTagBg: true,
  priceTagAlt: true,
  priceColor: true,
  starColor: true,
  textSizeContent: true,
  textSizeCompareAt: true,
  textSizePrice: true,
  message: true,
  timestamp: true,
  avgTime: true,
  avgUnit: true,
  productNameMode: true,
  productNameLimit: true,
  dataSource: true,
  customerInfo: true,
  stockUnder: true,
  hideOutOfStock: true,
  directProductPage: true,
  showProductImage: true,
  showPriceTag: true,
  showRating: true,
  showHome: true,
  showProduct: true,
  productScope: true,
  showCollectionList: true,
  showCollection: true,
  collectionScope: true,
  showCart: true,
  position: true,
  showClose: true,
  hideOnMobile: true,
  delay: true,
  duration: true,
  interval: true,
  intervalUnit: true,
  randomize: true,
  selectedDataProductsJson: true,
  selectedVisibilityProductsJson: true,
  selectedProductsJson: true,
  selectedCollectionsJson: true,
};

async function findFirstWithSelectFallback(model, findArgs, baseSelect) {
  let select =
    baseSelect && typeof baseSelect === "object" ? { ...baseSelect } : null;

  for (let attempt = 0; attempt < MAX_SCHEMA_FALLBACK_ATTEMPTS; attempt += 1) {
    try {
      if (select && Object.keys(select).length) {
        return await model.findFirst({ ...findArgs, select });
      }
      return await model.findFirst(findArgs);
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      if (!select) throw error;

      const missing = extractMissingColumn(error);
      const removed = removeSelectKey(select, missing);
      if (!removed) {
        const fallbackKey = Object.keys(select).find((key) => key !== "id");
        if (!fallbackKey) return null;
        delete select[fallbackKey];
      }

      console.warn("[AddToCart Popup] loader missing-column fallback:", {
        removedColumn: missing || null,
        selectedKeys: Object.keys(select).length,
      });
    }
  }

  return null;
}

async function saveWithRetry(shop, form, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await saveAddToCartPopup(shop, form);
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === retries) break;
      await sleep(200 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function loader({ request }) {
  let admin;
  let session;
  try {
    ({ admin, session } = await authenticate.admin(request));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("[AddToCart Popup] auth failed in loader:", error);
    return json({
      title: "Add to cart Popup",
      saved: null,
      customerCount: null,
      firstProduct: null,
      previewCustomer: SAMPLE_ADD_TO_CART_CUSTOMER,
    });
  }
  const shop = session?.shop;
  const reqUrl = new URL(request.url);
  const editIdRaw = reqUrl.searchParams.get("editId") || reqUrl.searchParams.get("id");
  const editIdNum = Number(editIdRaw);
  const editId = Number.isInteger(editIdNum) && editIdNum > 0 ? editIdNum : null;

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
        legacy.dataProducts ?? legacy.selectedProducts ?? legacy.products
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

    const legacyList = Array.isArray(legacy)
      ? legacy
      : parseArr(source?.selectedProductsJson);
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

  let saved = null;
  let customerCount = null;
  let firstProduct = null;
  let previewCustomer = null;

  try {
    if (admin?.graphql) {
      const countRes = await admin.graphql(`
        query AddToCartLoaderMeta {
          customersCount {
            count
          }
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
          products(first: 1, sortKey: TITLE) {
            edges {
              node {
                id
                title
                handle
                status
                featuredImage { url altText }
                variants(first: 1) {
                  edges {
                    node {
                      price
                      compareAtPrice
                    }
                  }
                }
              }
            }
          }
        }
      `);
      const countJson = await countRes.json();
      const count = Number(countJson?.data?.customersCount?.count);
      customerCount = Number.isFinite(count) ? count : null;
      const customerEdges = Array.isArray(countJson?.data?.customers?.edges)
        ? countJson.data.customers.edges
        : [];
      const customers = customerEdges
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
      previewCustomer =
        customers.find((c) => c.full_name && c.country) ||
        customers.find((c) => c.full_name) ||
        customers[0] ||
        null;
      const node = countJson?.data?.products?.edges?.[0]?.node;
      if (node) {
        const variant = node?.variants?.edges?.[0]?.node || null;
        firstProduct = {
          id: node.id,
          title: node.title,
          handle: node.handle || null,
          image: node.featuredImage?.url || null,
          status: node.status || "ACTIVE",
          price: variant?.price || null,
          compareAt: variant?.compareAtPrice || null,
          rating: 4,
        };
      }
    }

    const model = prisma?.addtocartpopupconfig || prisma?.addToCartPopupConfig || null;
    let source = null;
    if (shop && model?.findFirst) {
      const findArgs = editId
        ? {
            where: { id: editId, shop },
          }
        : {
            where: { shop },
            orderBy: { id: "desc" },
          };
      try {
        source = await model.findFirst(findArgs);
      } catch (error) {
        if (!isMissingColumnError(error)) throw error;
        source = await findFirstWithSelectFallback(
          model,
          findArgs,
          ADD_TO_CART_LEGACY_SELECT
        );
      }
    }

    if (source) {
      const { dataProducts, visibilityProducts } = parseProductSelections(source);
      saved = {
        id: source.id,
        design: {
          layout: toStr(source.layout, "landscape"),
          size: toNum(source.size, 60),
          transparent: toNum(source.transparent, 10),
          template: toStr(source.template, "gradient"),
          imageAppearance: toStr(source.imageAppearance, "contain"),
          bgColor: toStr(source.bgColor, "#CCC01E"),
          bgAlt: toStr(source.bgAlt, "#7E6060"),
          textColor: toStr(source.textColor, "#F9EEEE"),
          timestampColor: toStr(source.timestampColor, "#FBF9F9"),
          priceTagBg: toStr(source.priceTagBg, "#593E3F"),
          priceTagAlt: toStr(source.priceTagAlt, "#E66465"),
          priceColor: toStr(source.priceColor, "#FFFFFF"),
          starColor: toStr(source.starColor, "#F06663"),
        },
        textSize: {
          content: toStr(source.textSizeContent, "14"),
          compareAt: toStr(source.textSizeCompareAt, "12"),
          price: toStr(source.textSizePrice, "12"),
        },
        content: {
          message: toStr(
            source.message,
            "{full_name} from {country} added {product_name} to cart"
          ),
          timestamp: toStr(source.timestamp, "{time} {unit} ago"),
          avgTime: toStr(source.avgTime, "3"),
          avgUnit: toStr(source.avgUnit, "mins"),
        },
        productNameMode: toStr(source.productNameMode, "full"),
        productNameLimit: toStr(source.productNameLimit, DEFAULT_PRODUCT_NAME_LIMIT),
        data: {
          dataSource: toStr(source.dataSource, "shopify"),
          customerInfo: toStr(source.customerInfo, "shopify"),
          stockUnder: toStr(source.stockUnder, "10"),
          hideOutOfStock: toBool(source.hideOutOfStock, true),
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
          position: toStr(source.position, "top-right"),
        },
        behavior: {
          showClose: toBool(source.showClose, true),
          hideOnMobile: toBool(source.hideOnMobile, false),
          delay: toStr(source.delay, "1"),
          duration: toStr(source.duration, "10"),
          interval: toStr(source.interval, "5"),
          intervalUnit: toStr(source.intervalUnit, "seconds"),
          randomize: toBool(source.randomize, true),
        },
        selectedDataProducts: dataProducts,
        selectedVisibilityProducts: visibilityProducts,
        // Keep legacy key for backward compatibility with older client payloads.
        selectedProducts: dataProducts,
        selectedCollections: parseArr(source.selectedCollectionsJson),
      };
    }
  } catch (e) {
    console.warn("[AddToCart Popup] saved config fetch failed:", e);
  }
  if (!previewCustomer) {
    previewCustomer = SAMPLE_ADD_TO_CART_CUSTOMER;
  }

  return json({
    title: "Add to cart Popup",
    saved,
    customerCount,
    firstProduct,
    previewCustomer,
  });
}

export async function action({ request }) {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (error) {
    console.error("[AddToCart Popup] auth failed:", error);
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
  const selectedDataProducts = Array.isArray(form?.selectedDataProducts)
    ? form.selectedDataProducts
    : Array.isArray(form?.selectedProducts)
      ? form.selectedProducts
      : [];
  if (!hasAnyValidSelectedProduct(selectedDataProducts)) {
    return json(
      {
        success: false,
        error: DATA_PRODUCT_REQUIRED_MSG,
      },
      { status: 400 }
    );
  }

  console.log("[AddToCart Popup] form payload:", JSON.stringify(form, null, 2));
  try {
    const saved = await saveWithRetry(shop, form, 2);
    console.log("[AddToCart Popup] saved id:", saved?.id);
    return json({ success: true, id: saved?.id });
  } catch (e) {
    console.error("[AddToCart Popup] save failed:", e);
    return json(
      {
        success: false,
        error: errorText(e),
        code: e?.code || null,
      },
      { status: 500 }
    );
  }
}

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

const CONTENT_TOKENS = [
  "full_name",
  "first_name",
  "last_name",
  "country",
  "city",
  "product_name",
  "product_price",
];
const TIME_TOKENS = ["time", "unit"];
const DEFAULT_PRODUCT_NAME_LIMIT = "15";
const PRODUCT_PICKER_TARGETS = {
  data: "data",
  visibility: "visibility",
};

const LOW_STOCK_STYLES = `
.lowstock-shell {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.lowstock-sidebar {
  width: 80px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lowstock-nav-btn {
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
.lowstock-nav-btn:hover {
  border-color: #cbd5e1;
}
.lowstock-nav-btn.is-active {
  background: #2f855a;
  color: #ffffff;
  border-color: #2f855a;
}
.lowstock-nav-icon {
  width: 20px;
  height: 20px;
}
.lowstock-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.lowstock-columns {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.lowstock-form {
  flex: 1;
  min-width: 360px;
}
.lowstock-preview {
  flex: 1;
  min-width: 320px;
}
.lowstock-preview-box {
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
.lowstock-help {
  margin-top: 24px;
  text-align: center;
  color: #6b7280;
  font-size: 13px;
}
.lowstock-help a {
  color: #111827;
  text-decoration: underline;
}
@media (max-width: 1100px) {
  .lowstock-shell {
    flex-direction: column;
  }
  .lowstock-sidebar {
    width: 100%;
    flex-direction: row;
  }
  .lowstock-nav-btn {
    flex: 1;
    flex-direction: row;
    justify-content: center;
  }
  .lowstock-columns {
    flex-direction: column;
  }
}
@media (max-width: 640px) {
  .lowstock-nav-btn {
    padding: 10px;
    font-size: 12px;
  }
  .lowstock-form,
  .lowstock-preview {
    min-width: 0;
  }
}
`;

function LayoutIcon() {
  return (
    <svg
      className="lowstock-nav-icon"
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
      className="lowstock-nav-icon"
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
      className="lowstock-nav-icon"
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
      className="lowstock-nav-icon"
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
    title: "Free Polo T-Shirt",
    image:
      "https://cdn.shopify.com/s/files/1/0000/0001/products/Classic-Tee.jpg?v=1",
    price: "Rs. 500.00",
    compareAt: "Rs. 999.00",
    rating: 4,
  },
  {
    id: "p2",
    title: "Canvas Backpack",
    image:
      "https://cdn.shopify.com/s/files/1/0000/0001/products/Canvas-Backpack.jpg?v=1",
    price: "Rs. 299.00",
    compareAt: "Rs. 349.00",
    rating: 5,
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
  previewCustomer,
  template,
  productNameMode,
  productNameLimit,
}) {
  const scale = 0.8 + (size / 100) * 0.4;
  const opacity = 1 - (transparency / 100) * 0.7;
  const background =
    template === "gradient"
      ? `linear-gradient(135deg, ${bgColor} 0%, ${bgAlt} 100%)`
      : bgColor;

  const isPortrait = layout === "portrait";
  const imageMode = String(imageAppearance || "contain").toLowerCase();
  const isContainImage = imageMode === "contain" || imageMode.includes("fit");
  const imageFit = isContainImage ? "contain" : "cover";
  const avatarSize = isPortrait ? 66 : 64;
  const avatarOffset = Math.round(avatarSize * 0.45);
  const useFloatingImage = showProductImage && !isPortrait && !isContainImage;
  const cardStyle = {
    transform: `scale(${scale})`,
    opacity,
    background,
    color: textColor,
    borderRadius: 18,
    boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
    border: "1px solid rgba(0,0,0,0.06)",
    padding: isPortrait ? 18 : 16,
    paddingLeft: useFloatingImage ? 16 + avatarOffset : 16,
    display: "flex",
    position: "relative",
    flexDirection: isPortrait ? "column" : "row",
    gap: isPortrait ? 10 : 12,
    alignItems: isPortrait ? "stretch" : "flex-start",
    maxWidth: isPortrait ? 360 : 460,
  };

  const rawName = product?.title || "Antique Drawers";
  const safeName = formatProductName(rawName, productNameMode, productNameLimit);
  const previewSource =
    previewCustomer && typeof previewCustomer === "object"
      ? previewCustomer
      : SAMPLE_ADD_TO_CART_CUSTOMER;
  const previewFirst = String(
    previewSource?.first_name ?? previewSource?.firstName ?? ""
  ).trim();
  const previewLast = String(
    previewSource?.last_name ?? previewSource?.lastName ?? ""
  ).trim();
  const previewFull = String(
    previewSource?.full_name ?? previewSource?.fullName ?? ""
  ).trim();
  const fullName =
    previewFull || [previewFirst, previewLast].filter(Boolean).join(" ").trim();
  const firstName = previewFirst || (fullName ? fullName.split(/\s+/)[0] : "");
  const lastName = previewLast || (fullName ? fullName.split(/\s+/).slice(1).join(" ") : "");
  const city = String(previewSource?.city || "").trim();
  const country = String(previewSource?.country || "").trim();
  const tokenValues = {
    full_name: fullName || SAMPLE_ADD_TO_CART_CUSTOMER.full_name,
    first_name: firstName || SAMPLE_ADD_TO_CART_CUSTOMER.first_name,
    last_name: lastName,
    country: country || city || SAMPLE_ADD_TO_CART_CUSTOMER.country,
    city: city || SAMPLE_ADD_TO_CART_CUSTOMER.city,
    product_name: safeName,
    product_price: product?.price || "Rs. 29.99",
    time: String(avgTime || "3"),
    unit: String(avgUnit || "mins"),
  };

  const resolveTemplate = (value) =>
    String(value || "")
      .trim()
      .replace(/\{(\w+)\}/g, (match, key) => tokenValues[key] ?? match);

  const resolvedContent = resolveTemplate(
    contentText || "{full_name} from {country} added {product_name} to cart"
  );
  const resolvedTimestamp = resolveTemplate(
    timestampText || "{time} {unit} ago"
  );
  const productName = tokenValues.product_name;
  const productIndex = resolvedContent.indexOf(productName);
  const contentNode =
    productIndex >= 0 ? (
      <>
        {resolvedContent.slice(0, productIndex)}
        <span style={{ fontWeight: 600, textDecoration: "underline" }}>
          {productName}
        </span>
        {resolvedContent.slice(productIndex + productName.length)}
      </>
    ) : (
      resolvedContent
    );

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
      {showProductImage && useFloatingImage && (
        <div
          style={{
            position: "absolute",
            left: "8px",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: avatarSize,
            height: avatarSize,
            borderRadius: 14,
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
              style={{ width: "100%", height: "100%", objectFit: imageFit }}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span style={{ fontSize: 12, color: "#6b7280" }}>IMG</span>
          )}
        </div>
      )}
      {showProductImage && (isPortrait || !useFloatingImage) && (
        <div
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: 14,
            overflow: "hidden",
            background: "#f3f4f6",
            display: "grid",
            placeItems: "center",
            alignSelf: "center",
            boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
            border: "2px solid rgba(255,255,255,0.75)",
            marginTop: 2,
          }}
        >
          {product?.image ? (
            <img
              src={product.image}
              alt={product.title}
              style={{ width: "100%", height: "100%", objectFit: imageFit }}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span style={{ fontSize: 12, color: "#6b7280" }}>IMG</span>
          )}
        </div>
      )}

      <div style={{ display: "grid", gap: isPortrait ? 8 : 6, minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            width: "fit-content",
            background: "rgba(0,0,0,0.82)",
            color: "#ffffff",
            borderRadius: 999,
            padding: "3px 10px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#ffffff",
              opacity: 0.95,
            }}
          />
          Added to cart
        </div>
        {showRating && (
          <div style={{ color: starColor, fontSize: 12, letterSpacing: 1 }}>
            {"★★★★★".slice(0, product?.rating || 4)}
            <span style={{ color: "#d1d5db" }}>
              {"★★★★★".slice(0, 5 - (product?.rating || 4))}
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
              {product?.price || "Rs. 29.99"}
            </span>
            <span
              style={{
                color: priceTagAlt,
                fontSize: textSizeCompare,
                textDecoration: "line-through",
              }}
            >
              {product?.compareAt || "Rs. 49.99"}
            </span>
          </InlineStack>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            color: timestampColor,
            gap: 12,
          }}
        >
          <span>{resolvedTimestamp}</span>
        </div>
      </div>
    </div>
  );
}

export default function AddToCartPopupPage() {
  const { saved, customerCount, firstProduct, previewCustomer } = useLoaderData();
  const navigate = useNavigate();
  const location = useLocation();
  const notificationUrl = `/app/notification${location.search || ""}`;
  const notificationManageUrl = `/app/notification/manage${location.search || ""}`;
  const [activeSection, setActiveSection] = useState("layout");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ active: false, error: false, msg: "" });

  const [design, setDesign] = useState({
    layout: "landscape",
    size: 25,
    transparent: 10,
    template: "gradient",
    imageAppearance: "contain",
    bgColor: "#CCC01E",
    bgAlt: "#7E6060",
    textColor: "#F9EEEE",
    timestampColor: "#FBF9F9",
    priceTagBg: "#593E3F",
    priceTagAlt: "#E66465",
    priceColor: "#FFFFFF",
    starColor: "#F06663",
  });

  const [textSize, setTextSize] = useState({
    content: "14",
    compareAt: "12",
    price: "12",
  });

  const [content, setContent] = useState({
    message: "{full_name} from {country} added {product_name} to cart",
    timestamp: "{time} {unit} ago",
    avgTime: "3",
    avgUnit: "mins",
  });
  const [productNameMode, setProductNameMode] = useState("full");
  const [productNameLimit, setProductNameLimit] = useState(
    DEFAULT_PRODUCT_NAME_LIMIT
  );

  const [data, setData] = useState({
    dataSource: "shopify",
    customerInfo: "shopify",
    stockUnder: "10",
    hideOutOfStock: true,
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
    position: "top-right",
  });

  const [behavior, setBehavior] = useState({
    showClose: true,
    hideOnMobile: false,
    delay: "1",
    duration: "10",
    interval: "5",
    intervalUnit: "seconds",
    randomize: true,
  });

  const productFetcher = useFetcher();
  const collectionFetcher = useFetcher();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [productPickerTarget, setProductPickerTarget] = useState(
    PRODUCT_PICKER_TARGETS.data
  );
  const [search, setSearch] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [page, setPage] = useState(1);
  const [collectionPage, setCollectionPage] = useState(1);
  const [hasLoadedProducts, setHasLoadedProducts] = useState(false);
  const [hasLoadedCollections, setHasLoadedCollections] = useState(false);

  const [selectedDataProducts, setSelectedDataProducts] = useState([]);
  const [selectedVisibilityProducts, setSelectedVisibilityProducts] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [dataProductError, setDataProductError] = useState("");
  const [editingId, setEditingId] = useState(null);

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
      Array.isArray(saved.selectedDataProducts)
        ? saved.selectedDataProducts
        : Array.isArray(saved.selectedProducts)
          ? saved.selectedProducts
          : []
    );
    setSelectedVisibilityProducts(
      Array.isArray(saved.selectedVisibilityProducts)
        ? saved.selectedVisibilityProducts
        : Array.isArray(saved.selectedProducts)
          ? saved.selectedProducts
          : []
    );
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
    if (hasAnyValidSelectedProduct(selectedDataProducts)) {
      setDataProductError("");
    }
  }, [selectedDataProducts]);

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
  const defaultStoreProduct = storeProducts[0] || firstProduct || null;

  const needsDataProductSelection =
    !hasAnyValidSelectedProduct(selectedDataProducts);
  const needsVisibilityProductSelection =
    visibility.productScope === "specific" &&
    selectedVisibilityProducts.length === 0;
  const needsCollectionSelection =
    visibility.collectionScope === "specific" &&
    selectedCollections.length === 0;

  const dataScopedProduct = selectedDataProducts[0] || defaultStoreProduct;
  const scopedProduct =
    visibility.productScope === "specific"
      ? selectedVisibilityProducts[0]
      : null;
  const scopedCollectionProduct =
    visibility.collectionScope === "specific"
      ? selectedCollections[0]?.sampleProduct
      : null;
  const previewProduct =
    dataScopedProduct || scopedProduct || scopedCollectionProduct || defaultStoreProduct || null;
  const previewMessage = needsDataProductSelection
    ? "Select data products to preview add-to-cart popup."
    : needsVisibilityProductSelection
      ? "Select display products for product page visibility."
    : needsCollectionSelection
      ? "Select a collection to preview."
      : !previewProduct
        ? "Preview will appear once a product is available."
        : null;

  const productKey = (item) =>
    String(item?.handle || item?.id || item?.title || "")
      .trim()
      .toLowerCase();
  const sameProduct = (a, b) => {
    const ka = productKey(a);
    const kb = productKey(b);
    return Boolean(ka && kb && ka === kb);
  };
  const pickerProducts =
    productPickerTarget === PRODUCT_PICKER_TARGETS.visibility
      ? selectedVisibilityProducts
      : selectedDataProducts;
  const openDataProductPicker = () => {
    setProductPickerTarget(PRODUCT_PICKER_TARGETS.data);
    setPickerOpen(true);
  };
  const openVisibilityProductPicker = () => {
    setProductPickerTarget(PRODUCT_PICKER_TARGETS.visibility);
    setPickerOpen(true);
  };
  const togglePick = (item) => {
    const setter =
      productPickerTarget === PRODUCT_PICKER_TARGETS.visibility
        ? setSelectedVisibilityProducts
        : setSelectedDataProducts;
    setter((prev) => {
      const exists = prev.some((p) => sameProduct(p, item));
      if (exists) return prev.filter((p) => !sameProduct(p, item));
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

  const hasNextPage = Boolean(productFetcher.data?.hasNextPage);
  const hasNextCollectionPage = Boolean(collectionFetcher.data?.hasNextPage);
  const collectionItems = storeCollections;

  const insertToken = (field, token) => {
    setContent((c) => ({
      ...c,
      [field]: `${c[field]}${c[field] ? " " : ""}{${token}}`,
    }));
  };

  const save = async () => {
    if (!hasAnyValidSelectedProduct(selectedDataProducts)) {
      setDataProductError(DATA_PRODUCT_REQUIRED_MSG);
      setToast({ active: true, error: true, msg: DATA_PRODUCT_REQUIRED_MSG });
      return;
    }
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
        selectedDataProducts,
        selectedVisibilityProducts,
        // Keep legacy field populated for backward compatibility.
        selectedProducts: selectedDataProducts,
        selectedCollections,
      };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          errorText(out?.error, errorText(out?.message, `Save failed (HTTP ${res.status})`))
        );
      }

      if (out && out.success === false) {
        throw new Error(errorText(out?.error));
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

  return (
    <Frame>
      <Page
        title="Edit Add to cart notification"
        backAction={{ content: "Back", onAction: () => navigate(notificationUrl) }}
        primaryAction={{ content: "Save", onAction: save, loading: saving }}
      >
        <style>{LOW_STOCK_STYLES}</style>
        <div className="lowstock-shell">
          <div className="lowstock-sidebar">
            {NAV_ITEMS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`lowstock-nav-btn ${activeSection === id ? "is-active" : ""}`}
                onClick={() => setActiveSection(id)}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="lowstock-main">
            <div className="lowstock-columns">
              <div className="lowstock-form">
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
                              label="Layout"
                              options={LAYOUTS}
                              value={design.layout}
                              onChange={(v) =>
                                setDesign((d) => ({ ...d, layout: v }))
                              }
                            />

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

                            <InlineStack gap="400" wrap={false}>
                              <Box width="50%">
                                <ColorField
                                  label="Background color"
                                  value={design.bgColor}
                                  fallback="#CCC01E"
                                  onChange={(v) =>
                                    setDesign((d) => ({ ...d, bgColor: v }))
                                  }
                                />
                              </Box>
                              <Box width="50%">
                                <ColorField
                                  label="Background color (alt)"
                                  value={design.bgAlt}
                                  fallback="#7E6060"
                                  onChange={(v) =>
                                    setDesign((d) => ({ ...d, bgAlt: v }))
                                  }
                                />
                              </Box>
                            </InlineStack>

                            <InlineStack gap="400" wrap={false}>
                              <Box width="50%">
                                <ColorField
                                  label="Text color"
                                  value={design.textColor}
                                  fallback="#F9EEEE"
                                  onChange={(v) =>
                                    setDesign((d) => ({ ...d, textColor: v }))
                                  }
                                />
                              </Box>
                              <Box width="50%">
                                <ColorField
                                  label="Timestamp color"
                                  value={design.timestampColor}
                                  fallback="#FBF9F9"
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
                                    setDesign((d) => ({ ...d, priceTagBg: v }))
                                  }
                                />
                              </Box>
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
                                  fallback="#F06663"
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
                                  imageAppearance: v[0] || "contain",
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
                              label="Notification content"
                              value={content.message}
                              onChange={(v) =>
                                setContent((c) => ({ ...c, message: v }))
                              }
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
                              helpText={`${content.timestamp.length}/50`}
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
                            <InlineStack gap="400" wrap={false}>
                              <Box width="50%">
                                <TextField
                                  label="Average time"
                                  type="number"
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
                              Time will be randomized around this time.
                            </Text>
                          </BlockStack>
                        </Box>
                      </Card>

                      <Card>
                        <Box padding="4">
                          <BlockStack gap="300">
                            <Text as="h3" variant="headingMd">
                              Data
                            </Text>
                            <InlineStack gap="400">
                              <RadioButton
                                id="data-shopify"
                                name="data_source"
                                label="Import data from Shopify"
                                checked={data.dataSource === "shopify"}
                                onChange={() =>
                                  setData((d) => ({
                                    ...d,
                                    dataSource: "shopify",
                                  }))
                                }
                              />
                              {/* <RadioButton
                                id="data-manual"
                                name="data_source"
                                label="Set manually"
                                checked={data.dataSource === "manual"}
                                onChange={() =>
                                  setData((d) => ({
                                    ...d,
                                    dataSource: "manual",
                                  }))
                                }
                              /> */}
                            </InlineStack>
                            <BlockStack gap="200">
                              <Text as="p" variant="headingSm">
                                Product info
                              </Text>
                              <InlineStack gap="200" blockAlign="center" wrap>
                                <Button onClick={openDataProductPicker}>
                                  Select product
                                </Button>
                                <Text tone="subdued">
                                  {selectedDataProducts.length} products selected
                                </Text>
                              </InlineStack>
                              {needsDataProductSelection && (
                                <Text as="p" tone="critical">
                                  {dataProductError || DATA_PRODUCT_REQUIRED_MSG}
                                </Text>
                              )}
                            </BlockStack>

                            <div
                              style={{
                                borderTop: "1px solid #e5e7eb",
                                paddingTop: 16,
                              }}
                            >
                              <BlockStack gap="200">
                                <Text as="p" variant="headingSm">
                                  Customer info
                                </Text>
                                <RadioButton
                                  id="customer-info-shopify"
                                  name="customer_info"
                                  label="Data from Shopify"
                                  checked={data.customerInfo === "shopify"}
                                  onChange={() =>
                                    setData((d) => ({
                                      ...d,
                                      customerInfo: "shopify",
                                    }))
                                  }
                                />
                                {data.customerInfo === "shopify" && (
                                  <Text tone="subdued">
                                    {Number.isFinite(customerCount)
                                      ? `${customerCount} customer profiles are imported`
                                      : "Customer profiles are imported from Shopify."}
                                  </Text>
                                )}
                                {/* <RadioButton
                                  id="customer-info-manual"
                                  name="customer_info"
                                  label="Set manually"
                                  checked={data.customerInfo === "manual"}
                                  onChange={() =>
                                    setData((d) => ({
                                      ...d,
                                      customerInfo: "manual",
                                    }))
                                  }
                                /> */}
                              </BlockStack>
                            </div>
                          </BlockStack>
                        </Box>
                      </Card>

                      <Card>
                        <Box padding="4">
                          <BlockStack gap="150">
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
                        </Box>
                      </Card>
                    </>
                  )}

                  {activeSection === "display" && (
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
                                onChange={() => {
                                  setVisibility((s) => ({
                                    ...s,
                                    productScope: "specific",
                                  }));
                                }}
                              />
                              {visibility.productScope === "specific" && (
                                <InlineStack
                                  gap="200"
                                  blockAlign="center"
                                  wrap
                                  style={{ marginTop: 6 }}
                                >
                                  <Button onClick={openVisibilityProductPicker}>
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
                                setVisibility((s) => ({
                                  ...s,
                                  showCollection: v,
                                }))
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
                                onChange={() => {
                                  setVisibility((s) => ({
                                    ...s,
                                    collectionScope: "specific",
                                  }));
                                }}
                              />
                              {visibility.collectionScope === "specific" && (
                                <InlineStack
                                  gap="200"
                                  blockAlign="center"
                                  wrap
                                  style={{ marginTop: 6 }}
                                >
                                  <Button onClick={() => setCollectionPickerOpen(true)}>
                                    Select collections
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

              <div className="lowstock-preview">
                <Card>
                  <Box padding="4">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        Preview
                      </Text>
                      <div className="lowstock-preview-box">
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
                            bgColor={normalizeHex(design.bgColor, "#FFFBD2")}
                            bgAlt={normalizeHex(design.bgAlt, "#FBCFCF")}
                            textColor={normalizeHex(design.textColor, "#000000")}
                            timestampColor={normalizeHex(
                              design.timestampColor,
                              "#FBF9F9"
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
                            starColor={normalizeHex(design.starColor, "#F06663")}
                            imageAppearance={design.imageAppearance}
                            textSizeContent={Number(textSize.content) || 14}
                            textSizeCompare={Number(textSize.compareAt) || 12}
                            textSizePrice={Number(textSize.price) || 12}
                            contentText={content.message}
                            timestampText={content.timestamp}
                            avgTime={content.avgTime}
                            avgUnit={content.avgUnit}
                            showProductImage={data.showProductImage}
                            showPriceTag={data.showPriceTag}
                            showRating={data.showRating}
                            showClose={behavior.showClose}
                            product={previewProduct}
                            previewCustomer={previewCustomer}
                            template={design.template}
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

            <div className="lowstock-help">
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
          productPickerTarget === PRODUCT_PICKER_TARGETS.visibility
            ? "Select display products"
            : "Select data products"
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
                const checked = pickerProducts.some((p) => sameProduct(p, item));
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
                      <Badge tone="success">active</Badge>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>

            <InlineStack gap="200" align="space-between" blockAlign="center">
              <Text tone="subdued">
                {pickerProducts.length} products selected
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
