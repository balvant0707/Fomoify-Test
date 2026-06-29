// app/routes/app.notification._index.jsx
import React, { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import {
  Page,
  Button,
  Loading,
  Badge,
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
.notify-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 15px;
}
.notify-card-shell {
  height: 100%;
  overflow: hidden;
  border: 1px solid #d7e4db;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.16);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}
.notify-card-shell:hover {
  border-color: #b7ddc4;
  box-shadow: 0 16px 34px rgba(18, 91, 63, 0.14);
  transform: translateY(-2px);
}
.notify-card-preview {
  position: relative;
  min-height: 130px;
  overflow: hidden;
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
.notify-card-top-content {
    padding: 0 20px 15px;
    background: #ffffff;
}
.notify-card-top-row {
  display: block;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.notify-card-top-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: start;
  gap: 10px;
  margin-top: 10px;
}
.notify-card-top-actions .Polaris-Button {
  flex: 0 0 auto;
}
.notify-browser-frame {
  position: absolute;
  right: -6px;
  top: 12px;
  width: 70%;
  height: 174px;
  border-radius: 20px 0 0 0;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
  opacity: 0.82;
}
.notify-browser-frame::before {
  content: "";
  position: absolute;
  left: 28px;
  top: 22px;
  width: 88px;
  height: 116px;
  border-radius: 16px;
  background: #eeeeee;
}
.notify-browser-frame::after {
  content: "";
  position: absolute;
  right: 24px;
  top: 22px;
  width: 88px;
  height: 24px;
  border-radius: 7px;
  background:
    linear-gradient(#eeeeee, #eeeeee) 0 0 / 100% 24px no-repeat,
    linear-gradient(#eeeeee, #eeeeee) 0 42px / 70% 24px no-repeat,
    linear-gradient(#eeeeee, #eeeeee) 0 84px / 100% 24px no-repeat;
}
.notify-image-pop {
  position: absolute;
  z-index: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 18px;
  background: transparent;
}
.notify-image-pop img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.notify-image-pop--recent,
.notify-image-pop--addtocart,
.notify-image-pop--review, 
.notify-image-pop--visitor,
.notify-image-pop--visitor-block,
.notify-image-pop--flash,
.notify-image-pop--lowstock,
.notify-image-pop--stock-block {
    width: 150px;
    height: 100%;
}
.notify-card-body {
  padding: 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.notify-card-title-row {
  min-width: 0;
  display: block;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.notify-card-content {
  min-width: 0;
  flex: 1;
}
.notify-card-actions {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.notify-card-actions .Polaris-Button {
  flex: 0 0 auto;
}
.notify-card-actions .Polaris-Button:not(.Polaris-Button--variantPrimary) {
  min-width: 78px;
}
@media (max-width: 767px) {
  .notify-grid {
    grid-template-columns: 1fr;
  }
  .notify-card-preview {
    min-height: 200px;
  }
  .notify-card-top-row {
    align-items: stretch;
    flex-direction: column;
  }
  .notify-card-top-actions {
    justify-content: flex-start;
  }
  .notify-card-top-actions .Polaris-Button {
    width: fit-content;
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
    <div className="notify-card-shell">
      <div className="notify-card-preview" aria-hidden>
        <div className={`notify-image-pop notify-image-pop--${previewType || "recent"}`}>
          <img src={imageSrc} alt="" />
        </div>
      </div>
      <Box className="notify-card-body">
        <BlockStack gap="200">
          <div className="notify-card-title-row">
            <Text as="h3" variant="headingMd" fontWeight="bold">
              {title}
            </Text>
            {badge ? <Badge tone="info">{badge}</Badge> : null}
          </div>
        </BlockStack>
      </Box>
      <div className="notify-card-top-content">
        <div className="notify-card-top-row">
          <Text as="p" tone="subdued" variant="bodyMd">
            {desc}
          </Text>
          <div className="notify-card-top-actions">
            <Button onClick={onCreate} loading={loading} disabled={loading}>
              {loading ? "Opening..." : "Create"}
            </Button>
            {showManage && (
              <Button onClick={onManage} disabled={loading}>
                Manage
              </Button>
            )}
          </div>
        </div>
      </div>
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
          <div className="notify-grid">
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
          </div>
        </div>
      </Page>
    </>
  );
}
