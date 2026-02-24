import { defer, json, redirect } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import { Card, Page, Spinner, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrSetCache } from "../utils/serverCache.server";
import NotificationTable from "../components/dashboard/NotificationTable";

const POPUP_KEYS = [
  "recent",
  "flash",
  "visitor",
  "lowstock",
  "addtocart",
  "review",
];
const ALLOWED_TYPES = new Set(["all", ...POPUP_KEYS]);
const ALLOWED_STATUSES = new Set(["all", "enabled", "disabled"]);

const legacySelectByKey = {
  recent: {
    id: true,
    createdAt: true,
    updatedAt: true,
    enabled: true,
    showType: true,
    messageText: true,
  },
  flash: {
    id: true,
    createdAt: true,
    updatedAt: true,
    enabled: true,
    showType: true,
    messageTitle: true,
    name: true,
    messageText: true,
  },
  visitor: {
    id: true,
    createdAt: true,
    updatedAt: true,
    enabled: true,
    showHome: true,
    showProduct: true,
    showCollectionList: true,
    showCollection: true,
    showCart: true,
    message: true,
    timestamp: true,
  },
  lowstock: {
    id: true,
    createdAt: true,
    updatedAt: true,
    enabled: true,
    showHome: true,
    showProduct: true,
    showCollectionList: true,
    showCollection: true,
    showCart: true,
    message: true,
  },
  addtocart: {
    id: true,
    createdAt: true,
    updatedAt: true,
    enabled: true,
    showHome: true,
    showProduct: true,
    showCollectionList: true,
    showCollection: true,
    showCart: true,
    message: true,
    timestamp: true,
  },
  review: {
    id: true,
    createdAt: true,
    updatedAt: true,
    enabled: true,
    showHome: true,
    showProduct: true,
    showCollectionList: true,
    showCollection: true,
    showCart: true,
    message: true,
    timestamp: true,
  },
};

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

const deriveShowType = (row) => {
  if (!row) return "allpage";
  const flags = [
    row.showHome,
    row.showProduct,
    row.showCollection,
    row.showCollectionList,
    row.showCart,
  ];
  const enabledCount = flags.filter(Boolean).length;
  if (enabledCount === 0) return "allpage";
  if (enabledCount > 1) return "allpage";
  if (row.showHome) return "home";
  if (row.showProduct) return "product";
  if (row.showCollection || row.showCollectionList) return "collection";
  if (row.showCart) return "cart";
  return "allpage";
};

const normalizeRow = (row, key) => ({
  ...row,
  key,
  enabled: row.enabled === true || row.enabled === 1 || row.enabled === "1",
  showType: row.showType || deriveShowType(row),
  messageText:
    row.messageText ||
    row.message ||
    row.name ||
    row.messageTitle ||
    row.title ||
    row.timestamp ||
    "",
});

async function fetchRows(shop) {
  const rows = [];

  for (const key of POPUP_KEYS) {
    const model = tableModel(key);
    if (!model?.findFirst) continue;

    try {
      const row = await model.findFirst({
        where: { shop },
        orderBy: { id: "desc" },
      });
      if (!row) continue;
      rows.push(normalizeRow(row, key));
      continue;
    } catch (error) {
      if (!hasMissingColumnError(error)) {
        console.error(`[notification.manage.loader] ${key} fetch failed:`, error);
        continue;
      }
    }

    try {
      const select = legacySelectByKey[key];
      if (!select) continue;
      const row = await model.findFirst({
        where: { shop },
        orderBy: { id: "desc" },
        select,
      });
      if (!row) continue;
      rows.push(normalizeRow(row, key));
    } catch (retryError) {
      console.error(
        `[notification.manage.loader] ${key} legacy fetch failed:`,
        retryError
      );
    }
  }

  return { rows, total: rows.length };
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const normalizeShop = (value) => String(value || "").trim().toLowerCase();
  const shop =
    normalizeShop(session?.shop) || normalizeShop(url.searchParams.get("shop"));

  if (!shop) throw new Response("Unauthorized", { status: 401 });

  const rawType = (url.searchParams.get("type") || "all").toLowerCase();
  const rawStatus = (url.searchParams.get("status") || "all").toLowerCase();
  const type = ALLOWED_TYPES.has(rawType) ? rawType : "all";
  const status = ALLOWED_STATUSES.has(rawStatus) ? rawStatus : "all";
  const q = (url.searchParams.get("q") || "").trim();
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSizeRaw = parseInt(url.searchParams.get("pageSize") || "10", 10);
  const pageSize = [10, 25, 50].includes(pageSizeRaw) ? pageSizeRaw : 10;

  const rowsPromise = getOrSetCache(`notification:rows:${shop}`, 10000, () =>
    fetchRows(shop)
  ).catch((error) => {
    console.error("[notification.manage.loader] Prisma error:", error);
    return {
      rows: [],
      total: 0,
      error: "Failed to load notification data.",
    };
  });

  return defer({
    critical: { page, pageSize, filters: { type, status, q } },
    rows: rowsPromise,
  });
};

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;
  if (!shop) throw new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const search = new URLSearchParams(url.search);
  const form = await request.formData();
  const _action = form.get("_action");
  const isFetch = request.headers.get("X-Remix-Request") === "yes";
  const safeJson = (data, init = {}) => json(data, init);
  const toSelf = () => {
    const qs = search.toString();
    return `/app/notification/manage${qs ? `?${qs}` : ""}`;
  };

  const id = Number(form.get("id"));
  const key = String(form.get("key") || "").toLowerCase();
  const model = tableModel(key);

  if (_action === "delete") {
    try {
      if (id && model?.deleteMany) {
        await model.deleteMany({ where: { id, shop } });
      }
      if (isFetch) return safeJson({ ok: true });
      search.set("deleted", "1");
      return redirect(toSelf());
    } catch (error) {
      console.error("[notification.manage.action:delete] error:", error);
      if (isFetch) {
        return safeJson({ ok: false, error: "Delete failed" }, { status: 500 });
      }
      search.set("error", "1");
      return redirect(toSelf());
    }
  }

  if (_action === "update") {
    const messageText = form.get("messageText")?.toString() ?? "";
    const showType = form.get("showType")?.toString() ?? "allpage";
    const enabled = form.get("enabled") === "on";
    try {
      const data =
        key === "recent" || key === "flash"
          ? { messageText, showType, enabled }
          : { enabled };
      if (id && model?.updateMany) {
        await model.updateMany({
          where: { id, shop },
          data,
        });
      }
      if (isFetch) return safeJson({ ok: true, saved: true });
      search.set("saved", "1");
      return redirect(toSelf());
    } catch (error) {
      console.error("[notification.manage.action:update] error:", error);
      if (isFetch) {
        return safeJson({ ok: false, error: "Update failed" }, { status: 500 });
      }
      search.set("error", "1");
      return redirect(toSelf());
    }
  }

  if (_action === "toggle-enabled") {
    const enabled = form.get("enabled") === "on";
    try {
      if (id && model?.updateMany) {
        await model.updateMany({
          where: { id, shop },
          data: { enabled },
        });
      }
      if (isFetch) return safeJson({ ok: true });
      return redirect(toSelf());
    } catch (error) {
      console.error("[notification.manage.action:toggle] error:", error);
      if (isFetch) {
        return safeJson({ ok: false, error: "Toggle failed" }, { status: 500 });
      }
      search.set("error", "1");
      return redirect(toSelf());
    }
  }

  return safeJson({ ok: false, error: "Unknown action" }, { status: 400 });
}

export default function NotificationManagePage() {
  const { critical, rows } = useLoaderData();

  return (
    <Page
      title="Manage Notifications"
      backAction={{ content: "Back", url: "/app/notification" }}
    >
      <Suspense
        fallback={
          <Card>
            <div
              style={{
                padding: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Spinner size="small" />
              <Text as="span" tone="subdued">
                Loading notifications...
              </Text>
            </div>
          </Card>
        }
      >
        <Await
          resolve={rows}
          errorElement={
            <Card>
              <div style={{ padding: 16 }}>
                <Text as="p" tone="critical">
                  Failed to load notifications.
                </Text>
              </div>
            </Card>
          }
        >
          {(data) => (
            <NotificationTable
              rows={data.rows}
              total={data.total}
              page={critical.page}
              pageSize={critical.pageSize}
              filters={critical.filters}
            />
          )}
        </Await>
      </Suspense>
    </Page>
  );
}
