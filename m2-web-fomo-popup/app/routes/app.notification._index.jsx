// app/routes/app.notification._index.jsx
import React, { useState, useCallback } from "react";
import { Page, Button, Loading } from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";

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
.notify-card {
  border-radius: 16px;
  border: 1px solid #e6e6e6;
  background: #ffffff;
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-shadow: 0 8px 20px rgba(15, 15, 15, 0.06);
}
.notify-card-body {
  display: grid;
  gap: 8px;
}
.notify-card-title {
  font-size: 15px;
  font-weight: 700;
}
.notify-card-desc {
  font-size: 13px;
  color: #6b6b6b;
  max-width: 300px;
}
.notify-actions {
  display: flex;
  gap: 10px;
}
.notify-card-right {
  display: grid;
  gap: 8px;
  justify-items: end;
}
.notify-bar {
  height: 10px;
  width: 86px;
  border-radius: 999px;
  background: #e5e7eb;
}
.notify-bar.is-primary {
  height: 12px;
  width: 96px;
  background: #2f855a;
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
    <div className="notify-card">
      <div className="notify-card-body">
        <div className="notify-card-title">{title}</div>
        <div className="notify-card-desc">{desc}</div>
        <div className="notify-actions">
          <Button primary onClick={onCreate} loading={loading} disabled={loading}>
            {loading ? "Opening..." : "Create"}
          </Button>
          <Button onClick={onManage} disabled={loading}>
            Manage
          </Button>
        </div>
      </div>
      <div className="notify-card-right" aria-hidden>
        <img
          src={imageSrc}
          alt={`${title} preview`}
          width={80}
          height={80}
          style={{ borderRadius: 8, objectFit: "contain" }}
        />
      </div>
    </div>
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
        <style>{DASHBOARD_STYLES}</style>
        <div className="notify-page">
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
