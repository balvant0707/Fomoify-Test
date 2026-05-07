import { useEffect, useState } from "react";
import {
  BlockStack,
  Card,
  Checkbox,
  Divider,
  Frame,
  Loading,
  InlineGrid,
  InlineStack,
  Page,
  Select,
  Text,
  TextField,
  Toast,
} from "@shopify/polaris";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { saveStockAnnouncement } from "../models/popup-config.server";
import { deleteCacheByPrefix } from "../utils/serverCache.server";
import StockSpecificBox from "../components/productInfo/StockSpecificBox";
import { NotificationPageStyles } from "../components/notification/NotificationPageStyles";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;

  let saved = null;
  try {
    const model = prisma?.stockannouncementconfig ?? null;
    if (shop && model) {
      saved = await model.findFirst({
        where: { shop },
        orderBy: { id: "desc" },
      });
    }
  } catch (e) {
    console.warn("[Stock Announcement] load failed:", e);
  }

  return json({ saved });
}

export async function action({ request }) {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch {
    return json({ success: false, error: "Auth temporarily unavailable." }, { status: 503 });
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
  if (!form) return json({ success: false, error: "Missing form" }, { status: 400 });

  try {
    const record = await saveStockAnnouncement(shop, form);
    deleteCacheByPrefix(`proxy:popup:${shop}:`);
    return json({ success: true, id: record?.id });
  } catch (e) {
    console.error("[Stock Announcement] save failed:", e);
    return json({ success: false, error: e?.message || "Save failed" }, { status: 500 });
  }
};

const styles = `
.product-info-designer {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  color: #111827;
}
.product-info-sidebar {
    width: 80px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  background: #f6f7f8;
}
.product-info-nav-btn {
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 6px;
  padding: 5px 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #111827;
  cursor: pointer;
  transition:
    border-color 120ms ease,
    background 120ms ease,
    box-shadow 120ms ease,
    color 120ms ease,
    transform 120ms ease;
}
.product-info-nav-btn:hover {
  border-color: #b8c3d1;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}
.product-info-nav-btn.is-active {
  background: #2f8d5a;
  color: #ffffff;
  border-color: #2f8d5a;
  box-shadow: 0 8px 18px rgba(47, 141, 90, 0.24);
}
.product-info-nav-icon {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
}
.product-info-main {
  flex: 1;
  min-width: 0;
}
.product-info-main .Polaris-Card {
  border-radius: 8px;
  box-shadow: 0 1px 0 rgba(17, 24, 39, 0.04);
}
.product-info-preview-shell {
  min-height: 320px;
  display: grid;
  place-items: center;
}
.product-info-preview-card {
  width: min(100%, 420px);
  background: #ffffff;
  border-radius: 8px;
  padding: 18px 20px;
  box-shadow: 0px 0px 4px rgba(15, 23, 42, 0.12);
}
.product-info-line {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}
.notification-page .product-info-preview-card .product-info-line,
.notification-page .product-info-preview-card .product-info-line span {
  font-size: inherit !important;
}
.product-info-dot {
  display: inline-block;
  border-radius: 999px;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.72);
  flex: 0 0 auto;
}
@keyframes sa-dot-ping {
  0%   { transform: scale(1); opacity: 1; }
  70%  { transform: scale(1.7); opacity: 0; }
  100% { transform: scale(1.7); opacity: 0; }
}
@keyframes sa-dot-beat {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.28); }
}
.sa-dot-ping { animation: sa-dot-ping 1.2s ease-out infinite; }
.sa-dot-beat { animation: sa-dot-beat 0.75s ease-in-out infinite; }
.product-info-color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.product-info-two-field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: center;
}
.product-info-color-swatch-shell {
    width: 34px;
    height: 30.5px;
    margin: -4px -11px -4px 0px;
    border-left: 1px solid #c9cccf;
    border-radius: 0 7px 7px 0;
    overflow: hidden;
    background: #ffffff;
    display: flex;
}
.product-info-color-swatch {
  width: 100%;
  height: 100%;
  border: 0;
  cursor: pointer;
  background: transparent;
  padding: 0;
}
.product-info-color-swatch::-webkit-color-swatch-wrapper {
  padding: 0;
}
.product-info-color-swatch::-webkit-color-swatch {
  border: 0;
}
@media (max-width: 768px) {
  .product-info-designer {
    flex-direction: column;
  }
  .product-info-sidebar {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
  }
  .product-info-nav-btn {
    min-width: 96px;
  }
  .product-info-color-grid {
    grid-template-columns: 1fr;
  }
  .product-info-two-field-row {
    grid-template-columns: 1fr;
  }
}
`;

const alignOptions = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];

const weightOptions = [
  { label: "Normal", value: "400" },
  { label: "Medium", value: "500" },
  { label: "Semibold", value: "600" },
  { label: "Bold", value: "700" },
];

const dotAnimationOptions = [
  { label: "None", value: "none" },
  { label: "Ping", value: "ping" },
  { label: "Pulse", value: "beat" },
];

const dotIconOptions = [
  { label: "Dot (circle)", value: "none" },
  { label: "Check mark", value: "check" },
  { label: "Alert circle", value: "alert" },
  { label: "Star", value: "star" },
  { label: "Flame", value: "flame" },
];

function LayoutIcon() {
  return (
    <svg
      className="product-info-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
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
      className="product-info-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
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
      className="product-info-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

const editorSections = [
  { id: "layout", label: "Layout", Icon: LayoutIcon },
  { id: "content", label: "Content", Icon: ContentIcon },
  { id: "display", label: "Display", Icon: DisplayIcon },
];

function DotIconSvg({ name, color, size, className = "" }) {
  const wrapStyle = {
    width: size, height: size, display: "inline-grid",
    placeItems: "center", flex: "0 0 auto", color,
  };
  const p = { viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", width: "100%", height: "100%", "aria-hidden": true };
  if (name === "check")
    return <span className={className} style={wrapStyle}><svg {...p}><path d="m4 10 4.5 4.5 7.5-8"/></svg></span>;
  if (name === "alert")
    return <span className={className} style={wrapStyle}><svg {...p}><circle cx="10" cy="10" r="7.25"/><path d="M10 5.75v5"/><path d="M10 14.25h.01"/></svg></span>;
  if (name === "star")
    return <span className={className} style={wrapStyle}><svg {...p} fill="currentColor" stroke="none"><path d="m10 2.6 2.15 4.35 4.8.7-3.48 3.4.82 4.78L10 13.58l-4.29 2.25.82-4.78-3.48-3.4 4.8-.7L10 2.6Z"/></svg></span>;
  if (name === "flame")
    return <span className={className} style={wrapStyle}><svg {...p} fill="currentColor" stroke="none"><path d="M10 2s-4 3.5-4 7.5a4 4 0 0 0 8 0C14 5.5 10 2 10 2Zm0 10a2 2 0 0 1-2-2c0-2 2-4 2-4s2 2 2 4a2 2 0 0 1-2 2Z"/></svg></span>;
  return null;
}

function ColorField({ label, value, onChange, fallback = "#000000" }) {
  const safeValue = /^#[0-9a-f]{6}$/i.test(String(value || ""))
    ? value
    : fallback;

  return (
    <TextField
      label={label}
      value={value}
      onChange={(next) => onChange(String(next || "").toUpperCase())}
      autoComplete="off"
      suffix={
        <span className="product-info-color-swatch-shell">
          <input
            className="product-info-color-swatch"
            type="color"
            value={safeValue}
            aria-label={`${label} color`}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
          />
        </span>
      }
    />
  );
}

function boundedNumber(value, min, max, fallback) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

function NumberField({ label, value, onChange, min, max }) {
  return (
    <TextField
      label={label}
      value={String(value)}
      type="number"
      min={min}
      max={max}
      onChange={(next) => onChange(boundedNumber(next, min, max, value))}
      autoComplete="off"
    />
  );
}

export default function StockBlockConfiguration() {
  const { saved } = useLoaderData();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("layout");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ active: false, error: false, msg: "" });
  const [stockEnabled, setStockEnabled] = useState(true);
  const [productQuantity, setProductQuantity] = useState("5");
  const [showProductQuantity, setShowProductQuantity] = useState(true);
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [inStockText, setInStockText] = useState("In stock");
  const [quantityText, setQuantityText] = useState("Stock: {count} available");
  const [outOfStockText, setOutOfStockText] = useState("Out of stock");
  const [inStockDotColor, setInStockDotColor] = useState("#42D66B");
  const [lowStockDotColor, setLowStockDotColor] = useState("#F59E0B");
  const [outStockDotColor, setOutStockDotColor] = useState("#EF4444");
  const [stockProductScope, setStockProductScope] = useState("all");
  const [stockProductModalOpen, setStockProductModalOpen] = useState(false);
  const [selectedStockProductIds, setSelectedStockProductIds] = useState([]);

  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [dotAnimationStyle, setDotAnimationStyle] = useState("none");
  const [dotIcon, setDotIcon]                     = useState("none");
  const [highlightBg, setHighlightBg]             = useState("");
  const [hideOnMobile, setHideOnMobile]           = useState(false);

  const [textColor, setTextColor] = useState("#3F3F46");
  const [fontSize, setFontSize] = useState(20);
  const [mobileFontSize, setMobileFontSize] = useState(16);
  const [dotSize, setDotSize] = useState(16);
  const [spacing, setSpacing] = useState(12);
  const [textWeight, setTextWeight] = useState("500");
  const [alignment, setAlignment] = useState("left");
  const [topMargin, setTopMargin] = useState(0);
  const [bottomMargin, setBottomMargin] = useState(0);
  const [customClass, setCustomClass] = useState("");

  useEffect(() => {
    if (!saved) return;
    if (saved.enabled != null) setStockEnabled(saved.enabled);
    if (saved.productQuantity != null) setProductQuantity(String(saved.productQuantity));
    if (saved.showProductQuantity != null) setShowProductQuantity(saved.showProductQuantity);
    if (saved.hideOutOfStock != null) setHideOutOfStock(saved.hideOutOfStock);
    if (saved.inStockText != null) setInStockText(saved.inStockText);
    if (saved.quantityText != null) setQuantityText(saved.quantityText);
    if (saved.outOfStockText != null) setOutOfStockText(saved.outOfStockText);
    if (saved.inStockDotColor != null) setInStockDotColor(saved.inStockDotColor);
    if (saved.lowStockDotColor != null) setLowStockDotColor(saved.lowStockDotColor);
    if (saved.outStockDotColor != null) setOutStockDotColor(saved.outStockDotColor);
    if (saved.productScope != null) setStockProductScope(saved.productScope);
    if (saved.textColor != null) setTextColor(saved.textColor);
    if (saved.fontSize != null) setFontSize(saved.fontSize);
    if (saved.mobileFontSize != null) setMobileFontSize(saved.mobileFontSize);
    if (saved.dotSize != null) setDotSize(saved.dotSize);
    if (saved.spacing != null) setSpacing(saved.spacing);
    if (saved.textWeight != null) setTextWeight(saved.textWeight);
    if (saved.alignment != null) setAlignment(saved.alignment);
    if (saved.topMargin != null) setTopMargin(saved.topMargin);
    if (saved.bottomMargin != null) setBottomMargin(saved.bottomMargin);
    if (saved.customClass != null) setCustomClass(saved.customClass);
    if (saved.lowStockThreshold != null) setLowStockThreshold(saved.lowStockThreshold);
    if (saved.dotAnimationStyle != null) setDotAnimationStyle(saved.dotAnimationStyle);
    if (saved.dotIcon           != null) setDotIcon(saved.dotIcon);
    if (saved.highlightBg       != null) setHighlightBg(saved.highlightBg);
    if (saved.hideOnMobile      != null) setHideOnMobile(saved.hideOnMobile);
    try {
      const ids = JSON.parse(saved.selectedProductsJson || "[]");
      if (Array.isArray(ids) && ids.length) setSelectedStockProductIds(ids);
    } catch {}
  }, [saved]);

  const previewStockCount = Math.max(0, Number(productQuantity) || 0);
  const isPreviewOut = previewStockCount <= 0;
  const stockText = isPreviewOut
    ? outOfStockText
    : showProductQuantity
      ? quantityText.replace("{count}", previewStockCount)
      : inStockText;
  const stockDot = (() => {
    if (isPreviewOut) return outStockDotColor;
    const threshold = Math.max(0, Number(lowStockThreshold) || 0);
    if (threshold > 0 && previewStockCount <= threshold) return lowStockDotColor;
    return inStockDotColor;
  })();
  const dotAnimationClass =
    dotAnimationStyle === "ping"
      ? "sa-dot-ping"
      : dotAnimationStyle === "beat"
        ? "sa-dot-beat"
        : "";
  const previewHideStock = isPreviewOut && hideOutOfStock;
  const justify =
    alignment === "center" ? "center" : alignment === "right" ? "flex-end" : "flex-start";

  const save = async () => {
    setSaving(true);
    try {
      const form = {
        editId: saved?.id ?? null,
        enabled: stockEnabled,
        productQuantity: Number(productQuantity) || 0,
        showProductQuantity,
        hideOutOfStock,
        inStockText,
        quantityText,
        outOfStockText,
        inStockDotColor,
        lowStockDotColor,
        outStockDotColor,
        lowStockThreshold: Number(lowStockThreshold) || 0,
        dotAnimationStyle,
        dotIcon,
        highlightBg,
        hideOnMobile,
        productScope: stockProductScope,
        selectedProducts: selectedStockProductIds,
        textColor,
        fontSize,
        mobileFontSize,
        dotSize,
        spacing,
        textWeight,
        alignment,
        topMargin,
        bottomMargin,
        customClass,
      };

      const res = await fetch(window.location.pathname, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form }),
      });

      let out = null;
      try { out = await res.json(); } catch {}

      if (!res.ok || out?.success === false) {
        throw new Error(out?.error || `Save failed (HTTP ${res.status})`);
      }

      setToast({ active: true, error: false, msg: "Saved successfully." });
      setTimeout(
        () => navigate("/app/notification/manage?saved=1"),
        900
      );
    } catch (e) {
      setToast({ active: true, error: true, msg: e?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Frame>
      {saving && <Loading />}
      {toast.active && (
        <Toast
          content={toast.msg}
          error={toast.error}
          onDismiss={() => setToast((t) => ({ ...t, active: false }))}
        />
      )}
      <Page
        title="Stock Announcement"
        backAction={{ content: "Back", url: "/app" }}
        primaryAction={{ content: "Save", onAction: save, loading: saving }}
      >
      <NotificationPageStyles />
      <style>{styles}</style>
      <div className="product-info-designer notification-page">
        <div className="product-info-sidebar" aria-label="Stock block sections">
          {editorSections.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`product-info-nav-btn ${activeSection === id ? "is-active" : ""}`}
              onClick={() => setActiveSection(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
        <div className="product-info-main">
        <InlineGrid columns={{ xs: 1, md: "1fr 420px" }} gap="400">
          <BlockStack gap="400">
            {activeSection === "content" && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Content
                    </Text>
                  </BlockStack>
                </InlineStack>
                 <div className="product-info-two-field-row">
                  <Checkbox label="Show" checked={stockEnabled} onChange={setStockEnabled} />
                  <Checkbox label="Show product quantity" checked={showProductQuantity} onChange={setShowProductQuantity} />
                </div>
                <div className="product-info-two-field-row">
                  <Checkbox label="Hide when out of stock" checked={hideOutOfStock} onChange={setHideOutOfStock} />
                  <TextField label="In-stock text" value={inStockText} onChange={setInStockText} autoComplete="off" />
                </div>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField label="Quantity text" value={quantityText} onChange={setQuantityText} autoComplete="off" />
                  <TextField label="Out-of-stock text" value={outOfStockText} onChange={setOutOfStockText} autoComplete="off" />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField label="Custom CSS class" value={customClass} onChange={setCustomClass} autoComplete="off" />
                  <NumberField label="Low stock threshold" value={lowStockThreshold} onChange={setLowStockThreshold} min={0} max={999} />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <Select label="Dot animation" options={dotAnimationOptions} value={dotAnimationStyle} onChange={setDotAnimationStyle} />
                  <Select label="Replace dot with icon" options={dotIconOptions} value={dotIcon} onChange={setDotIcon} />
                </InlineGrid>
              </BlockStack>
            </Card>
            )}

            {activeSection === "layout" && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Layout
                </Text>
                <BlockStack gap="300">
                  <div className="product-info-color-grid">
                    <ColorField label="Text color" value={textColor} onChange={setTextColor} fallback="#3F3F46" />
                    <ColorField label="In-stock dot color" value={inStockDotColor} onChange={setInStockDotColor} fallback="#42D66B" />
                    <ColorField label="Quantity dot color" value={lowStockDotColor} onChange={setLowStockDotColor} fallback="#F59E0B" />
                    <ColorField label="Out-of-stock dot color" value={outStockDotColor} onChange={setOutStockDotColor} fallback="#EF4444" />
                  </div>
                </BlockStack>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <Select label="Text weight" options={weightOptions} value={textWeight} onChange={setTextWeight} />
                  <ColorField label="Highlight background" value={highlightBg || "#FFFBEB"} onChange={setHighlightBg} fallback="#FFFBEB" />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <NumberField label="Font size (px)" value={fontSize} onChange={setFontSize} min={12} max={32} />
                  <NumberField label="Mobile font size (px)" value={mobileFontSize} onChange={setMobileFontSize} min={10} max={24} />
                  <NumberField label="Icon size (px)" value={dotSize} onChange={setDotSize} min={8} max={30} />
                  <NumberField label="Field spacing (px)" value={spacing} onChange={setSpacing} min={4} max={28} />
                </InlineGrid>
              </BlockStack>
            </Card>
            )}

            {activeSection === "display" && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Display
                  </Text>
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                    <Select label="Alignment" options={alignOptions} value={alignment} onChange={setAlignment} />
                    <Checkbox label="Hide on mobile" checked={hideOnMobile} onChange={setHideOnMobile} />
                  </InlineGrid>

                  <StockSpecificBox
                    productScope={stockProductScope}
                    setProductScope={setStockProductScope}
                    productModalOpen={stockProductModalOpen}
                    setProductModalOpen={setStockProductModalOpen}
                    selectedProductIds={selectedStockProductIds}
                    setSelectedProductIds={setSelectedStockProductIds}
                  />
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                    <NumberField label="Top margin (px)" value={topMargin} onChange={setTopMargin} min={0} max={60} />
                    <NumberField label="Bottom margin (px)" value={bottomMargin} onChange={setBottomMargin} min={0} max={60} />
                  </InlineGrid>
                </BlockStack>
              </Card>
            )}
          </BlockStack>

          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Preview
                </Text>
              </InlineStack>
              <Divider />
              <div className="product-info-preview-shell">
                <div className="product-info-preview-card">
                  {!stockEnabled ? (
                    <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "24px 0" }}>
                      Stock announcement is disabled
                    </div>
                  ) : previewHideStock ? (
                    <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "24px 0" }}>
                      Hidden — out of stock &amp; "Hide when out of stock" is on
                    </div>
                  ) : (
                    <>
                      <style>{`.notification-page .product-info-preview-card .product-info-line .sa-preview-text { font-size: ${fontSize}px !important; }`}</style>
                      <div style={{ display: "flex", justifyContent: justify, marginTop: topMargin, marginBottom: bottomMargin, fontSize: `${fontSize}px` }}>
                        <span
                          className={`product-info-line ${customClass || ""}`.trim()}
                          style={{
                            color: textColor,
                            fontWeight: textWeight,
                            gap: Math.max(6, Math.round(spacing / 2)),
                            ...(highlightBg ? { background: highlightBg, borderRadius: 999, padding: "3px 10px" } : {}),
                          }}
                        >
                          {dotIcon && dotIcon !== "none" ? (
                            <DotIconSvg name={dotIcon} color={stockDot} size={dotSize} className={dotAnimationClass} />
                          ) : (
                            <span
                              className={`product-info-dot ${dotAnimationClass}`.trim()}
                              style={{ width: dotSize, height: dotSize, background: stockDot }}
                            />
                          )}
                          
                          <span className="sa-preview-text">{stockText}</span>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </BlockStack>
          </Card>
        </InlineGrid>
        </div>
      </div>
      </Page>
    </Frame>
  );
}
