// app/routes/app.analytics.jsx
import { defer } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import {
  Frame,
  Page,
} from "@shopify/polaris";
import React, { Suspense } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { getOrSetCache } from "../utils/serverCache.server";

const StatsPanel = React.lazy(
  () => import("../components/dashboard/StatsPanel")
);


const EMPTY_ANALYTICS = {
  visitors: 0,
  clicks: 0,
  orders: 0,
  days: 30,
  breakdown: [],
  series: { labels: [], visitors: [], clicks: [], orders: [] },
};

const PRESET_DAY_OPTIONS = [7, 15, 30, 60, 90, 365];
const MAX_CUSTOM_RANGE_DAYS = 366;
const TYPE_DEFINITIONS = [
  { key: "order", label: "Order", sourceTypes: ["recent", "orders"] },
  { key: "addtocart", label: "Add To Cart", sourceTypes: ["addtocart"] },
  { key: "visitor", label: "Visitor", sourceTypes: ["visitor"] },
  { key: "lowstock", label: "Low Stock", sourceTypes: ["lowstock"] },
  { key: "flash", label: "Flash Sale", sourceTypes: ["flash", "discount"] },
  { key: "review", label: "Reviews", sourceTypes: ["review", "reviews"] },
];

const normalizePopupType = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

const SOURCE_TYPE_TO_KEY = TYPE_DEFINITIONS.reduce((acc, def) => {
  for (const sourceType of def.sourceTypes) {
    acc[normalizePopupType(sourceType)] = def.key;
  }
  return acc;
}, {});

const closeRatePercent = (clicks, orders) => {
  const base = Number(clicks || 0);
  if (!base) return 0;
  return Math.round((Number(orders || 0) / base) * 100);
};

const createEmptyBreakdown = () =>
  TYPE_DEFINITIONS.map((def) => ({
    key: def.key,
    label: def.label,
    totalImpressions: 0,
    totalClicks: 0,
    totalOrders: 0,
    closeRate: 0,
    details: [],
  }));

const formatDateKey = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseDateKey = (value) => {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const dt = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return formatDateKey(dt) === raw ? raw : null;
};

const buildDayList = (startKey, endKey) => {
  const out = [];
  const start = new Date(`${startKey}T00:00:00Z`);
  const end = new Date(`${endKey}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  if (start > end) return out;
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(formatDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
};

const pickPresetDays = (value, fallback = 7) => {
  const n = Number(value);
  if (PRESET_DAY_OPTIONS.includes(n)) return n;
  return fallback;
};

function resolveAnalyticsFilter(url) {
  const rangeRaw = String(url.searchParams.get("range") || "").toLowerCase();
  const startRaw = parseDateKey(url.searchParams.get("start"));
  const endRaw = parseDateKey(url.searchParams.get("end"));

  if (rangeRaw === "custom" && startRaw && endRaw && startRaw <= endRaw) {
    const customDays = buildDayList(startRaw, endRaw).length;
    if (customDays >= 1 && customDays <= MAX_CUSTOM_RANGE_DAYS) {
      return {
        range: "custom",
        days: customDays,
        startDate: startRaw,
        endDate: endRaw,
      };
    }
  }

  const legacyDays = Number(url.searchParams.get("days"));
  const rangeDaysMatch = rangeRaw.match(/^(\d{1,3})d$/);
  const rangeDays = rangeDaysMatch ? Number(rangeDaysMatch[1]) : Number.NaN;
  const days = pickPresetDays(
    Number.isFinite(rangeDays) ? rangeDays : legacyDays,
    7
  );
  const now = new Date();
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  return {
    range: `${days}d`,
    days,
    startDate: formatDateKey(start),
    endDate: formatDateKey(end),
  };
}

async function fetchAnalytics(shop, filter) {
  const model = prisma.popupAnalyticsEvent || prisma.popupanalyticsevent;
  const fallback = {
    ...EMPTY_ANALYTICS,
    days: filter.days,
    startDate: filter.startDate,
    endDate: filter.endDate,
    breakdown: createEmptyBreakdown(),
  };
  if (!model) return fallback;

  const dayList = buildDayList(filter.startDate, filter.endDate);
  if (!dayList.length) return fallback;

  const startAt = new Date(`${filter.startDate}T00:00:00.000Z`);
  const endAt = new Date(`${filter.endDate}T23:59:59.999Z`);
  const where = { shop, createdAt: { gte: startAt, lte: endAt } };

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
        select: { popupType: true, eventType: true, visitorId: true, createdAt: true },
      }),
    ]);

    const clicksByDay = new Map(dayList.map((k) => [k, 0]));
    const ordersByDay = new Map(dayList.map((k) => [k, 0]));
    const visitorsByDaySet = new Map(dayList.map((k) => [k, new Set()]));
    const typeStats = TYPE_DEFINITIONS.reduce((acc, def) => {
      acc[def.key] = {
        totalImpressions: 0,
        totalClicks: 0,
        totalOrders: 0,
        byDay: new Map(),
      };
      return acc;
    }, {});

    for (const ev of events || []) {
      const day = formatDateKey(new Date(ev.createdAt));
      const typeKey = SOURCE_TYPE_TO_KEY[normalizePopupType(ev.popupType)] || null;
      if (!clicksByDay.has(day)) continue;

      if (ev.eventType === "click") {
        clicksByDay.set(day, (clicksByDay.get(day) || 0) + 1);
      } else if (ev.eventType === "order") {
        ordersByDay.set(day, (ordersByDay.get(day) || 0) + 1);
      } else if (ev.eventType === "view" && ev.visitorId) {
        visitorsByDaySet.get(day)?.add(ev.visitorId);
      }

      if (!typeKey || !typeStats[typeKey]) continue;
      const statsByType = typeStats[typeKey];
      const dayStats = statsByType.byDay.get(day) || {
        date: day,
        impressions: 0,
        clicks: 0,
        orders: 0,
      };

      if (ev.eventType === "view") {
        statsByType.totalImpressions += 1;
        dayStats.impressions += 1;
      } else if (ev.eventType === "click") {
        statsByType.totalClicks += 1;
        dayStats.clicks += 1;
      } else if (ev.eventType === "order") {
        statsByType.totalOrders += 1;
        dayStats.orders += 1;
      }

      statsByType.byDay.set(day, dayStats);
    }

    const breakdown = TYPE_DEFINITIONS.map((def) => {
      const row = typeStats[def.key];
      const details = Array.from(row.byDay.values())
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((item) => ({
          startDate: item.date,
          endDate: item.date,
          impressions: item.impressions,
          clicks: item.clicks,
          orders: item.orders,
          closeRate: closeRatePercent(item.clicks, item.orders),
        }));

      return {
        key: def.key,
        label: def.label,
        totalImpressions: row.totalImpressions,
        totalClicks: row.totalClicks,
        totalOrders: row.totalOrders,
        closeRate: closeRatePercent(row.totalClicks, row.totalOrders),
        details,
      };
    });

    return {
      visitors: visitors.length,
      clicks,
      orders,
      days: dayList.length,
      startDate: filter.startDate,
      endDate: filter.endDate,
      breakdown,
      series: {
        labels: dayList,
        visitors: dayList.map((k) => visitorsByDaySet.get(k)?.size || 0),
        clicks: dayList.map((k) => clicksByDay.get(k) || 0),
        orders: dayList.map((k) => ordersByDay.get(k) || 0),
      },
    };
  } catch (e) {
    console.error("[analytics.query] failed:", e);
    return fallback;
  }
}

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;
  if (!shop) throw new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const analyticsFilter = resolveAnalyticsFilter(url);

  const analyticsPromise = getOrSetCache(
    `analytics:stats:${shop}:${analyticsFilter.startDate}:${analyticsFilter.endDate}`,
    15000,
    () => fetchAnalytics(shop, analyticsFilter)
  ).catch((e) => {
    console.error("[analytics.loader] analytics query failed:", e);
    return {
      ...EMPTY_ANALYTICS,
      days: analyticsFilter.days,
      startDate: analyticsFilter.startDate,
      endDate: analyticsFilter.endDate,
      breakdown: createEmptyBreakdown(),
    };
  });

  return defer({
    stats: analyticsPromise.then((analytics) => ({
      analytics,
      analyticsFilter,
    })),
  });
}

export default function NotificationList() {
  const { stats } = useLoaderData();

  return (
    <Frame>
      <Page>
        <Suspense fallback={null}>
          <Await resolve={stats} errorElement={null}>
            {(data) => (
              <Suspense fallback={null}>
                <StatsPanel stats={data} />
              </Suspense>
            )}
          </Await>
        </Suspense>
      </Page>
    </Frame>
  );
}
