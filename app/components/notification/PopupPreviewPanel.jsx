import { Badge, BlockStack, Box, Card, InlineStack, Text } from "@shopify/polaris";

const PANEL_STYLES = `
.popup-preview-panel {
  padding: var(--p-space-400);
}
.popup-preview-panel__header {
  padding-bottom: var(--p-space-300);
  border-bottom: var(--p-border-width-025) solid var(--p-color-border-secondary);
}
.popup-preview-panel__surface {
  min-height: 380px;
  border: 0;
  border-radius: 0;
  background:
    linear-gradient(90deg, rgba(227, 229, 231, 0.32) 1px, transparent 1px),
    linear-gradient(180deg, rgba(227, 229, 231, 0.32) 1px, transparent 1px),
    linear-gradient(180deg, #fbfbfc 0%, #f4f6f8 100%);
  background-size: 28px 28px, 28px 28px, auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: var(--p-space-400);
}
.popup-preview-panel__content {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}
.popup-preview-panel__empty {
  max-width: 280px;
  margin: 0 auto;
  text-align: center;
}
@media (max-width: 640px) {
  .popup-preview-panel {
    padding: var(--p-space-300);
  }
  .popup-preview-panel__surface {
    min-height: 320px;
    padding: var(--p-space-300);
  }
}
`;

export function PopupPreviewPanel({
  title = "Live preview",
  description = "Updates instantly from the settings on this page.",
  badge = "Desktop",
  emptyMessage = "",
  children,
}) {
  return (
    <Card padding="0">
      <style>{PANEL_STYLES}</style>
      <Box className="popup-preview-panel">
        <BlockStack gap="400">
          <InlineStack
            align="space-between"
            blockAlign="start"
            gap="300"
            wrap={false}
            className="popup-preview-panel__header"
          >
            <BlockStack gap="100">
              <Text as="h3" variant="headingMd" fontWeight="semibold">
                {title}
              </Text>
              {description ? (
                <Text as="p" variant="bodySm" tone="subdued">
                  {description}
                </Text>
              ) : null}
            </BlockStack>
            {badge ? <Badge tone="info">{badge}</Badge> : null}
          </InlineStack>

          <Box className="popup-preview-panel__surface">
            {emptyMessage ? (
              <Box className="popup-preview-panel__empty">
                <BlockStack gap="200">
                  <Text as="p" fontWeight="semibold">
                    Preview unavailable
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {emptyMessage}
                  </Text>
                </BlockStack>
              </Box>
            ) : (
              <Box className="popup-preview-panel__content">{children}</Box>
            )}
          </Box>
        </BlockStack>
      </Box>
    </Card>
  );
}
