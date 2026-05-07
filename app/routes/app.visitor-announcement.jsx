import { useEffect, useMemo, useState } from "react";
import {
  BlockStack,
  Card,
  Checkbox,
  Divider,
  Frame,
  Icon,
  InlineGrid,
  InlineStack,
  Loading,
  Page,
  Select,
  Text,
  TextField,
  Toast,
} from "@shopify/polaris";
import {
  ViewIcon,
  PersonIcon,
  PersonFilledIcon,
  MagicIcon,
  HeartIcon,
  LocationIcon,
  StarFilledIcon,
  AlertCircleIcon,
  EyeCheckMarkIcon,
  SocialAdIcon,
} from "@shopify/polaris-icons";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { saveVisitorAnnouncement } from "../models/popup-config.server";
import { deleteCacheByPrefix } from "../utils/serverCache.server";
import VisitorSpecificBox from "../components/productInfo/VisitorSpecificBox";
import { NotificationPageStyles } from "../components/notification/NotificationPageStyles";


// ─── Loader ────────────────────────────────────────────────────────────────

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;

  let saved = null;
  try {
    const model = prisma?.visitorannouncementconfig ?? null;
    if (shop && model) {
      saved = await model.findFirst({
        where: { shop },
        orderBy: { id: "desc" },
      });
    }
  } catch (e) {
    console.warn("[Visitor Announcement] load failed:", e);
  }

  return json({ saved });
}

// ─── Action ────────────────────────────────────────────────────────────────

export async function action({ request }) {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (e) {
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
    const record = await saveVisitorAnnouncement(shop, form);
    deleteCacheByPrefix(`proxy:popup:${shop}:`);
    return json({ success: true, id: record?.id });
  } catch (e) {
    console.error("[Visitor Announcement] save failed:", e);
    return json({ success: false, error: e?.message || "Save failed" }, { status: 500 });
  }
}

// ─── Styles ────────────────────────────────────────────────────────────────

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
.product-info-icon {
  display: inline-grid;
  place-items: center;
  width: var(--product-info-icon-size);
  height: var(--product-info-icon-size);
  flex: 0 0 auto;
}
.product-info-icon .Polaris-Icon,
.product-info-icon svg {
  width: 100%;
  height: 100%;
}
@keyframes va-icon-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.22); }
}
@keyframes va-icon-ping {
  0% { transform: scale(1); opacity: 1; }
  70% { transform: scale(1.6); opacity: 0; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes va-icon-wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}
@keyframes va-icon-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
.va-icon-anim-pulse { animation: va-icon-pulse 0.9s ease-in-out infinite; }
.va-icon-anim-ping { animation: va-icon-ping 1.2s ease-out infinite; }
.va-icon-anim-wiggle { animation: va-icon-wiggle 0.7s ease-in-out infinite; }
.va-icon-anim-float { animation: va-icon-float 1.4s ease-in-out infinite; }
.product-info-color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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
}
`;

// ─── Constants ─────────────────────────────────────────────────────────────

const VISITOR_ICONS = {
  ViewIcon,
  PersonIcon,
  PersonFilledIcon,
  MagicIcon,
  HeartIcon,
  LocationIcon,
  StarFilledIcon,
  AlertCircleIcon,
  EyeCheckMarkIcon,
  SocialAdIcon,
};

const iconOptions = [
  { label: "None", value: "none" },
  { label: "View", value: "ViewIcon" },
  { label: "Person", value: "PersonIcon" },
  { label: "People", value: "PersonFilledIcon" },
  { label: "Magic", value: "MagicIcon" },
  { label: "Heart", value: "HeartIcon" },
  { label: "Location", value: "LocationIcon" },
  { label: "Star", value: "StarFilledIcon" },
  { label: "Alert", value: "AlertCircleIcon" },
  { label: "Eye Check", value: "EyeCheckMarkIcon" },
  { label: "Social Ad", value: "SocialAdIcon" },
];

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

const behaviorOptions = [
  { label: "Fixed random per page load", value: "fixed" },
  { label: "Rotating random", value: "rotating" },
  { label: "Real-time later", value: "realtime" },
];

const animationStyleOptions = [
  { label: "Slide in", value: "slide" },
  { label: "Fade in", value: "fade" },
  { label: "Bounce in", value: "bounce" },
  { label: "Zoom in", value: "zoom" },
  { label: "None", value: "none" },
];

const animationSpeedOptions = [
  { label: "Fast (0.25s)", value: "fast" },
  { label: "Normal (0.45s)", value: "normal" },
  { label: "Slow (0.8s)", value: "slow" },
];

const iconAnimationOptions = [
  { label: "None", value: "none" },
  { label: "Pulse", value: "pulse" },
  { label: "Ping", value: "ping" },
  { label: "Wiggle", value: "wiggle" },
  { label: "Float", value: "float" },
];

const editorSections = [
  { id: "layout", label: "Layout", Icon: LayoutIcon },
  { id: "content", label: "Content", Icon: ContentIcon },
  { id: "display", label: "Display", Icon: DisplayIcon },
];

const legacyIconAliases = { eye: "ViewIcon", fire: "MagicIcon", user: "PersonIcon" };

// ─── Nav icon SVGs ──────────────────────────────────────────────────────────

function LayoutIcon() {
  return (
    <svg className="product-info-nav-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="9" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg className="product-info-nav-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <line x1="7" y1="9" x2="17" y2="9" />
      <line x1="7" y1="13" x2="15" y2="13" />
    </svg>
  );
}

function DisplayIcon() {
  return (
    <svg className="product-info-nav-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

// ─── Small field components ─────────────────────────────────────────────────

const iconSourceFor = (icon) => VISITOR_ICONS[legacyIconAliases[icon] || icon] || ViewIcon;

function VisitorIconField({ value, onChange }) {
  return (
    <Select
      label="Visitor icon"
      options={iconOptions}
      value={legacyIconAliases[value] || value}
      onChange={onChange}
    />
  );
}

function ColorField({ label, value, onChange, fallback = "#000000" }) {
  const safeValue = /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
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
            onChange={(e) => onChange(e.target.value.toUpperCase())}
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

// ─── Main component ─────────────────────────────────────────────────────────

export default function VisitorBlockConfiguration() {
  const { saved } = useLoaderData();
  const navigate = useNavigate();

  // ── state ──
  const [activeSection, setActiveSection] = useState("layout");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ active: false, error: false, msg: "" });

  const [visitorEnabled, setVisitorEnabled]     = useState(true);
  const [visitorMin, setVisitorMin]             = useState("12");
  const [visitorMax, setVisitorMax]             = useState("42");
  const [visitorTemplate, setVisitorTemplate]   = useState("{count} people are viewing this product");
  const [visitorIcon, setVisitorIcon]           = useState("ViewIcon");
  const [visitorIconColor, setVisitorIconColor] = useState("#6B4B7A");
  const [visitorRefresh, setVisitorRefresh]     = useState("20");
  const [visitorBehavior, setVisitorBehavior]   = useState("fixed");
  const [visitorProductScope, setVisitorProductScope]         = useState("all");
  const [visitorProductModalOpen, setVisitorProductModalOpen] = useState(false);
  const [selectedVisitorProductIds, setSelectedVisitorProductIds] = useState([]);

  const [animationStyle, setAnimationStyle] = useState("slide");
  const [animationSpeed, setAnimationSpeed] = useState("normal");
  const [iconAnimationStyle, setIconAnimationStyle] = useState("none");
  const [countInterval, setCountInterval]   = useState(0);
  const [hideOnMobile, setHideOnMobile]     = useState(false);

  const [textColor, setTextColor]         = useState("#3F3F46");
  const [fontSize, setFontSize]           = useState(16);
  const [mobileFontSize, setMobileFontSize] = useState(14);
  const [iconSize, setIconSize]           = useState(18);
  const [spacing, setSpacing]             = useState(12);
  const [textWeight, setTextWeight]       = useState("500");
  const [customClass, setCustomClass]     = useState("");
  const [alignment, setAlignment]         = useState("left");
  const [topMargin, setTopMargin]         = useState(0);
  const [bottomMargin, setBottomMargin]   = useState(0);

  // ── hydrate from DB on first load ──
  useEffect(() => {
    if (!saved) return;
    if (saved.enabled       != null) setVisitorEnabled(saved.enabled);
    if (saved.visitorMin    != null) setVisitorMin(String(saved.visitorMin));
    if (saved.visitorMax    != null) setVisitorMax(String(saved.visitorMax));
    if (saved.template      != null) setVisitorTemplate(saved.template);
    if (saved.iconKey       != null) setVisitorIcon(saved.iconKey);
    if (saved.iconColor     != null) setVisitorIconColor(saved.iconColor);
    if (saved.refreshSeconds != null) setVisitorRefresh(String(saved.refreshSeconds));
    if (saved.behavior      != null) setVisitorBehavior(saved.behavior);
    if (saved.productScope  != null) setVisitorProductScope(saved.productScope);
    if (saved.textColor     != null) setTextColor(saved.textColor);
    if (saved.fontSize      != null) setFontSize(saved.fontSize);
    if (saved.mobileFontSize != null) setMobileFontSize(saved.mobileFontSize);
    if (saved.iconSize      != null) setIconSize(saved.iconSize);
    if (saved.spacing       != null) setSpacing(saved.spacing);
    if (saved.textWeight    != null) setTextWeight(saved.textWeight);
    if (saved.customClass   != null) setCustomClass(saved.customClass);
    if (saved.alignment     != null) setAlignment(saved.alignment);
    if (saved.topMargin     != null) setTopMargin(saved.topMargin);
    if (saved.bottomMargin  != null) setBottomMargin(saved.bottomMargin);
    if (saved.animationStyle != null) setAnimationStyle(saved.animationStyle);
    if (saved.animationSpeed != null) setAnimationSpeed(saved.animationSpeed);
    if (saved.iconAnimationStyle != null) setIconAnimationStyle(saved.iconAnimationStyle);
    if (saved.countInterval  != null) setCountInterval(saved.countInterval);
    if (saved.hideOnMobile   != null) setHideOnMobile(saved.hideOnMobile);
    try {
      const ids = JSON.parse(saved.selectedProductsJson || "[]");
      if (Array.isArray(ids) && ids.length) setSelectedVisitorProductIds(ids);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── computed ──
  const visitorCount = useMemo(() => {
    const min = Math.max(0, Number(visitorMin) || 0);
    const max = Math.max(min, Number(visitorMax) || min);
    return Math.round((min + max) / 2);
  }, [visitorMin, visitorMax]);

  // Live count simulation for preview — cycles/randomises when countInterval > 0
  const [previewCount, setPreviewCount] = useState(visitorCount);
  useEffect(() => {
    setPreviewCount(visitorCount);
    if (countInterval <= 0) return;
    const min = Math.max(0, Number(visitorMin) || 0);
    const max = Math.max(min, Number(visitorMax) || min);
    if (min >= max) return;
    let cur = visitorCount;
    const id = setInterval(() => {
      cur = visitorBehavior === "rotating"
        ? (cur >= max ? min : cur + 1)
        : Math.floor(Math.random() * (max - min + 1)) + min;
      setPreviewCount(cur);
    }, Math.max(1000, countInterval * 1000));
    return () => clearInterval(id);
  }, [visitorCount, countInterval, visitorBehavior, visitorMin, visitorMax]);

  const visitorText = visitorTemplate.replace("{count}", previewCount);
  const justify = alignment === "center" ? "center" : alignment === "right" ? "flex-end" : "flex-start";
  const iconAnimationClass =
    iconAnimationStyle && iconAnimationStyle !== "none"
      ? `va-icon-anim-${iconAnimationStyle}`
      : "";

  const previewAnimDuration = animationSpeed === "fast" ? "0.25s" : animationSpeed === "slow" ? "0.8s" : "0.45s";
  const previewAnimName = (() => {
    if (animationStyle === "fade")   return "fomoifyPrevFade";
    if (animationStyle === "bounce") return "fomoifyPrevBounce";
    if (animationStyle === "zoom")   return "fomoifyPrevZoom";
    if (animationStyle === "none")   return "";
    return "fomoifyPrevSlide";
  })();
  const previewAnimCSS = previewAnimName ? `
    @keyframes fomoifyPrevSlide  { from { opacity:0; transform:translateX(-10px); } to { opacity:1; transform:none; } }
    @keyframes fomoifyPrevFade   { from { opacity:0; } to { opacity:1; } }
    @keyframes fomoifyPrevBounce { 0%{opacity:0;transform:translateY(-14px);} 60%{opacity:1;transform:translateY(4px);} 80%{transform:translateY(-3px);} 100%{transform:none;} }
    @keyframes fomoifyPrevZoom   { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:none; } }
    .fomoify-preview-anim { animation: ${previewAnimName} ${previewAnimDuration} ease-out both; }
  ` : "";

  // ── save ──
  const save = async () => {
    setSaving(true);
    try {
      const form = {
        editId:           saved?.id ?? null,
        enabled:          visitorEnabled,
        visitorMin:       Number(visitorMin) || 0,
        visitorMax:       Number(visitorMax) || 0,
        template:         visitorTemplate,
        iconKey:          visitorIcon,
        iconColor:        visitorIconColor,
        refreshSeconds:   Number(visitorRefresh) || 20,
        behavior:         visitorBehavior,
        animationStyle,
        animationSpeed,
        iconAnimationStyle,
        countInterval:    Number(countInterval) || 0,
        prefixText:        "",
        suffixText:        "",
        hideOnMobile,
        productScope:     visitorProductScope,
        selectedProducts: selectedVisitorProductIds,
        textColor,
        fontSize,
        mobileFontSize,
        iconSize,
        spacing,
        textWeight,
        customClass,
        alignment,
        topMargin,
        bottomMargin,
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

  // ── render ──
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
        title="Visitor Announcement"
        backAction={{ content: "Back", url: "/app" }}
        primaryAction={{ content: "Save", onAction: save, loading: saving }}
      >
        <NotificationPageStyles />
        <style>{styles}</style>
        <div className="product-info-designer notification-page">
          <div className="product-info-sidebar" aria-label="Visitor block sections">
            {editorSections.map(({ id, label, Icon: NavIcon }) => (
              <button
                key={id}
                type="button"
                className={`product-info-nav-btn ${activeSection === id ? "is-active" : ""}`}
                onClick={() => setActiveSection(id)}
              >
                <NavIcon />
                {label}
              </button>
            ))}
          </div>

          <div className="product-info-main">
            <InlineGrid columns={{ xs: 1, md: "1fr 420px" }} gap="400">
              <BlockStack gap="400">

                {/* ── Content ── */}
                {activeSection === "content" && (
                  <Card>
                    <BlockStack gap="400">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h2" variant="headingMd">Content</Text>
                        <Checkbox label="Show" checked={visitorEnabled} onChange={setVisitorEnabled} />
                      </InlineStack>
                      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                        <TextField label="Minimum count" value={visitorMin} onChange={setVisitorMin} type="number" autoComplete="off" />
                        <TextField label="Maximum count" value={visitorMax} onChange={setVisitorMax} type="number" autoComplete="off" />
                      </InlineGrid>
                      <TextField
                        label="Visitor text template"
                        value={visitorTemplate}
                        onChange={setVisitorTemplate}
                        helpText="Use {count} where the visitor number should appear."
                        autoComplete="off"
                      />
                      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                        <VisitorIconField value={visitorIcon} onChange={setVisitorIcon} />
                        <Select label="Icon Animation" options={iconAnimationOptions} value={iconAnimationStyle} onChange={setIconAnimationStyle} />
                      </InlineGrid>
                      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                        <TextField label="Refresh every (seconds)" value={visitorRefresh} onChange={setVisitorRefresh} type="number" autoComplete="off" />
                        <NumberField label="Count update interval (s)" value={countInterval} onChange={setCountInterval} min={0} max={300} />
                      </InlineGrid>
                      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                        <Select label="Count behavior" options={behaviorOptions} value={visitorBehavior} onChange={setVisitorBehavior} />
                      </InlineGrid>
                    </BlockStack>
                  </Card>
                )}

                {/* ── Layout ── */}
                {activeSection === "layout" && (
                  <Card>
                    <BlockStack gap="400">
                      <Text as="h2" variant="headingMd">Layout</Text>
                      <div className="product-info-color-grid">
                        <ColorField label="Text color" value={textColor} onChange={setTextColor} fallback="#3F3F46" />
                        <ColorField label="Visitor icon color" value={visitorIconColor} onChange={setVisitorIconColor} fallback="#6B4B7A" />
                      </div>
                      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                        <Select label="Text weight" options={weightOptions} value={textWeight} onChange={setTextWeight} />
                        <TextField label="Custom CSS class" value={customClass} onChange={setCustomClass} autoComplete="off" />
                      </InlineGrid>
                      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                        <NumberField label="Font size (px)" value={fontSize} onChange={setFontSize} min={12} max={32} />
                        <NumberField label="Mobile font size (px)" value={mobileFontSize} onChange={setMobileFontSize} min={10} max={24} />
                        <NumberField label="Icon size (px)" value={iconSize} onChange={setIconSize} min={10} max={30} />
                        <NumberField label="Field spacing (px)" value={spacing} onChange={setSpacing} min={4} max={28} />
                      </InlineGrid>
                    </BlockStack>
                  </Card>
                )}

                {/* ── Display ── */}
                {activeSection === "display" && (
                  <Card>
                    <BlockStack gap="400">
                      <Text as="h2" variant="headingMd">Display</Text>
                      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                        <Select label="Alignment" options={alignOptions} value={alignment} onChange={setAlignment} />
                        <Select label="Animation style" options={animationStyleOptions} value={animationStyle} onChange={setAnimationStyle} />
                      </InlineGrid>
                      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                        <Select label="Animation speed" options={animationSpeedOptions} value={animationSpeed} onChange={setAnimationSpeed} />
                        <Checkbox label="Hide on mobile" checked={hideOnMobile} onChange={setHideOnMobile} />
                      </InlineGrid>

                      <VisitorSpecificBox
                        productScope={visitorProductScope}
                        setProductScope={setVisitorProductScope}
                        productModalOpen={visitorProductModalOpen}
                        setProductModalOpen={setVisitorProductModalOpen}
                        selectedProductIds={selectedVisitorProductIds}
                        setSelectedProductIds={setSelectedVisitorProductIds}
                      />
                      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                        <NumberField label="Top margin (px)" value={topMargin} onChange={setTopMargin} min={0} max={60} />
                        <NumberField label="Bottom margin (px)" value={bottomMargin} onChange={setBottomMargin} min={0} max={60} />
                      </InlineGrid>
                    </BlockStack>
                  </Card>
                )}
              </BlockStack>

              {/* ── Preview ── */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Preview</Text>
                  <Divider />
                  <div className="product-info-preview-shell">
                    <div className="product-info-preview-card">
                      {previewAnimCSS && <style>{previewAnimCSS}</style>}
                      <style>{`.notification-page .product-info-preview-card .product-info-line .va-preview-text { font-size: ${fontSize}px !important; }`}</style>
                      {visitorEnabled ? (
                        <>
                          <div
                            key={`${animationStyle}-${animationSpeed}-${previewCount}`}
                            style={{ display: "flex", justifyContent: justify, marginTop: topMargin, marginBottom: bottomMargin, fontSize: `${fontSize}px` }}
                          >
                            <span
                              className={`product-info-line${previewAnimName ? " fomoify-preview-anim" : ""}`}
                              style={{
                                color: textColor,
                                fontWeight: textWeight,
                                gap: Math.max(6, Math.round(spacing / 2)),
                              }}
                            >
                              {visitorIcon !== "none" && (
                                <span
                                  className={`product-info-icon ${iconAnimationClass}`.trim()}
                                  style={{ color: visitorIconColor, width: iconSize, height: iconSize }}
                                >
                                  <Icon source={iconSourceFor(visitorIcon)} tone="inherit" />
                                </span>
                              )}
                              <span className="va-preview-text">{visitorText}</span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "24px 0" }}>
                          Visitor announcement is disabled
                        </div>
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
