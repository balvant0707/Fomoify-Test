// app/routes/app.notification._index.jsx
import React, { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import {
  Page,
  Button,
  Loading,
  Badge,
  Card,
  InlineGrid,
  InlineStack,
  BlockStack,
  Text,
  Box,
} from "@shopify/polaris";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { getNotificationManageVisibility } from "../utils/notificationConfigStatus.server";
import { NotificationPageStyles } from "../components/notification/NotificationPageStyles";

export const links = () => [
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap",
  },
];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = String(session?.shop || "").trim().toLowerCase();
  if (!shop) throw new Response("Unauthorized", { status: 401 });

  const hasManageByKey = await getNotificationManageVisibility(
    shop,
    CARD_DATA.map((card) => card.key)
  );

  return json({ hasManageByKey });
};

const DASHBOARD_STYLES = `
.notify-page {
  font-family: "DM Sans", sans-serif;
  color: #1b1b1b;
}
.notify-card {
  height: 100%;
}
.notify-card .Polaris-ShadowBevel {
  height: 100%;
}
.notify-card-inner {
  min-height: 100%;
  height:100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    transform 180ms ease;
}
.notify-card-inner:hover {
  border-color: #a9d8b8;
  background: #fbfffc;
  transform: translateY(-2px);
}
.notify-card-preview {
  position: relative;
  overflow: hidden;
}

.notify-image-pop {
  z-index: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 100%;
}
.notify-image-pop img {
  display: block;
  width: 100%;
  object-fit: contain;
}
.notify-image-pop--flash {
  width: 100%;
}
.notify-image-pop--visitor,
.notify-image-pop--visitor-block,
.notify-image-pop--lowstock,
.notify-image-pop--stock-block {
  width: 100%;
}
.notify-card-content {
  min-width: 0;
  flex: 1;
}
.notify-card-actions {
  padding-top: 2px;
}
@media (max-width: 767px) {
  .notify-card-preview {
    height: 160px;
  }
}
  span.Polaris-Badge.Polaris-Badge--toneInfo{
    width: fit-content;
  }
`;

function DashboardCard({
  title,
  desc,
  badge,
  imageName,
  previewType,
  onCreate,
  onManage,
  showManage,
  loading,
}) {
  const imageSrc = `/images/${encodeURIComponent(imageName)}`;

  return (
    <Box className="notify-card">
      <Card padding="0">
        <Box className="notify-card-inner">
          <Box className="notify-card-preview" aria-hidden>
            <Box className={`notify-image-pop notify-image-pop--${previewType || "recent"}`}>
              <img src={imageSrc} alt="" />
            </Box>
          </Box>
          <Box padding="400">
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center" wrap>
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  {title}
                </Text>
              </InlineStack>
                {badge && (
                  <Badge tone="info" style={{ width: "fit-content" }}>
                    {badge}
                  </Badge>
                )}
              <Text as="p" tone="subdued" variant="bodyMd">
                {desc}
              </Text>
              <InlineStack gap="200" blockAlign="center" wrap>
                <Button onClick={onCreate} loading={loading} disabled={loading}>
                  {loading ? "Opening..." : "Create"}
                </Button>
                {showManage && (
                  <Button onClick={onManage} disabled={loading}>
                    Manage
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}

const CARD_DATA = [
  {
    key: "recent",
    title: "Recent Purchase Notification",
    desc: "Show real recent purchases to build FOMO and trust with shoppers",
    path: "/app/notification/recent",
    badge: "Social proof",
    imageName: "recent.jpg",
    previewType: "recent",
  },
  {
    key: "flash",
    title: "Flash Sale Notification",
    desc: "Promote limited-time discounts with a countdown bar on your storefront",
    path: "/app/notification/flash",
    badge: "Social proof",
    imageName: "flashsale.jpg",
    previewType: "flash",
  },
  {
    key: "visitor",
    title: "Visitor Notification",
    desc: "Show real-time visitor count to create urgency on your storefront",
    path: "/app/notification/visitor",
    badge: "Social proof",
    imageName: "visitor.jpg",
    previewType: "visitor",
  },
  {
    key: "lowstock",
    title: "Low Stock Notification",
    desc: "Alert shoppers when stock is running low to trigger urgency",
    path: "/app/notification/lowstock",
    badge: "Social proof",
    imageName: "lowstock.jpg",
    previewType: "lowstock",
  },
  {
    key: "addtocart",
    title: "Add to Cart Notification",
    desc: "Show live add-to-cart activity to build social proof with shoppers",
    path: "/app/notification/addtocart",
    badge: "Upsell",
    imageName: "addtocart.jpg",
    previewType: "addtocart",
  },
  {
    key: "review",
    title: "Review Notification",
    desc: "Show product reviews to build trust and confidence with shoppers",
    path: "/app/notification/review",
    badge: "Social proof",
    imageName: "Review.jpg",
    previewType: "review",
  },
  {
    key: "visitor-block",
    title: "Visitor Announcement Bar",
    desc: "Show visitor count inside product information on selected products",
    path: "/app/visitor-announcement",
    managePath: "/app/notification/manage?type=visitor-block",
    badge: "Social proof",
    imageName: "visitorblock.jpg",
  },
  {
    key: "stock-block",
    title: "Stock Announcement Bar",
    desc: "Show stock status inside product information on selected products",
    path: "/app/stock-announcement",
    managePath: "/app/notification/manage?type=stock-block",
    badge: "Social proof",
    imageName: "lowstockblock.jpg",
    previewType: "stock-block",
  },
];

export default function NotificationDashboardIndex() {
  const { hasManageByKey = {} } = useLoaderData();
  const navigate = useNavigate();
  const [loadingKey, setLoadingKey] = useState(null);

  const go = useCallback(
    (path, key) => {
      if (loadingKey) return;
      setLoadingKey(key);
      setTimeout(() => navigate(path), 450);
    },
    [navigate, loadingKey]
  );

  const goManage = useCallback(
    (key, path = "/app/notification/manage") => {
      if (loadingKey) return;
      const loadingId = `${key}-manage`;
      setLoadingKey(loadingId);
      setTimeout(() => navigate(path), 450);
    },
    [navigate, loadingKey]
  );

  return (
    <>
      {loadingKey && <Loading />}
      <Page title="Sales Popups & Flash Bars">
        <NotificationPageStyles />
        <style>{DASHBOARD_STYLES}</style>
        <Box className="notify-page notification-page">
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="400">
            {CARD_DATA.map((card) => (
              <DashboardCard
                key={card.key}
                title={card.title}
                desc={card.desc}
                badge={card.badge}
                imageName={card.imageName}
                previewType={card.previewType}
                onCreate={() => go(card.path, `${card.key}-create`)}
                onManage={() => goManage(card.key, card.managePath)}
                showManage={Boolean(hasManageByKey[card.key])}
                loading={
                  loadingKey === `${card.key}-create` ||
                  loadingKey === `${card.key}-manage`
                }
              />
            ))}
          </InlineGrid>
        </Box>
      </Page>
    </>
  );
}
