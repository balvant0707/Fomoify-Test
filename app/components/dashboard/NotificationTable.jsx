import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  EmptyState,
  Button,
  ButtonGroup,
  IndexTable,
  InlineStack,
  Modal,
  Pagination,
  Select,
  SkeletonBodyText,
  Spinner,
  Text,
  TextField,
  Toast,
} from "@shopify/polaris";
import {
  Form,
  useFetcher,
  useLocation,
  useNavigate,
  useNavigation,
  useRevalidator,
  useSubmit,
} from "@remix-run/react";
import { useIdle } from "../../utils/useIdle";

const TITLES = {
  recent: "Recent Purchases",
  flash: "Flash Sale Bars",
  visitor: "Visitor Popup",
  lowstock: "Low Stock Popup",
  addtocart: "Add to Cart Popup",
  review: "Review Notification",
};
const ALLOWED_TYPES = new Set(["all", ...Object.keys(TITLES)]);
const ALLOWED_STATUSES = new Set(["all", "enabled", "disabled"]);

const pageOptions = [
  { label: "All Pages", value: "allpage" },
  { label: "Home Page", value: "home" },
  { label: "Product Page", value: "product" },
  { label: "Collection Page", value: "collection" },
  { label: "Pages", value: "pages" },
  { label: "Cart Page", value: "cart" },
];

function pretty(str) {
  return String(str || "")
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function showTypeLabel(val) {
  const found = pageOptions.find((o) => o.value === val);
  return found?.label || pretty(val);
}

function formatLines(val) {
  if (val == null) return "";

  if (Array.isArray(val)) {
    return val
      .map((x) => (x == null ? "" : String(x).trim()))
      .filter(Boolean)
      .join("\n");
  }

  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return "";

    try {
      const maybe = JSON.parse(s);
      if (Array.isArray(maybe)) {
        return maybe
          .map((x) => (x == null ? "" : String(x).trim()))
          .filter(Boolean)
          .join("\n");
      }
      if (typeof maybe === "object" && maybe !== null) {
        return Object.entries(maybe)
          .map(([k, v]) => `${k}: ${v ?? ""}`.trim())
          .filter(Boolean)
          .join("\n");
      }
      return String(maybe);
    } catch {
      return s
        .split(/\r?\n|,/)
        .map((t) => t.trim())
        .filter(Boolean)
        .join("\n");
    }
  }

  if (typeof val === "object") {
    try {
      return Object.entries(val)
        .map(([k, v]) => `${k}: ${v ?? ""}`.trim())
        .filter(Boolean)
        .join("\n");
    } catch {
      return String(val);
    }
  }

  return String(val);
}

function getTitleDisplay(row) {
  if (row.key === "recent") return "Recent Order Popup";
  if (row.key === "flash") {
    return (
      (row.messageTitle && row.messageTitle.trim?.()) ||
      row.messageTitlesJson ||
      TITLES.flash
    );
  }
  return TITLES[row.key] || pretty(row.key);
}

function getMessageDisplay(row) {
  const flashVal =
    (row.location && row.location.trim?.()) ||
    row.locationsJson ||
    (row.name && row.name.trim?.()) ||
    row.namesJson ||
    row.messageText ||
    "";

  const nonFlashVal =
    (row.messageText && row.messageText.trim?.()) ||
    (row.message && row.message.trim?.()) ||
    row.namesJson ||
    row.locationsJson ||
    "";

  return row.key === "flash" ? flashVal : nonFlashVal;
}

function makeSearchString(row) {
  const title = formatLines(getTitleDisplay(row));
  const message = formatLines(getMessageDisplay(row));
  const popupType = TITLES[row.key] || pretty(row.key);
  const pages = showTypeLabel(row.showType);

  return [title, message, popupType, pages].join(" ").toLowerCase();
}

function TableSkeleton() {
  return (
    <Card>
      <div style={{ padding: 16 }}>
        <SkeletonBodyText lines={8} />
      </div>
    </Card>
  );
}

export default function NotificationTable({
  rows,
  total,
  page,
  pageSize,
  filters,
}) {
  const navigation = useNavigation();
  const submit = useSubmit();
  const navigate = useNavigate();
  const location = useLocation();
  const delFetcher = useFetcher();
  const { revalidate } = useRevalidator();
  const isIdleReady = useIdle(200);

  const isBusy = navigation.state !== "idle";

  const [showSaved, setShowSaved] = useState(() => {
    try {
      return new URLSearchParams(location.search).get("saved") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (showSaved) {
      const sp = new URLSearchParams(location.search);
      sp.delete("saved");
      navigate(`${location.pathname}?${sp.toString()}`, { replace: true });
    }
  }, [showSaved, location.pathname, location.search, navigate]);

  const [showDeleted, setShowDeleted] = useState(() => {
    try {
      return new URLSearchParams(location.search).get("deleted") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (showDeleted) {
      const sp = new URLSearchParams(location.search);
      sp.delete("deleted");
      navigate(`${location.pathname}?${sp.toString()}`, { replace: true });
    }
  }, [showDeleted, location.pathname, location.search, navigate]);

  const [deletedIds, setDeletedIds] = useState(new Set());
  useEffect(() => {
    if (delFetcher.state === "idle" && delFetcher.data?.ok) {
      revalidate();
    }
  }, [delFetcher.state, delFetcher.data, revalidate]);

  const [delRow, setDelRow] = useState(null);
  const openDelete = useCallback((row) => setDelRow(row), []);
  const closeDelete = useCallback(() => setDelRow(null), []);
  const confirmDelete = useCallback(() => {
    if (!delRow) return;
    const id = delRow.id;
    const key = delRow.key;
    setDelRow(null);
    setShowDeleted(true);
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const fd = new FormData();
    fd.set("_action", "delete");
    fd.set("id", String(id));
    if (key) fd.set("key", String(key));
    delFetcher.submit(fd, { method: "post" });
  }, [delRow, delFetcher]);

  const styles = `
    .col-title, .col-text { white-space: pre-line !important; word-break: break-word; }
    .col-title .Polaris-Text, .col-text .Polaris-Text { display: block; }
    .Polaris-IndexTable__TableRow { border-bottom: 1px solid rgba(0,0,0,0.08); }
    .rk-table-wrap { position: relative; }
    .rk-table-wrap.rk-busy .Polaris-IndexTable__TableRow { background: rgba(255,255,255,0.7); }
    .rk-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.06); backdrop-filter: blur(1px); border-radius: 8px; z-index: 2; }
    .rk-table-loader { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 3; background: rgba(255,255,255,0.85);
      border: 1px solid rgba(0,0,0,0.05); border-radius: 999px; padding: 6px 10px; text-align: center; backdrop-filter: blur(2px); }
    .rk-switch { width: 42px; height: 24px; border-radius: 999px; background: rgba(0,0,0,0.2); border: none; padding: 0; position: relative; cursor: pointer; transition: background .15s; }
    .rk-switch .knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.2); transition: left .15s; }
    .rk-switch.is-on { background: #4f0d4d; }
    .rk-switch.is-on .knob { left: 20px; }
    .rk-switch:disabled { opacity: .5; cursor: not-allowed; }
  `;

  const typeOptions = [
    { label: "Show All", value: "all" },
    ...Object.keys(TITLES).map((k) => ({
      label: TITLES[k] || pretty(k),
      value: k,
    })),
  ];
  const statusTabs = [
    { label: "Show All", value: "all" },
    { label: "Active", value: "enabled" },
    { label: "Inactive", value: "disabled" },
  ];

  const currentType = ALLOWED_TYPES.has(filters?.type) ? filters.type : "all";
  const currentStatus = ALLOWED_STATUSES.has(filters?.status)
    ? filters.status
    : "all";
  const initialQ = filters?.q || "";

  const [query, setQuery] = useState(initialQ);
  const tRef = useRef(null);
  useEffect(() => setQuery(initialQ), [initialQ]);

  const submitWith = (params) => {
    const fd = new FormData();
    fd.set("type", params.type ?? currentType);
    fd.set("status", params.status ?? currentStatus);
    fd.set("q", params.q ?? query);
    fd.set("page", String(params.page ?? page));
    fd.set("pageSize", String(params.pageSize ?? pageSize));
    submit(fd, { method: "get", replace: true });
  };

  const qLower = (query || "").trim().toLowerCase();
  const safeRows = Array.isArray(rows) ? rows : [];

  const filtered = useMemo(() => {
    if (!isIdleReady) return [];

    let list = safeRows.filter((r) => !deletedIds.has(r.id));
    if (currentType !== "all") {
      list = list.filter((r) => r.key === currentType);
    }
    if (currentStatus === "enabled") {
      list = list.filter((r) => r.enabled);
    } else if (currentStatus === "disabled") {
      list = list.filter((r) => !r.enabled);
    }
    if (qLower) {
      list = list.filter((row) => makeSearchString(row).includes(qLower));
    }
    return list;
  }, [safeRows, deletedIds, currentType, currentStatus, qLower, isIdleReady]);

  const totalFiltered = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const visibleRows = filtered.slice(startIdx, startIdx + pageSize);

  return (
    <>
      <style>{styles}</style>

      <Card>
        <div style={{ padding: 16 }}>
          <Form method="get" id="filtersForm">
            <InlineStack gap="400" align="center" wrap>
              <Select
                label="Notification Type"
                labelHidden
                name="type"
                options={typeOptions}
                value={currentType}
                onChange={(val) => submitWith({ type: val, page: 1 })}
              />

              <ButtonGroup segmented>
                {statusTabs.map((t) => (
                  <Button
                    key={t.value}
                    pressed={currentStatus === t.value}
                    onClick={() => submitWith({ status: t.value, page: 1 })}
                  >
                    {t.label}
                  </Button>
                ))}
              </ButtonGroup>

              <div style={{ minWidth: 280, flex: "1 1 280px" }}>
                <TextField
                  label="Search notifications"
                  labelHidden
                  placeholder="Search notifications..."
                  name="q"
                  value={query}
                  onChange={(val) => {
                    setQuery(val);
                    if (tRef.current) clearTimeout(tRef.current);
                    tRef.current = setTimeout(
                      () => submitWith({ q: val, page: 1 }),
                      300
                    );
                  }}
                  onBlur={() => submitWith({ q: query, page: 1 })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitWith({ q: query, page: 1 });
                    }
                  }}
                  autoComplete="off"
                />
              </div>

              <Select
                label="Page size"
                labelHidden
                options={[
                  { label: "10 / page", value: "10" },
                  { label: "25 / page", value: "25" },
                  { label: "50 / page", value: "50" },
                ]}
                value={String(pageSize)}
                onChange={(val) =>
                  submitWith({ pageSize: Number(val), page: 1 })
                }
              />

              <Button primary url="/app/notification">
                + New Notification
              </Button>

              {/* <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  submitWith({
                    type: "all",
                    status: "all",
                    q: "",
                    page: 1,
                  });
                }}
              >
                Clear Filters
              </Button> */}
            </InlineStack>
          </Form>
        </div>
      </Card>

      {!isIdleReady ? (
        <TableSkeleton />
      ) : (
        <Card>
          <div className={`rk-table-wrap ${isBusy ? "rk-busy" : ""}`}>
            {isBusy && <div className="rk-overlay" />}
            {isBusy && (
              <div className="rk-table-loader">
                <Spinner size="small" accessibilityLabel="Loading table" />
              </div>
            )}

            {visibleRows.length === 0 ? (
              <EmptyState
                heading="No notifications found"
                action={{
                  content: "Create notification",
                  url: "/app/notification",
                }}
                secondaryAction={{
                  content: "Clear filters",
                  onAction: () =>
                    submitWith({
                      type: "all",
                      status: "all",
                      q: "",
                      page: 1,
                    }),
                }}
                image=""
              >
                <p>Try adjusting your filters or create a new one.</p>
              </EmptyState>
            ) : (
              <IndexTable
                selectable={false}
                resourceName={{ singular: "config", plural: "configs" }}
                itemCount={totalFiltered}
                headings={[
                  { title: "No" },
                  { title: "Popup Title" },
                  { title: "Show On Pages" },
                  { title: "Status" },
                  { title: "Actions" },
                ]}
                stickyHeader
              >
                {visibleRows.map((row, index) => {
                  const titleDisplay = getTitleDisplay(row);
                  const textDisplay = getMessageDisplay(row);
                  const nextEnabled = !row.enabled;

                  return (
                    <IndexTable.Row
                      id={String(row.id)}
                      key={row.id}
                      position={index}
                    >
                      <IndexTable.Cell style={{ width: 64 }}>
                        <Text as="span">{startIdx + index + 1}</Text>
                      </IndexTable.Cell>

                      <IndexTable.Cell className="col-title">
                        <Text as="p" breakWord>
                          {formatLines(titleDisplay)}
                        </Text>
                      </IndexTable.Cell>

                      {/* <IndexTable.Cell className="col-text">
                        <Text as="p" breakWord>
                          {formatLines(textDisplay)}
                        </Text>
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        {TITLES[row.key] || pretty(row.key)}
                      </IndexTable.Cell> */}

                      <IndexTable.Cell>
                        {showTypeLabel(row.showType)}
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        <Form method="post">
                          <input
                            type="hidden"
                            name="_action"
                            value="toggle-enabled"
                          />
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="key" value={row.key} />
                          <input
                            type="hidden"
                            name="enabled"
                            value={nextEnabled ? "on" : ""}
                          />
                          <button
                            type="submit"
                            className={`rk-switch ${
                              row.enabled ? "is-on" : ""
                            }`}
                            aria-label={row.enabled ? "Enabled" : "Disabled"}
                            disabled={isBusy}
                            title={
                              row.enabled
                                ? "Click to disable"
                                : "Click to enable"
                            }
                          >
                            <span className="knob" />
                          </button>
                        </Form>
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        <InlineStack align="start" gap="200">
                          <Button
                            onClick={() => navigate(`/app/notification/${row.key}`)}
                          >
                            Edit
                          </Button>
                          <Button
                            tone="critical"
                            variant="secondary"
                            onClick={() => openDelete(row)}
                          >
                            Delete
                          </Button>
                        </InlineStack>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  );
                })}
              </IndexTable>
            )}
          </div>
        </Card>
      )}

      <Card>
        <InlineStack align="space-between" blockAlign="center" padding="400">
          <Text as="span" tone="subdued">
            {totalFiltered === 0
              ? "No results"
              : `Showing ${startIdx + 1}-${startIdx + visibleRows.length} of ${totalFiltered}`}
          </Text>

          <InlineStack gap="200" align="center">
            <Pagination
              hasPrevious={page > 1}
              onPrevious={() => submitWith({ page: page - 1 })}
              hasNext={page < Math.max(Math.ceil(totalFiltered / pageSize), 1)}
              onNext={() => submitWith({ page: page + 1 })}
            />
          </InlineStack>
        </InlineStack>
      </Card>

      <Modal
        open={!!delRow}
        onClose={closeDelete}
        title={delRow ? `Delete ID ${delRow.id}?` : "Delete"}
        primaryAction={{
          content: "Yes, delete",
          destructive: true,
          onAction: confirmDelete,
          disabled: isBusy || delFetcher.state !== "idle",
        }}
        secondaryActions={[
          { content: "No", onAction: closeDelete, disabled: isBusy },
        ]}
      >
        <Modal.Section>
          {delRow && (
            <div style={{ display: "grid", gap: 8 }}>
              <Text as="p">
                Are you sure you want to delete this notification?
              </Text>
              <Text as="p" tone="subdued">
                <b>Type:</b> {TITLES[delRow.key] || pretty(delRow.key)}
              </Text>
              <Text as="p" tone="critical">
                This action cannot be undone.
              </Text>
            </div>
          )}
        </Modal.Section>
      </Modal>

      {showSaved && (
        <Toast
          content="Saved successfully"
          duration={2200}
          onDismiss={() => setShowSaved(false)}
        />
      )}
      {showDeleted && (
        <Toast
          content="Deleted successfully"
          duration={2200}
          onDismiss={() => setShowDeleted(false)}
        />
      )}
    </>
  );
}
