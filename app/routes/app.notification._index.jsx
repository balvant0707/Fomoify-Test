// app/routes/app.notification._index.jsx
import React, { useState, useCallback } from "react";
import { Page, Button, Loading, BlockStack, InlineStack, Text, Box } from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { NotificationPageStyles } from "../components/notification/NotificationPageStyles";

export const links = () => [
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap",
  },
];

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

const DASHBOARD_STYLES = `
.notify-page {
  font-family: "DM Sans", sans-serif;
  color: #1b1b1b;
}
.notify-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 10px;
}
.notify-card-shell {
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #ffffff;
  min-height: 120px;
  padding: 10px 10px;
  box-shadow: 0 1px 0 rgba(17, 24, 39, 0.04);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}
.notify-card-shell:hover {
  border-color: #1a73e8;
  box-shadow: 0 10px 26px rgba(26, 115, 232, 0.14);
  transform: translateY(-2px);
}
.notify-card-layout {
  height: 100%;
}
.notify-card-media {
  width: 62px;
  height: 62px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: transparent;
  overflow: hidden;
}
.notify-card-media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.notify-card-content {
  min-width: 0;
  flex: 1;
}
.notify-card-actions {
  width: fit-content;
  padding-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.notify-card-actions .Polaris-Button {
  flex: 0 0 auto;
}
`;

function DashboardCard({
  title,
  desc,
  imageName,
  onCreate,
  onManage,
  loading,
}) {
  const imageSrc = `/images/${encodeURIComponent(imageName)}`;

  return (
    <div className="notify-card-shell">
      <InlineStack
        align="space-between"
        blockAlign="center"
        gap="400"
        wrap={false}
        className="notify-card-layout"
      >
        <Box className="notify-card-content">
          <BlockStack gap="150">
            <Text as="h3" fontSize="16px !important" fontWeight="bold">{title}</Text>
            <Text as="p" tone="subdued">{desc}</Text>
            <div className="notify-card-actions">
              <Button variant="primary" onClick={onCreate} loading={loading} disabled={loading}>
                {loading ? "Opening..." : "Create"}
              </Button>
              <Button onClick={onManage} disabled={loading}>
                Manage
              </Button>
            </div>
          </BlockStack>
        </Box>
        <div className="notify-card-media" aria-hidden>
          <img src={imageSrc} alt="" />
        </div>
      </InlineStack>
    </div>
  );
}

const CARD_DATA = [
  {
    key: "recent",
    title: "Recent Purchase Notification",
    desc: "Show real-time customer activity to create social proof and FOMO.",
    path: "/app/notification/recent",
    imageName: "Recent cart.png",
  },
  {
    key: "flash",
    title: "Flash Sale Notification",
    desc: "Announce limited-time offers with a sticky top bar and timer.",
    path: "/app/notification/flash",
    imageName: "Flash Sale.png",
  },
  {
    key: "visitor",
    title: "Visitor Notification",
    desc: "Show live visitor activity and product interest notifications.",
    path: "/app/notification/visitor",
    imageName: "Visitor Popup - new.png",
  },
  {
    key: "lowstock",
    title: "Low Stock Notification",
    desc: "Create urgency when inventory is running low.",
    path: "/app/notification/lowstock",
    imageName: "low stock popup.png",
  },
  {
    key: "addtocart",
    title: "Add to Cart Notification",
    desc: "Show live add-to-cart activity to build social proof.",
    path: "/app/notification/addtocart",
    imageName: "add to cart notification.png",
  },
  {
    key: "review",
    title: "Review Notification",
    desc: "Show new product reviews to build trust and social proof.",
    path: "/app/notification/review",
    imageName: "Review notification.png",
  },
  {
    key: "visitor-block",
    title: "Visitor Announcement Bar",
    desc: "Show visitor count inside product information on all or selected products.",
    path: "/app/visitor-announcement",
    managePath: "/app/notification/manage?type=visitor-block",
    imageName: "Visitor Popup - new.png",
  },
  {
    key: "stock-block",
    title: "Stock Announcement Bar",
    desc: "Show stock status inside product information on all or selected products.",
    path: "/app/stock-announcement",
    managePath: "/app/notification/manage?type=stock-block",
    imageName: "low stock popup.png",
  },
];

export default function NotificationDashboardIndex() {
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
                imageName={card.imageName}
                onCreate={() => go(card.path, `${card.key}-create`)}
                onManage={() => goManage(card.key, card.managePath)}
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
