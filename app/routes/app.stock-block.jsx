import { useState } from "react";
import {
  Badge,
  BlockStack,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Divider,
  InlineGrid,
  InlineStack,
  Page,
  RangeSlider,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import StockSpecificBox from "../components/productInfo/StockSpecificBox";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

const styles = `
.product-info-designer {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.product-info-sidebar {
  width: 80px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.product-info-nav-btn {
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 4px;
  padding: 5px 10px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
}
.product-info-nav-btn:hover {
  border-color: #cbd5e1;
}
.product-info-nav-btn.is-active {
  background: #2f855a;
  color: #ffffff;
  border-color: #2f855a;
}
.product-info-nav-icon {
  width: 20px;
  height: 20px;
}
.product-info-main {
  flex: 1;
  min-width: 0;
}
.product-info-preview-shell {
  min-height: 320px;
  display: grid;
  place-items: center;
  background: #f7f7f8;
  border: 1px solid #e3e3e3;
  border-radius: 8px;
  padding: 24px;
}
.product-info-preview-card {
  width: min(100%, 420px);
  background: #ffffff;
  border: 1px solid #ebebeb;
  border-radius: 8px;
  padding: 18px 20px;
}
.product-info-line {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  font-size: var(--product-info-font-size);
}
.product-info-dot {
  display: inline-block;
  border-radius: 999px;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.72);
  flex: 0 0 auto;
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
    min-width: 92px;
  }
  .product-info-color-grid {
    grid-template-columns: 1fr;
  }
  .product-info-line {
    font-size: var(--product-info-mobile-font-size);
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

function ContentIcon() {
  return (
    <svg className="product-info-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h11M4 17h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DesignIcon() {
  return (
    <svg className="product-info-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function DisplayIcon() {
  return (
    <svg className="product-info-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 20h6M12 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const editorSections = [
  { id: "content", label: "Content", Icon: ContentIcon },
  { id: "layout", label: "Design", Icon: DesignIcon },
  { id: "display", label: "Display", Icon: DisplayIcon },
];

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

export default function StockBlockConfiguration() {
  const [activeSection, setActiveSection] = useState("content");
  const [stockEnabled, setStockEnabled] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [showExactStock, setShowExactStock] = useState(false);
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [inStockText, setInStockText] = useState("In stock");
  const [lowStockText, setLowStockText] = useState("Only {count} left");
  const [outOfStockText, setOutOfStockText] = useState("Out of stock");
  const [inStockDotColor, setInStockDotColor] = useState("#42D66B");
  const [lowStockDotColor, setLowStockDotColor] = useState("#F59E0B");
  const [outStockDotColor, setOutStockDotColor] = useState("#EF4444");
  const [stockProductScope, setStockProductScope] = useState("all");
  const [stockProductModalOpen, setStockProductModalOpen] = useState(false);
  const [selectedStockProductIds, setSelectedStockProductIds] = useState([
    "bedside-table",
  ]);

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

  const previewStockCount = Math.max(1, Number(lowStockThreshold) || 5);
  const stockText = showExactStock
    ? lowStockText.replace("{count}", previewStockCount)
    : inStockText;
  const stockDot = showExactStock ? lowStockDotColor : inStockDotColor;
  const justify =
    alignment === "center" ? "center" : alignment === "right" ? "flex-end" : "flex-start";

  return (
    <Page
      title="Stock Block"
      subtitle="Configuration for stock status inside product information."
      backAction={{ content: "Back", url: "/app" }}
      primaryAction={{ content: "Save configuration", disabled: true }}
    >
      <style>{styles}</style>
      <div className="product-info-designer">
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
                      Stock status
                    </Text>
                    <Text as="p" tone="subdued">
                      Controls the stock availability line shown on product pages.
                    </Text>
                  </BlockStack>
                  <Checkbox label="Show" checked={stockEnabled} onChange={setStockEnabled} />
                </InlineStack>
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <TextField label="Low stock threshold" value={lowStockThreshold} onChange={setLowStockThreshold} type="number" autoComplete="off" />
                  <Checkbox label="Show exact quantity" checked={showExactStock} onChange={setShowExactStock} />
                  <Checkbox label="Hide when out of stock" checked={hideOutOfStock} onChange={setHideOutOfStock} />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <TextField label="In-stock text" value={inStockText} onChange={setInStockText} autoComplete="off" />
                  <TextField label="Low-stock text" value={lowStockText} onChange={setLowStockText} autoComplete="off" />
                  <TextField label="Out-of-stock text" value={outOfStockText} onChange={setOutOfStockText} autoComplete="off" />
                </InlineGrid>
                <Divider />
                <StockSpecificBox
                  productScope={stockProductScope}
                  setProductScope={setStockProductScope}
                  productModalOpen={stockProductModalOpen}
                  setProductModalOpen={setStockProductModalOpen}
                  selectedProductIds={selectedStockProductIds}
                  setSelectedProductIds={setSelectedStockProductIds}
                />
              </BlockStack>
            </Card>
            )}

            {activeSection === "layout" && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Layout and style
                </Text>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Color picker
                  </Text>
                  <div className="product-info-color-grid">
                    <ColorField label="Text color" value={textColor} onChange={setTextColor} fallback="#3F3F46" />
                    <ColorField label="In-stock dot color" value={inStockDotColor} onChange={setInStockDotColor} fallback="#42D66B" />
                    <ColorField label="Low-stock dot color" value={lowStockDotColor} onChange={setLowStockDotColor} fallback="#F59E0B" />
                    <ColorField label="Out-of-stock dot color" value={outStockDotColor} onChange={setOutStockDotColor} fallback="#EF4444" />
                  </div>
                </BlockStack>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <Select label="Text weight" options={weightOptions} value={textWeight} onChange={setTextWeight} />
                  <TextField label="Custom CSS class" value={customClass} onChange={setCustomClass} autoComplete="off" />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <BlockStack gap="200">
                    <RangeSlider label="Font size" min={12} max={32} value={fontSize} onChange={setFontSize} output />
                    <NumberField label="Font size input" value={fontSize} onChange={setFontSize} min={12} max={32} />
                  </BlockStack>
                  <BlockStack gap="200">
                    <RangeSlider label="Mobile font size" min={10} max={24} value={mobileFontSize} onChange={setMobileFontSize} output />
                    <NumberField label="Mobile font size input" value={mobileFontSize} onChange={setMobileFontSize} min={10} max={24} />
                  </BlockStack>
                  <BlockStack gap="200">
                    <RangeSlider label="Icon size" min={8} max={30} value={dotSize} onChange={setDotSize} output />
                    <NumberField label="Icon size input" value={dotSize} onChange={setDotSize} min={8} max={30} />
                  </BlockStack>
                  <BlockStack gap="200">
                    <RangeSlider label="Field spacing" min={4} max={28} value={spacing} onChange={setSpacing} output />
                    <NumberField label="Field spacing input" value={spacing} onChange={setSpacing} min={4} max={28} />
                  </BlockStack>
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
                  <Select label="Alignment" options={alignOptions} value={alignment} onChange={setAlignment} />
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                    <BlockStack gap="200">
                      <RangeSlider label="Top margin" min={0} max={60} value={topMargin} onChange={setTopMargin} output />
                      <NumberField label="Top margin input" value={topMargin} onChange={setTopMargin} min={0} max={60} />
                    </BlockStack>
                    <BlockStack gap="200">
                      <RangeSlider label="Bottom margin" min={0} max={60} value={bottomMargin} onChange={setBottomMargin} output />
                      <NumberField label="Bottom margin input" value={bottomMargin} onChange={setBottomMargin} min={0} max={60} />
                    </BlockStack>
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
                <Badge tone="attention">Design only</Badge>
              </InlineStack>
              <Divider />
              <div className="product-info-preview-shell">
                <div className="product-info-preview-card">
                  {stockEnabled && (
                    <span
                      className="product-info-line"
                      style={{
                        color: textColor,
                        "--product-info-font-size": `${fontSize}px`,
                        "--product-info-mobile-font-size": `${mobileFontSize}px`,
                        fontWeight: textWeight,
                        gap: Math.max(6, Math.round(spacing / 2)),
                        justifyContent: justify,
                        marginTop: topMargin,
                        marginBottom: bottomMargin,
                        width: "100%",
                      }}
                    >
                      <span
                        className="product-info-dot"
                        style={{
                          width: dotSize,
                          height: dotSize,
                          background: stockDot,
                        }}
                      />
                      <span>{stockText}</span>
                    </span>
                  )}
                </div>
              </div>
              <ButtonGroup>
                <Button disabled>Reset</Button>
                <Button variant="primary" disabled>
                  Save configuration
                </Button>
              </ButtonGroup>
            </BlockStack>
          </Card>
        </InlineGrid>
        </div>
      </div>
    </Page>
  );
}
