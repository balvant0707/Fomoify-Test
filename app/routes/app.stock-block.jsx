import { useState } from "react";
import {
  Badge,
  BlockStack,
  Box,
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
  display: grid;
  gap: 16px;
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
.product-info-dot {
  display: inline-block;
  border-radius: 999px;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.72);
  flex: 0 0 auto;
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

export default function StockBlockConfiguration() {
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
        <InlineGrid columns={{ xs: 1, md: "1fr 420px" }} gap="400">
          <BlockStack gap="400">
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
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <TextField label="In-stock dot color" value={inStockDotColor} onChange={setInStockDotColor} autoComplete="off" />
                  <TextField label="Low-stock dot color" value={lowStockDotColor} onChange={setLowStockDotColor} autoComplete="off" />
                  <TextField label="Out-of-stock dot color" value={outStockDotColor} onChange={setOutStockDotColor} autoComplete="off" />
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

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Layout and style
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <TextField label="Text color" value={textColor} onChange={setTextColor} autoComplete="off" />
                  <Select label="Text weight" options={weightOptions} value={textWeight} onChange={setTextWeight} />
                  <TextField label="Custom CSS class" value={customClass} onChange={setCustomClass} autoComplete="off" />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <RangeSlider label="Font size" min={12} max={32} value={fontSize} onChange={setFontSize} output />
                  <RangeSlider label="Mobile font size" min={10} max={24} value={mobileFontSize} onChange={setMobileFontSize} output />
                  <RangeSlider label="Dot size" min={8} max={30} value={dotSize} onChange={setDotSize} output />
                  <RangeSlider label="Spacing" min={4} max={28} value={spacing} onChange={setSpacing} output />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <Select label="Alignment" options={alignOptions} value={alignment} onChange={setAlignment} />
                  <Box />
                  <Box />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <RangeSlider label="Top margin" min={0} max={60} value={topMargin} onChange={setTopMargin} output />
                  <RangeSlider label="Bottom margin" min={0} max={60} value={bottomMargin} onChange={setBottomMargin} output />
                </InlineGrid>
              </BlockStack>
            </Card>
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
                        fontSize,
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
    </Page>
  );
}
