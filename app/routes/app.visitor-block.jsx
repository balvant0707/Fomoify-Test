import { useMemo, useState } from "react";
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
import VisitorSpecificBox from "../components/productInfo/VisitorSpecificBox";

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
}
.product-info-icon {
  display: inline-grid;
  place-items: center;
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
}
`;

const iconOptions = [
  { label: "Eye", value: "eye" },
  { label: "Fire", value: "fire" },
  { label: "User", value: "user" },
  { label: "None", value: "none" },
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

const editorSections = [
  { id: "content", label: "Content" },
  { id: "layout", label: "Design" },
  { id: "display", label: "Display" },
];

const iconFor = (icon) => {
  if (icon === "fire") return "*";
  if (icon === "user") return "o";
  if (icon === "none") return "";
  return "O";
};

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

export default function VisitorBlockConfiguration() {
  const [activeSection, setActiveSection] = useState("content");
  const [visitorEnabled, setVisitorEnabled] = useState(true);
  const [visitorMin, setVisitorMin] = useState("12");
  const [visitorMax, setVisitorMax] = useState("42");
  const [visitorTemplate, setVisitorTemplate] = useState(
    "{count} people are viewing this product"
  );
  const [visitorIcon, setVisitorIcon] = useState("eye");
  const [visitorIconColor, setVisitorIconColor] = useState("#6B4B7A");
  const [visitorRefresh, setVisitorRefresh] = useState("20");
  const [visitorBehavior, setVisitorBehavior] = useState("fixed");
  const [visitorProductScope, setVisitorProductScope] = useState("all");
  const [visitorProductModalOpen, setVisitorProductModalOpen] = useState(false);
  const [selectedVisitorProductIds, setSelectedVisitorProductIds] = useState([
    "bedside-table",
  ]);

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
      title="Visitor Block"
      subtitle="Configuration for visitor count inside product information."
      backAction={{ content: "Back", url: "/app" }}
      primaryAction={{ content: "Save configuration", disabled: true }}
    >
      <style>{styles}</style>
      <div className="product-info-designer">
        <div className="product-info-sidebar" aria-label="Visitor block sections">
          {editorSections.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`product-info-nav-btn ${activeSection === id ? "is-active" : ""}`}
              onClick={() => setActiveSection(id)}
            >
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
                      Visitor count
                    </Text>
                    <Text as="p" tone="subdued">
                      Controls the line that shows how many shoppers are viewing the product.
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
                  <Select label="Visitor icon" options={iconOptions} value={visitorIcon} onChange={setVisitorIcon} />
                  <TextField label="Refresh every seconds" value={visitorRefresh} onChange={setVisitorRefresh} type="number" autoComplete="off" />
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
                    <ColorField label="Visitor icon color" value={visitorIconColor} onChange={setVisitorIconColor} fallback="#6B4B7A" />
                  </div>
                </BlockStack>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <Select label="Text weight" options={weightOptions} value={textWeight} onChange={setTextWeight} />
                  <TextField label="Custom CSS class" value={customClass} onChange={setCustomClass} autoComplete="off" />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <RangeSlider label="Font size" min={12} max={32} value={fontSize} onChange={setFontSize} output />
                  <RangeSlider label="Mobile font size" min={10} max={24} value={mobileFontSize} onChange={setMobileFontSize} output />
                  <RangeSlider label="Icon size" min={10} max={30} value={iconSize} onChange={setIconSize} output />
                  <RangeSlider label="Spacing" min={4} max={28} value={spacing} onChange={setSpacing} output />
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
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                    <RangeSlider label="Top margin" min={0} max={60} value={topMargin} onChange={setTopMargin} output />
                    <RangeSlider label="Bottom margin" min={0} max={60} value={bottomMargin} onChange={setBottomMargin} output />
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
                  {visitorEnabled && (
                    <span
                      className="product-info-line"
                      style={{
                        color: textColor,
                        fontSize,
                        fontWeight: textWeight,
                        gap: Math.max(6, Math.round(spacing / 2)),
                        justifyContent: justify,
                        marginTop: topMargin,
                        marginBottom: bottomMargin,
                        width: "100%",
                      }}
                    >
                      {visitorIcon !== "none" && (
                        <span
                          className="product-info-icon"
                          style={{ color: visitorIconColor, fontSize: iconSize, width: iconSize + 4 }}
                        >
                          {iconFor(visitorIcon)}
                        </span>
                      )}
                      <span>{visitorText}</span>
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
