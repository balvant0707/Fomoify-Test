import { useMemo, useState } from "react";
import {
  BlockStack,
  Card,
  Checkbox,
  Divider,
  Icon,
  InlineGrid,
  InlineStack,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import * as PolarisIcons from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import VisitorSpecificBox from "../components/productInfo/VisitorSpecificBox";
import { NotificationPageStyles } from "../components/notification/NotificationPageStyles";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
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
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.12);
}
.product-info-line {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  font-size: var(--product-info-font-size);
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
.product-info-icon-picker {
  display: grid;
  gap: 6px;
}
.product-info-icon-picker-label {
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}
.product-info-icon-picker-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.product-info-icon-picker-buttons .Polaris-Button {
  min-width: 86px;
}
.product-info-color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.product-info-color-swatch {
  width: 34px;
  height: 31px;
  margin: 0 -12px -5px 0;
  border: 0;
  border-left: 1px solid #c9cccf;
  border-radius: 0 8px 8px 0;
  overflow: hidden;
  cursor: pointer;
  background: transparent;
  padding: 0;
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
  .product-info-line {
    font-size: var(--product-info-mobile-font-size);
  }
}
`;

const humanizeIconName = (name) =>
  name
    .replace(/Icon$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const polarisIconOptions = Object.keys(PolarisIcons)
  .filter((name) => name.endsWith("Icon") && typeof PolarisIcons[name] === "function")
  .sort((a, b) => humanizeIconName(a).localeCompare(humanizeIconName(b)))
  .map((name) => ({
    label: humanizeIconName(name),
    value: name,
    source: PolarisIcons[name],
  }));

const iconOptions = [
  { label: "None", value: "none" },
  ...polarisIconOptions,
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

const legacyIconAliases = {
  eye: "ViewIcon",
  fire: "MagicIcon",
  user: "PersonIcon",
};

const iconSourceFor = (icon) => {
  const iconKey = legacyIconAliases[icon] || icon;
  return PolarisIcons[iconKey] || PolarisIcons.ViewIcon;
};

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
        <input
          className="product-info-color-swatch"
          type="color"
          value={safeValue}
          aria-label={`${label} color`}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
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

export default function VisitorBlockConfiguration() {
  const [activeSection, setActiveSection] = useState("layout");
  const [visitorEnabled, setVisitorEnabled] = useState(true);
  const [visitorMin, setVisitorMin] = useState("12");
  const [visitorMax, setVisitorMax] = useState("42");
  const [visitorTemplate, setVisitorTemplate] = useState(
    "{count} people are viewing this product"
  );
  const [visitorIcon, setVisitorIcon] = useState("ViewIcon");
  const [visitorIconColor, setVisitorIconColor] = useState("#6B4B7A");
  const [visitorRefresh, setVisitorRefresh] = useState("20");
  const [visitorBehavior, setVisitorBehavior] = useState("fixed");
  const [visitorProductScope, setVisitorProductScope] = useState("all");
  const [visitorProductModalOpen, setVisitorProductModalOpen] = useState(false);
  const [selectedVisitorProductIds, setSelectedVisitorProductIds] = useState([]);

  const [textColor, setTextColor] = useState("#3F3F46");
  const [fontSize, setFontSize] = useState(20);
  const [mobileFontSize, setMobileFontSize] = useState(16);
  const [iconSize, setIconSize] = useState(18);
  const [spacing, setSpacing] = useState(12);
  const [textWeight, setTextWeight] = useState("500");
  const [alignment, setAlignment] = useState("left");
  const [topMargin, setTopMargin] = useState(0);
  const [bottomMargin, setBottomMargin] = useState(0);
  const [customClass, setCustomClass] = useState("");

  const visitorCount = useMemo(() => {
    const min = Math.max(0, Number(visitorMin) || 0);
    const max = Math.max(min, Number(visitorMax) || min);
    return Math.round((min + max) / 2);
  }, [visitorMin, visitorMax]);

  const visitorText = visitorTemplate.replace("{count}", visitorCount);
  const justify =
    alignment === "center" ? "center" : alignment === "right" ? "flex-end" : "flex-start";

  return (
    <Page
      title="Visitor Announcement"
      backAction={{ content: "Back", url: "/app" }}
      primaryAction={{ content: "Save", disabled: true }}
    >
      <NotificationPageStyles />
      <style>{styles}</style>
      <div className="product-info-designer notification-page">
        <div className="product-info-sidebar" aria-label="Visitor block sections">
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
                  <TextField label="Refresh every seconds" value={visitorRefresh} onChange={setVisitorRefresh} type="number" autoComplete="off" />
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
                    <ColorField label="Visitor icon color" value={visitorIconColor} onChange={setVisitorIconColor} fallback="#6B4B7A" />
                  </div>
                </BlockStack>
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

            {activeSection === "display" && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Display
                  </Text>
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                    <Select label="Alignment" options={alignOptions} value={alignment} onChange={setAlignment} />
                    <Select label="Count behavior" options={behaviorOptions} value={visitorBehavior} onChange={setVisitorBehavior} />
                  </InlineGrid>
                  <Divider />
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
                  {visitorEnabled ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: justify,
                        marginTop: topMargin,
                        marginBottom: bottomMargin,
                      }}
                    >
                      <span
                        className="product-info-line"
                        style={{
                          color: textColor,
                          "--product-info-font-size": `${fontSize}px`,
                          "--product-info-mobile-font-size": `${mobileFontSize}px`,
                          fontWeight: textWeight,
                          gap: Math.max(6, Math.round(spacing / 2)),
                        }}
                      >
                        {visitorIcon !== "none" && (
                          <span
                            className="product-info-icon"
                            style={{
                              color: visitorIconColor,
                              "--product-info-icon-size": `${iconSize}px`,
                            }}
                          >
                            <Icon source={iconSourceFor(visitorIcon)} tone="inherit" />
                          </span>
                        )}
                        <span>{visitorText}</span>
                      </span>
                    </div>
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
  );
}
