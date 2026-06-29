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
  height: 176px;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 12%, rgba(203, 245, 218, 0.86), rgba(235, 250, 240, 0.72) 45%, rgba(255, 255, 255, 0.96) 78%),
    linear-gradient(180deg, #effbf3 0%, #ffffff 100%);
}
.notify-card-preview::after {
  content: "";
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 70px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.76));
  pointer-events: none;
}
.notify-image-pop {
  z-index: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 170px;
}
.notify-image-pop img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.notify-image-pop--flash {
  width: 190px;
}
.notify-image-pop--visitor,
.notify-image-pop--visitor-block,
.notify-image-pop--lowstock,
.notify-image-pop--stock-block {
  width: 182px;
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
    <div className="notify-card">
      <Card padding="0">
        <div className="notify-card-inner">
          <div className="notify-card-preview" aria-hidden>
            <div className={`notify-image-pop notify-image-pop--${previewType || "recent"}`}>
              <img src={imageSrc} alt="" />
            </div>
          </div>
          <Box padding="400">
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center" wrap>
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  {title}
                </Text>
                {badge ? <Badge tone="info">{badge}</Badge> : null}
              </InlineStack>
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
        </div>
      </Card>
    </div>
  );
}

const CARD_DATA = [
  {
    key: "recent",
    title: "Recent Purchase Notification",
    desc: "Show real recent purchases to build FOMO and trust with shoppers",
    badge: "Social proof",
    path: "/app/notification/recent",
    imageName: "Recent cart.png",
    previewType: "recent",
  },
  {
    key: "flash",
    title: "Flash Sale Notification",
    desc: "Promote limited-time discounts with a countdown bar on your storefront",
    badge: "Urgency",
    path: "/app/notification/flash",
    imageName: "Flash Sale.png",
    previewType: "flash",
  },
  {
    key: "visitor",
    title: "Visitor Notification",
    desc: "Show real-time visitor count to create urgency on your storefront",
    badge: "Social proof",
    path: "/app/notification/visitor",
    imageName: "Visitor Popup - new.png",
    previewType: "visitor",
  },
  {
    key: "lowstock",
    title: "Low Stock Notification",
    desc: "Alert shoppers when stock is running low to trigger urgency",
    badge: "Social proof",
    path: "/app/notification/lowstock",
    imageName: "low stock popup.png",
    previewType: "lowstock",
  },
  {
    key: "addtocart",
    title: "Add to Cart Notification",
    desc: "Show live add-to-cart activity to build social proof with shoppers",
    badge: "Social proof",
    path: "/app/notification/addtocart",
    imageName: "add to cart notification.png",
    previewType: "addtocart",
  },
  {
    key: "review",
    title: "Review Notification",
    desc: "Show product reviews to build trust and confidence with shoppers",
    badge: "Social proof",
    path: "/app/notification/review",
    imageName: "Review notification.png",
    previewType: "review",
  },
  {
    key: "visitor-block",
    title: "Visitor Announcement Bar",
    desc: "Show visitor count inside product information on selected products",
    badge: "Social proof",
    path: "/app/visitor-announcement",
    managePath: "/app/notification/manage?type=visitor-block",
    imageName: "Visitor Popup - new.png",
    previewType: "visitor-block",
  },
  {
    key: "stock-block",
    title: "Stock Announcement Bar",
    desc: "Show stock status inside product information on selected products",
    badge: "Urgency",
    path: "/app/stock-announcement",
    managePath: "/app/notification/manage?type=stock-block",
    imageName: "low stock popup.png",
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
        <div className="notify-page notification-page">
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
        </div>
      </Page>
    </>
  );
}
