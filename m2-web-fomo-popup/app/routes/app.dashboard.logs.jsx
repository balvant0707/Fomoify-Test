// app/routes/app.dashboard.logs.jsx
import { defer } from "@remix-run/node";
import { Await, Link, useLoaderData } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Card,
  Frame,
  InlineStack,
  Page,
  SkeletonBodyText,
  Text,
} from "@shopify/polaris";
import React, { Suspense } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const LogsTable = React.lazy(
  () => import("../components/dashboard/LogsTable")
);

const EMPTY_ANALYTICS = {
  visitors: 0,
  clicks: 0,
  orders: 0,
  days: 30,
  series: { labels: [], visitors: [], clicks: [], orders: [] },
};

async function fetchAnalytics(shop, days = 30) {
  const model = prisma.popupAnalyticsEvent || prisma.popupanalyticsevent;
  if (!model) return { ...EMPTY_ANALYTICS, days };

  const d = Number(days) || 30;
  const since = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
  const where = { shop, createdAt: { gte: since } };

  try {
    const [clicks, orders, visitors, events] = await Promise.all([
      model.count({ where: { ...where, eventType: "click" } }),
      model.count({ where: { ...where, eventType: "order" } }),
      model.findMany({
        where: { ...where, eventType: "view", visitorId: { not: null } },
        select: { visitorId: true },
        distinct: ["visitorId"],
      }),
      model.findMany({
        where,
        select: { eventType: true, visitorId: true, createdAt: true },
      }),
    ]);

    const dayList = [];
    for (let i = d - 1; i >= 0; i--) {
      const dt = new Date();
      dt.setHours(0, 0, 0, 0);
      dt.setDate(dt.getDate() - i);
      dayList.push(dt.toISOString().slice(0, 10));
    }

    const clicksByDay = new Map(dayList.map((k) => [k, 0]));
    const ordersByDay = new Map(dayList.map((k) => [k, 0]));
    const visitorsByDaySet = new Map(dayList.map((k) => [k, new Set()]));

    for (const ev of events || []) {
      const day = new Date(ev.createdAt).toISOString().slice(0, 10);
      if (!clicksByDay.has(day)) continue;
      if (ev.eventType === "click") {
        clicksByDay.set(day, (clicksByDay.get(day) || 0) + 1);
      } else if (ev.eventType === "order") {
        ordersByDay.set(day, (ordersByDay.get(day) || 0) + 1);
      } else if (ev.eventType === "view" && ev.visitorId) {
        visitorsByDaySet.get(day)?.add(ev.visitorId);
      }
    }

    return {
      visitors: visitors.length,
      clicks,
      orders,
      days: d,
      series: {
        labels: dayList,
        visitors: dayList.map((k) => visitorsByDaySet.get(k)?.size || 0),
        clicks: dayList.map((k) => clicksByDay.get(k) || 0),
        orders: dayList.map((k) => ordersByDay.get(k) || 0),
      },
    };
  } catch (e) {
    console.error("[dashboard.logs.analytics] query failed:", e);
    return { ...EMPTY_ANALYTICS, days: d };
  }
}

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;
  if (!shop) throw new Response("Unauthorized", { status: 401 });
  const hasMissingColumnError = (error) => {
    const code = String(error?.code || "").toUpperCase();
    const msg = String(error?.message || "").toLowerCase();
    return (
      code === "P2022" ||
      msg.includes("unknown column") ||
      (msg.includes("column") && msg.includes("does not exist"))
    );
  };

  const tableModel = (key) => {
    switch (key) {
      case "recent":
        return prisma.recentpopupconfig || prisma.recentPopupConfig || null;
      case "flash":
        return prisma.flashpopupconfig || prisma.flashPopupConfig || null;
      case "visitor":
        return prisma.visitorpopupconfig || prisma.visitorPopupConfig || null;
      case "lowstock":
        return prisma.lowstockpopupconfig || prisma.lowStockPopupConfig || null;
      case "addtocart":
        return prisma.addtocartpopupconfig || prisma.addToCartPopupConfig || null;
      case "review":
        return prisma.reviewpopupconfig || prisma.reviewPopupConfig || null;
      default:
        return null;
    }
  };

  const keys = ["recent", "flash", "visitor", "lowstock", "addtocart", "review"];
  const legacySelectByKey = {
    recent: { id: true, enabled: true, showType: true, messageText: true },
    flash: {
      id: true,
      enabled: true,
      showType: true,
      messageTitle: true,
      name: true,
      messageText: true,
    },
    visitor: { id: true, enabled: true, message: true },
    lowstock: { id: true, enabled: true, message: true },
    addtocart: { id: true, enabled: true, message: true, timestamp: true },
    review: { id: true, enabled: true, message: true, timestamp: true },
  };
  const logsPromise = Promise.all(
    keys.map(async (key) => {
      const model = tableModel(key);
      if (!model?.findFirst) return null;
      try {
        const row = await model.findFirst({
          where: { shop },
          orderBy: { id: "desc" },
        });
        if (!row) return null;
        return {
          ...row,
          key,
          enabled:
            row.enabled === true ||
            row.enabled === 1 ||
            row.enabled === "1",
          messageText:
            row.messageText ||
            row.message ||
            row.name ||
            row.title ||
            "-",
          showType: row.showType || "-",
        };
      } catch (e) {
        if (!hasMissingColumnError(e)) {
          console.error(`[dashboard.logs] ${key} fetch failed:`, e);
          return null;
        }
        try {
          const select = legacySelectByKey[key];
          if (!select) return null;
          const row = await model.findFirst({
            where: { shop },
            orderBy: { id: "desc" },
            select,
          });
          if (!row) return null;
          return {
            ...row,
            key,
            enabled:
              row.enabled === true ||
              row.enabled === 1 ||
              row.enabled === "1",
            messageText:
              row.messageText ||
              row.message ||
              row.name ||
              row.title ||
              "-",
            showType: row.showType || "-",
          };
        } catch (retryError) {
          console.error(`[dashboard.logs] ${key} legacy fetch failed:`, retryError);
          return null;
        }
      }
    })
  ).then((rows) => rows.filter(Boolean));
  const analyticsPromise = fetchAnalytics(shop, 30);

  return defer({ logs: logsPromise, analytics: analyticsPromise });
}

function LogsSkeleton() {
  return (
    <Card>
      <div style={{ padding: 16 }}>
        <SkeletonBodyText lines={8} />
      </div>
    </Card>
  );
}

function AnalyticsChart({ analytics }) {
  const safe = analytics || EMPTY_ANALYTICS;
  const series = safe.series || EMPTY_ANALYTICS.series;
  const labels = Array.isArray(series.labels) ? series.labels : [];
  const visitors = Array.isArray(series.visitors) ? series.visitors : [];
  const clicks = Array.isArray(series.clicks) ? series.clicks : [];
  const orders = Array.isArray(series.orders) ? series.orders : [];
  const yMax = Math.max(1, ...visitors, ...clicks, ...orders);
  const yTicks = 6;
  const chartHeight = 220;
  const chartWidth = Math.max(420, labels.length * 64);
  const xTickEvery = Math.max(1, Math.floor(labels.length / 6));
  const groupWidth = labels.length > 0 ? chartWidth / labels.length : chartWidth;
  const clusterWidth = groupWidth * 0.82;
  const barGap = 0;
  const barWidth = clusterWidth / 3;

  const formatDateLabel = (value) => {
    const d = new Date(`${value}T00:00:00`);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  };

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <Text as="h2" variant="headingMd">
            Date-wise Analysis ({safe.days || 30} Days)
          </Text>
          <InlineStack gap="200" wrap>
            <Badge tone="attention">CVisitors: {safe.visitors || 0}</Badge>
            <Badge>Popup Clicks: {safe.clicks || 0}</Badge>
            <Badge tone="success">Orders: {safe.orders || 0}</Badge>
          </InlineStack>
        </InlineStack>

        <div
          style={{
            minHeight: 320,
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            padding: 12,
            background: "#FFFFFF",
          }}
        >
          {labels.length === 0 ? (
            <Text as="p" tone="subdued">
              No analytics data found yet.
            </Text>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: chartWidth + 40 }}>
                  <svg width={chartWidth + 40} height={chartHeight + 40}>
                    {[...Array(yTicks)].map((_, i) => {
                      const y = 10 + (i / (yTicks - 1)) * chartHeight;
                      const tickValue = Math.round(yMax - (i / (yTicks - 1)) * yMax);
                      return (
                        <g key={`grid-${i}`}>
                          <line x1="30" y1={y} x2={chartWidth + 30} y2={y} stroke="#E6E8EB" />
                          <text x="6" y={y + 4} fontSize="11" fill="#6B7280">
                            {tickValue}
                          </text>
                        </g>
                      );
                    })}
                    {labels.map((day, idx) => {
                      const groupX = idx * groupWidth;
                      const v = Number(visitors[idx] || 0);
                      const c = Number(clicks[idx] || 0);
                      const o = Number(orders[idx] || 0);
                      const vh = (v / yMax) * chartHeight;
                      const ch = (c / yMax) * chartHeight;
                      const oh = (o / yMax) * chartHeight;
                      const baseY = 10 + chartHeight;
                      const startX = 30 + groupX + (groupWidth - clusterWidth) / 2;
                      const dateTooltip =
                        `${formatDateLabel(day)}\n` +
                        `Visitors: ${v}\n` +
                        `Clicks: ${c}\n` +
                        `Orders: ${o}`;

                      return (
                        <g key={`bars-${day}`}>
                          <rect
                            x={startX}
                            y={baseY - vh}
                            width={barWidth}
                            height={Math.max(1, vh)}
                            rx="0"
                            fill="#E8C15F"
                          >
                            <title>{dateTooltip}</title>
                          </rect>
                          <rect
                            x={startX + barWidth + barGap}
                            y={baseY - ch}
                            width={barWidth}
                            height={Math.max(1, ch)}
                            rx="0"
                            fill="#4A98D0"
                          >
                            <title>{dateTooltip}</title>
                          </rect>
                          <rect
                            x={startX + (barWidth + barGap) * 2}
                            y={baseY - oh}
                            width={barWidth}
                            height={Math.max(1, oh)}
                            rx="0"
                            fill="#7A63B8"
                          >
                            <title>{dateTooltip}</title>
                          </rect>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                {labels.map((day, idx) => (
                  <div key={`x-${day}`} style={{ flex: 1, minWidth: 28, textAlign: "center" }}>
                    {idx % xTickEvery === 0 || idx === labels.length - 1 ? (
                      <Text as="span" variant="bodySm" tone="subdued">
                        {formatDateLabel(day)}
                      </Text>
                    ) : null}
                  </div>
                ))}
              </div>

              <InlineStack gap="300" align="center">
                <InlineStack gap="100" blockAlign="center">
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: "#E8C15F",
                      display: "inline-block",
                    }}
                  />
                  <Text as="span" variant="bodySm">
                    CVisitors
                  </Text>
                </InlineStack>
                <InlineStack gap="100" blockAlign="center">
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: "#4A98D0",
                      display: "inline-block",
                    }}
                  />
                  <Text as="span" variant="bodySm">
                    Popup Clicks
                  </Text>
                </InlineStack>
                <InlineStack gap="100" blockAlign="center">
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: "#7A63B8",
                      display: "inline-block",
                    }}
                  />
                  <Text as="span" variant="bodySm">
                    Orders
                  </Text>
                </InlineStack>
              </InlineStack>
            </>
          )}
        </div>
      </BlockStack>
    </Card>
  );
}

export default function DashboardLogsPage() {
  const { logs, analytics } = useLoaderData();

  return (
    <Frame>
      <Page
        title="Dashboard Logs"
        backAction={{ content: "Back", url: "/app/dashboard" }}
      >
        <Text as="p" tone="subdued">
          This page loads only when requested to keep the main dashboard fast.
        </Text>
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <Suspense fallback={<LogsSkeleton />}>
            <Await resolve={analytics} errorElement={<LogsSkeleton />}>
              {(data) => <AnalyticsChart analytics={data} />}
            </Await>
          </Suspense>
        </div>
        <Suspense fallback={<LogsSkeleton />}>
          <Await resolve={logs} errorElement={<LogsSkeleton />}>
            {(data) => (
              <Suspense fallback={<LogsSkeleton />}>
                <LogsTable items={data} />
              </Suspense>
            )}
          </Await>
        </Suspense>
        <div style={{ marginTop: 16 }}>
          <Link to="/app/dashboard" prefetch="intent">
            Back to Dashboard
          </Link>
        </div>
      </Page>
    </Frame>
  );
}
