// app/routes/app.notification._index.jsx
import React, { useState, useCallback } from "react";
import { Page, Button, Loading, Card, BlockStack, InlineStack, Text, Box } from "@shopify/polaris";
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
  gap: 16px;
}
.notify-card-media {
  width: 82px;
  height: 82px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 1px solid #e3e5e7;
  border-radius: 8px;
  background: #f8f9fb;
  overflow: hidden;
}
.notify-card-media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
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
    <Card>
      <Box padding="400">
        <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
          <BlockStack gap="250">
            <Text as="h3" fontWeight="bold">{title}</Text>
            <Text as="p" tone="subdued">{desc}</Text>
            <InlineStack gap="200">
              <Button variant="primary" onClick={onCreate} loading={loading} disabled={loading}>
                {loading ? "Opening..." : "Create"}
              </Button>
              <Button onClick={onManage} disabled={loading}>
                Manage
              </Button>
            </InlineStack>
          </BlockStack>
          <div className="notify-card-media" aria-hidden>
            <img src={imageSrc} alt="" />
          </div>
        </InlineStack>
      </Box>
    </Card>
  );
}

const CARD_DATA = [
  {
    key: "recent",
    title: "Recent Purchases Popup",
    desc: "Show real-time customer activity to create social proof and FOMO.",
    path: "/app/notification/recent",
    imageName: "Recent cart.png",
  },
  {
    key: "flash",
    title: "Flash Sale / Countdown Bar",
    desc: "Announce limited-time offers with a sticky top bar and timer.",
    path: "/app/notification/flash",
    imageName: "Flash Sale.png",
  },
  {
    key: "visitor",
    title: "Visitor Popup",
    desc: "Show live visitor activity and product interest notifications.",
    path: "/app/notification/visitor",
    imageName: "Visitor Popup - new.png",
  },
  {
    key: "lowstock",
    title: "Low Stock Popup",
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
    (key) => {
      if (loadingKey) return;
      const loadingId = `${key}-manage`;
      setLoadingKey(loadingId);
      setTimeout(() => navigate("/app/notification/manage"), 450);
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
                onManage={() => goManage(card.key)}
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
