import {
  BlockStack,
  Button,
  DatePicker,
  Icon,
  InlineStack,
  Popover,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { useLocation, useNavigate } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

const EMPTY_STATS = {
  total: 0,
  enabled: 0,
  disabled: 0,
  byType: {},
  analytics: {
    visitors: 0,
    clicks: 0,
    orders: 0,
    days: 7,
    startDate: "",
    endDate: "",
    series: { labels: [], visitors: [], clicks: [], orders: [] },
  },
  analyticsFilter: {
    range: "7d",
    days: 7,
    startDate: "",
    endDate: "",
  },
};

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 15 days", value: "15d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 60 days", value: "60d" },
  { label: "Last 90 days", value: "90d" },
  { label: "Last year", value: "365d" },
  { label: "Custom range", value: "custom" },
];

function toDayLabel(key) {
  const d = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toPrettyDate(key) {
  const d = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return key;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function buildLinePoints(values, xAt, yAt) {
  if (!Array.isArray(values) || !values.length) return "";
  return values.map((value, idx) => `${xAt(idx)},${yAt(value)}`).join(" ");
}

function parseDateKeyToDate(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toDateKeyFromDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayRange(days) {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return {
    start: toDateKeyFromDate(start),
    end: toDateKeyFromDate(end),
  };
}

function getRangeLabel(range) {
  const found = RANGE_OPTIONS.find((item) => item.value === range);
  return found?.label || "Last 7 days";
}

function getPresetDays(range) {
  const matched = String(range || "").match(/^(\d{1,3})d$/);
  const value = matched ? Number(matched[1]) : 7;
  return Number.isFinite(value) && value > 0 ? value : 7;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizePopupKey(value) {
  return String(value || "").trim().toLowerCase();
}

export default function StatsPanel({ stats }) {
  const navigate = useNavigate();
  const location = useLocation();
  const safeStats = stats || EMPTY_STATS;
  const analytics = safeStats.analytics || EMPTY_STATS.analytics;
  const analyticsFilter = safeStats.analyticsFilter || EMPTY_STATS.analyticsFilter;
  const breakdownRows = Array.isArray(analytics.breakdown)
    ? analytics.breakdown
    : [];
  const popupParam = normalizePopupKey(
    new URLSearchParams(location.search).get("popup") || "all"
  );
  const validPopupKeys = new Set([
    "all",
    ...breakdownRows.map((row) => normalizePopupKey(row?.key)),
  ]);
  const selectedPopup = validPopupKeys.has(popupParam) ? popupParam : "all";
  const popupOptions = [
    { label: "All popups", value: "all" },
    ...breakdownRows.map((row) => ({
      label: row?.label || row?.key || "Popup",
      value: normalizePopupKey(row?.key),
    })),
  ];
  const filteredBreakdownRows =
    selectedPopup === "all"
      ? breakdownRows
      : breakdownRows.filter(
          (row) => normalizePopupKey(row?.key) === selectedPopup
        );
  const series = analytics.series || EMPTY_STATS.analytics.series || {};
  const labels = Array.isArray(series.labels) ? series.labels : [];
  const baseImpressions = Array.isArray(series.visitors)
    ? series.visitors.map((value) => Number(value || 0))
    : [];
  const baseClicks = Array.isArray(series.clicks)
    ? series.clicks.map((value) => Number(value || 0))
    : [];
  const selectedPopupRow =
    selectedPopup === "all"
      ? null
      : breakdownRows.find(
          (row) => normalizePopupKey(row?.key) === selectedPopup
        ) || null;
  const selectedPopupByDay = new Map(
    (Array.isArray(selectedPopupRow?.details) ? selectedPopupRow.details : []).map(
      (detail) => [
        detail?.startDate,
        {
          impressions: Number(detail?.impressions || 0),
          clicks: Number(detail?.clicks || 0),
        },
      ]
    )
  );
  const impressions =
    selectedPopup === "all"
      ? baseImpressions
      : labels.map((day) => selectedPopupByDay.get(day)?.impressions || 0);
  const clicks =
    selectedPopup === "all"
      ? baseClicks
      : labels.map((day) => selectedPopupByDay.get(day)?.clicks || 0);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftRange, setDraftRange] = useState(analyticsFilter.range || "7d");
  const [draftStartDate, setDraftStartDate] = useState(
    analyticsFilter.startDate || ""
  );
  const [draftEndDate, setDraftEndDate] = useState(
    analyticsFilter.endDate || ""
  );
  const initialMonthDate = parseDateKeyToDate(analyticsFilter.startDate) || new Date();
  const [calendarMonth, setCalendarMonth] = useState(initialMonthDate.getMonth());
  const [calendarYear, setCalendarYear] = useState(initialMonthDate.getFullYear());
  const [expandedRows, setExpandedRows] = useState({});
  const [filterError, setFilterError] = useState("");
  const [chartViewportWidth, setChartViewportWidth] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const chartFrameRef = useRef(null);

  useEffect(() => {
    const nextRange = analyticsFilter.range || "7d";
    const nextStart = analyticsFilter.startDate || "";
    const nextEnd = analyticsFilter.endDate || "";
    const anchorDate = parseDateKeyToDate(nextStart) || new Date();
    setDraftRange(nextRange);
    setDraftStartDate(nextStart);
    setDraftEndDate(nextEnd);
    setCalendarMonth(anchorDate.getMonth());
    setCalendarYear(anchorDate.getFullYear());
    setFilterError("");
  }, [analyticsFilter.range, analyticsFilter.startDate, analyticsFilter.endDate]);

  useEffect(() => {
    setExpandedRows({});
  }, [
    analyticsFilter.range,
    analyticsFilter.startDate,
    analyticsFilter.endDate,
    selectedPopup,
  ]);

  useEffect(() => {
    const node = chartFrameRef.current;
    if (!node) return undefined;

    const updateWidth = () => {
      const nextWidth = Math.max(0, Math.floor(node.clientWidth || 0));
      setChartViewportWidth(nextWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setHoveredIndex(null);
  }, [
    analyticsFilter.range,
    analyticsFilter.startDate,
    analyticsFilter.endDate,
    selectedPopup,
  ]);

  const chartMax = Math.max(1, ...impressions, ...clicks);
  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, idx) =>
    Math.round(chartMax - (chartMax * idx) / yTicks)
  );

  const plotHeight = 220;
  const paddingTop = 16;
  const paddingBottom = 32;
  const paddingLeft = 44;
  const paddingRight = 18;
  const containerWidth = chartViewportWidth > 0 ? chartViewportWidth : 960;
  const fillWidth = Math.max(320, containerWidth - paddingLeft - paddingRight);
  const pointGap =
    labels.length > 180 ? 8 : labels.length > 90 ? 12 : labels.length > 45 ? 18 : 30;
  const naturalWidth = labels.length > 1 ? (labels.length - 1) * pointGap : fillWidth;
  const plotWidth = Math.max(fillWidth, naturalWidth);
  const svgWidth = paddingLeft + plotWidth + paddingRight;
  const svgHeight = paddingTop + plotHeight + paddingBottom;
  const baseY = paddingTop + plotHeight;
  const xStep = labels.length > 1 ? plotWidth / (labels.length - 1) : 0;
  const xAt = (idx) =>
    paddingLeft + (labels.length <= 1 ? plotWidth / 2 : idx * xStep);
  const yAt = (value) => paddingTop + (1 - Number(value || 0) / chartMax) * plotHeight;
  const impressionsLinePoints = buildLinePoints(impressions, xAt, yAt);
  const clicksLinePoints = buildLinePoints(clicks, xAt, yAt);
  const areaPoints =
    labels.length && impressionsLinePoints
      ? `${xAt(0)},${baseY} ${impressionsLinePoints} ${xAt(labels.length - 1)},${baseY}`
      : "";
  const xTickEvery = Math.max(1, Math.ceil(labels.length / 7));
  const hasActivePoint = hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < labels.length;
  const activeIndex = hasActivePoint ? hoveredIndex : null;
  const activeX = activeIndex !== null ? xAt(activeIndex) : 0;
  const activeDay = activeIndex !== null ? labels[activeIndex] : "";
  const activeImpressions = activeIndex !== null ? impressions[activeIndex] || 0 : 0;
  const activeClicks = activeIndex !== null ? clicks[activeIndex] || 0 : 0;
  const activePopupRows = activeDay
    ? filteredBreakdownRows
        .map((row) => {
          const detail = Array.isArray(row?.details)
            ? row.details.find((item) => item?.startDate === activeDay)
            : null;
          return {
            key: row?.key,
            label: row?.label || row?.key || "Popup",
            impressions: Number(detail?.impressions || 0),
            clicks: Number(detail?.clicks || 0),
          };
        })
        .filter((row) =>
          selectedPopup === "all" ? row.impressions > 0 || row.clicks > 0 : true
        )
    : [];
  const popupSummaryTitle =
    selectedPopup === "all"
      ? "Popup-wise counts"
      : `${selectedPopupRow?.label || "Popup"} data`;
  const tooltipWidth = selectedPopup === "all" ? 340 : 280;
  const tooltipLeft =
    activeIndex !== null
      ? clampNumber(activeX + 14, paddingLeft + 8, paddingLeft + plotWidth - tooltipWidth - 8)
      : 0;

  const resolveHoverIndex = (clientX, bounds) => {
    if (!labels.length || !bounds) return null;
    if (labels.length === 1) return 0;
    const xFromSvg = clientX - bounds.left;
    const xFromPlot = clampNumber(xFromSvg - paddingLeft, 0, plotWidth);
    const index = Math.round(xFromPlot / xStep);
    return clampNumber(index, 0, labels.length - 1);
  };

  const onChartMouseMove = (event) => {
    const svgBounds =
      event.currentTarget.ownerSVGElement?.getBoundingClientRect() ||
      event.currentTarget.getBoundingClientRect();
    const next = resolveHoverIndex(event.clientX, svgBounds);
    if (next === null) return;
    setHoveredIndex(next);
  };

  const onChartTouchMove = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    const svgBounds =
      event.currentTarget.ownerSVGElement?.getBoundingClientRect() ||
      event.currentTarget.getBoundingClientRect();
    const next = resolveHoverIndex(touch.clientX, svgBounds);
    if (next === null) return;
    setHoveredIndex(next);
  };

  const applyQuery = (nextRange, nextStart = "", nextEnd = "") => {
    const params = new URLSearchParams(location.search);
    params.set("range", nextRange);
    params.delete("days");

    if (nextRange === "custom") {
      params.set("start", nextStart);
      params.set("end", nextEnd);
    } else {
      params.delete("start");
      params.delete("end");
    }

    const query = params.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ""}`);
  };

  const onPopupFilterChange = (value) => {
    const next = normalizePopupKey(value);
    const params = new URLSearchParams(location.search);
    if (!next || next === "all") {
      params.delete("popup");
    } else {
      params.set("popup", next);
    }
    const query = params.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ""}`);
  };

  const resetDraftState = () => {
    const nextRange = analyticsFilter.range || "7d";
    const nextStart = analyticsFilter.startDate || "";
    const nextEnd = analyticsFilter.endDate || "";
    const anchorDate = parseDateKeyToDate(nextStart) || new Date();
    setDraftRange(nextRange);
    setDraftStartDate(nextStart);
    setDraftEndDate(nextEnd);
    setCalendarMonth(anchorDate.getMonth());
    setCalendarYear(anchorDate.getFullYear());
    setFilterError("");
  };

  const openPicker = () => {
    resetDraftState();
    setIsPickerOpen(true);
  };

  const closePicker = () => {
    setIsPickerOpen(false);
    setFilterError("");
  };

  const onDraftRangeChange = (value) => {
    setDraftRange(value);
    setFilterError("");
    if (value !== "custom") {
      const presetRange = getTodayRange(getPresetDays(value));
      setDraftStartDate(presetRange.start);
      setDraftEndDate(presetRange.end);
      const anchorDate = parseDateKeyToDate(presetRange.start) || new Date();
      setCalendarMonth(anchorDate.getMonth());
      setCalendarYear(anchorDate.getFullYear());
    }
  };

  const selectedRange = {
    start:
      parseDateKeyToDate(draftStartDate) ||
      parseDateKeyToDate(analyticsFilter.startDate) ||
      new Date(),
    end:
      parseDateKeyToDate(draftEndDate) ||
      parseDateKeyToDate(draftStartDate) ||
      parseDateKeyToDate(analyticsFilter.endDate) ||
      parseDateKeyToDate(analyticsFilter.startDate) ||
      new Date(),
  };

  const onCalendarChange = ({ start, end }) => {
    const startKey = toDateKeyFromDate(start);
    const endKey = toDateKeyFromDate(end || start);
    if (!startKey) return;
    setDraftRange("custom");
    setDraftStartDate(startKey);
    setDraftEndDate(endKey || startKey);
    setFilterError("");
  };

  const applyFilter = () => {
    if (draftRange !== "custom") {
      applyQuery(draftRange);
      closePicker();
      return;
    }
    if (!draftStartDate || !draftEndDate) {
      setFilterError("Select both start and end date.");
      return;
    }
    if (draftStartDate > draftEndDate) {
      setFilterError("Start date must be before end date.");
      return;
    }
    setFilterError("");
    applyQuery("custom", draftStartDate, draftEndDate);
    closePicker();
  };

  const toggleRow = (key) => {
    setExpandedRows((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const rangeButtonLabel =
    analyticsFilter.range === "custom" && analyticsFilter.startDate && analyticsFilter.endDate
      ? `${toDayLabel(analyticsFilter.startDate)} - ${toDayLabel(analyticsFilter.endDate)}`
      : getRangeLabel(analyticsFilter.range || "7d");

  return (
    <div style={{ width: "100%", maxWidth: 1220, margin: "0 auto" }}>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="start" wrap gap="300">
          <BlockStack gap="050">
            <Text variant="headingLg" as="h2">
              Analytics
            </Text>
            <Text as="p" tone="subdued">
              Data updates daily at 11:30 PM (UTC time)
            </Text>
          </BlockStack>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 220 }}>
              <Select
                label="Popup filter"
                options={popupOptions}
                value={selectedPopup}
                onChange={onPopupFilterChange}
              />
            </div>

          <Popover
            active={isPickerOpen}
            onClose={closePicker}
            preferredAlignment="right"
            preferredPosition="below"
            fluidContent
            activator={
              <Button onClick={openPicker} disclosure>
                {rangeButtonLabel}
              </Button>
            }
          >
            <div
              style={{
                width: 860,
                maxWidth: "calc(100vw - 48px)",
                padding: 10,
                border: "1px solid #D4D7DC",
                borderRadius: 12,
                background: "#FFFFFF",
                boxShadow: "0 14px 28px rgba(33, 43, 54, 0.12)",
                overflowX: "visible",
              }}
            >
              <BlockStack gap="200">
                <Select
                  label="Date range"
                  labelHidden
                  options={RANGE_OPTIONS}
                  value={draftRange}
                  onChange={onDraftRangeChange}
                />

                <InlineStack gap="100" blockAlign="center" wrap={false}>
                  <div style={{ minWidth: 200, flex: 1 }}>
                    <TextField
                      label="Start"
                      labelHidden
                      type="date"
                      value={draftStartDate}
                      onChange={(value) => {
                        setDraftRange("custom");
                        setDraftStartDate(value);
                        setFilterError("");
                      }}
                      autoComplete="off"
                    />
                  </div>
                  <Text as="span" variant="headingLg" tone="subdued">
                    →
                  </Text>
                  <div style={{ minWidth: 200, flex: 1 }}>
                    <TextField
                      label="End"
                      labelHidden
                      type="date"
                      value={draftEndDate}
                      onChange={(value) => {
                        setDraftRange("custom");
                        setDraftEndDate(value);
                        setFilterError("");
                      }}
                      autoComplete="off"
                    />
                  </div>
                </InlineStack>

                <DatePicker
                  month={calendarMonth}
                  year={calendarYear}
                  selected={selectedRange}
                  onMonthChange={(month, year) => {
                    setCalendarMonth(month);
                    setCalendarYear(year);
                  }}
                  onChange={onCalendarChange}
                  allowRange
                  multiMonth
                />

                {filterError ? (
                  <Text as="p" tone="critical" variant="bodySm">
                    {filterError}
                  </Text>
                ) : null}

                <InlineStack align="end" gap="200">
                  <Button
                    onClick={() => {
                      resetDraftState();
                      closePicker();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={applyFilter}>
                    Apply
                  </Button>
                </InlineStack>
              </BlockStack>
            </div>
          </Popover>
          </div>
        </InlineStack>

        <div
          style={{
            minHeight: 320,
            border: "1px solid #D4D7DC",
            borderRadius: 14,
            padding: "16px 16px 12px",
            background: "#FFFFFF",
          }}
        >
          {labels.length === 0 ? (
            <Text as="p" tone="subdued">
              No analytics data found for this range.
            </Text>
          ) : (
            <>
              <div ref={chartFrameRef} style={{ overflowX: "auto" }}>
                <div style={{ minWidth: svgWidth, position: "relative" }}>
                  <svg width={svgWidth} height={svgHeight}>
                    {yTickValues.map((tick, idx) => {
                      const y = paddingTop + (idx / yTicks) * plotHeight;
                      return (
                        <g key={`grid-${tick}-${idx}`}>
                          <line
                            x1={paddingLeft}
                            y1={y}
                            x2={paddingLeft + plotWidth}
                            y2={y}
                            stroke="#E7EAEE"
                          />
                          <text
                            x={paddingLeft - 8}
                            y={y + 4}
                            fontSize="11"
                            fill="#6B7280"
                            textAnchor="end"
                          >
                            {tick}
                          </text>
                        </g>
                      );
                    })}

                    {areaPoints ? (
                      <polygon
                        points={areaPoints}
                        fill="rgba(38, 169, 230, 0.16)"
                        stroke="none"
                      />
                    ) : null}

                    {impressionsLinePoints ? (
                      <polyline
                        points={impressionsLinePoints}
                        fill="none"
                        stroke="#26A9E6"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {clicksLinePoints ? (
                      <polyline
                        points={clicksLinePoints}
                        fill="none"
                        stroke="#6F4CF6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {activeIndex !== null ? (
                      <g>
                        <line
                          x1={activeX}
                          y1={paddingTop}
                          x2={activeX}
                          y2={baseY}
                          stroke="#C7CDD4"
                          strokeDasharray="4 4"
                        />
                        <circle
                          cx={activeX}
                          cy={yAt(activeImpressions)}
                          r="4.5"
                          fill="#26A9E6"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        <circle
                          cx={activeX}
                          cy={yAt(activeClicks)}
                          r="4.5"
                          fill="#6F4CF6"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                      </g>
                    ) : null}

                    <rect
                      x={paddingLeft}
                      y={paddingTop}
                      width={plotWidth}
                      height={plotHeight}
                      fill="transparent"
                      onMouseMove={onChartMouseMove}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onTouchStart={onChartTouchMove}
                      onTouchMove={onChartTouchMove}
                      onTouchEnd={() => setHoveredIndex(null)}
                    />
                  </svg>

                  {activeIndex !== null ? (
                    <div
                      style={{
                        position: "absolute",
                        top: 48,
                        left: tooltipLeft,
                        width: tooltipWidth,
                        background: "#FFFFFF",
                        border: "1px solid #D8DDE3",
                        borderRadius: 12,
                        boxShadow: "0 8px 24px rgba(33, 43, 54, 0.12)",
                        padding: 12,
                        pointerEvents: "none",
                      }}
                    >
                      <BlockStack gap="150">
                        <Text as="p" variant="headingSm">
                          {toDayLabel(activeDay)}
                        </Text>
                        <Text as="p" tone="subdued" variant="bodySm">
                          {selectedPopup === "all"
                            ? "All popups"
                            : `Popup: ${selectedPopupRow?.label || "Unknown"}`}
                        </Text>
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="100" blockAlign="center">
                            <span
                              style={{
                                width: 14,
                                height: 2,
                                borderRadius: 2,
                                background: "#26A9E6",
                                display: "inline-block",
                              }}
                            />
                            <Text as="span" variant="bodyMd">
                              Notification impression
                            </Text>
                          </InlineStack>
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {activeImpressions}
                          </Text>
                        </InlineStack>
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="100" blockAlign="center">
                            <span
                              style={{
                                width: 14,
                                height: 2,
                                borderRadius: 2,
                                background: "#6F4CF6",
                                display: "inline-block",
                              }}
                            />
                            <Text as="span" variant="bodyMd">
                              Notification clicks
                            </Text>
                          </InlineStack>
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {activeClicks}
                          </Text>
                        </InlineStack>

                        <div
                          style={{
                            borderTop: "1px solid #EEF1F4",
                            paddingTop: 8,
                          }}
                        >
                          <BlockStack gap="100">
                            <Text as="p" variant="bodySm" fontWeight="semibold">
                              {popupSummaryTitle}
                            </Text>
                            {activePopupRows.length > 0 ? (
                              activePopupRows.map((row) => (
                                <InlineStack
                                  key={`tip-${row.key}`}
                                  align="space-between"
                                  blockAlign="center"
                                  wrap={false}
                                >
                                  <Text as="span" variant="bodySm">
                                    {row.label}
                                  </Text>
                                  <Text as="span" tone="subdued" variant="bodySm">
                                    {`Impressions: ${row.impressions} | Clicks: ${row.clicks}`}
                                  </Text>
                                </InlineStack>
                              ))
                            ) : (
                              <Text as="p" tone="subdued" variant="bodySm">
                                No popup events on this day.
                              </Text>
                            )}
                          </BlockStack>
                        </div>
                      </BlockStack>
                    </div>
                  ) : null}

                  <div
                    style={{
                      marginTop: 6,
                      display: "grid",
                      gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))`,
                      gap: 0,
                      paddingLeft: 44,
                      paddingRight: 18,
                      width: svgWidth,
                    }}
                  >
                    {labels.map((day, idx) => (
                      <div key={`x-${day}`} style={{ textAlign: "center" }}>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {idx % xTickEvery === 0 || idx === labels.length - 1
                            ? toDayLabel(day)
                            : ""}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 6,
                    background: "#F3F4F6",
                    padding: "8px 12px",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 2,
                      borderRadius: 2,
                      background: "#26A9E6",
                      display: "inline-block",
                    }}
                  />
                  <Text as="span" variant="bodySm">
                    Notification impression
                  </Text>
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 6,
                    background: "#F3F4F6",
                    padding: "8px 12px",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 2,
                      borderRadius: 2,
                      background: "#6F4CF6",
                      display: "inline-block",
                    }}
                  />
                  <Text as="span" variant="bodySm">
                    Notification clicks
                  </Text>
                </div>
              </div>
            </>
          )}
        </div>

        <div
          style={{
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid #D4D7DC",
            background: "#FFFFFF",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.8fr 1fr 1fr 0.9fr",
              gap: 0,
              padding: "14px 16px",
              background: "#F6F6F7",
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              Type of notification
            </Text>
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              Total impressions
            </Text>
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              Total clicks
            </Text>
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              Close rate
            </Text>
          </div>

          {filteredBreakdownRows.length === 0 ? (
            <div style={{ padding: "14px 16px" }}>
              <Text as="p" tone="subdued">
                No analytics data found for this range.
              </Text>
            </div>
          ) : (
            filteredBreakdownRows.map((row) => {
              const isOpen = Boolean(expandedRows[row.key]);
              return (
                <div key={row.key} style={{ borderBottom: "1px solid #E5E7EB" }}>
                  <button
                    type="button"
                    onClick={() => toggleRow(row.key)}
                    aria-expanded={isOpen}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "1.8fr 1fr 1fr 0.9fr",
                      gap: 0,
                      padding: "12px 16px",
                      border: "none",
                      background: "#FFFFFF",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <InlineStack gap="100" blockAlign="center">
                      <span style={{ width: 20, display: "inline-flex", justifyContent: "center" }}>
                        <Icon source={isOpen ? ChevronUpIcon : ChevronDownIcon} />
                      </span>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {row.label}
                      </Text>
                    </InlineStack>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {row.totalImpressions || 0}
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {row.totalClicks || 0}
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {`${row.closeRate || 0}%`}
                    </Text>
                  </button>

                  {isOpen ? (
                    <div style={{ background: "#FAFAFB" }}>
                      {Array.isArray(row.details) && row.details.length > 0 ? (
                        row.details.map((detail, index) => (
                          <div
                            key={`${row.key}-${detail.startDate}-${index}`}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1.8fr 1fr 1fr 0.9fr",
                              gap: 0,
                              padding: "10px 16px",
                              borderTop: "1px solid #EEEFF1",
                            }}
                          >
                            <Text as="span" variant="bodyMd" tone="subdued">
                              {`${toPrettyDate(detail.startDate)} - ${toPrettyDate(detail.endDate)}`}
                            </Text>
                            <Text as="span" variant="bodyMd" tone="subdued">
                              {detail.impressions || 0}
                            </Text>
                            <Text as="span" variant="bodyMd" tone="subdued">
                              {detail.clicks || 0}
                            </Text>
                            <Text as="span" variant="bodyMd" tone="subdued">
                              {`${detail.closeRate || 0}%`}
                            </Text>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: "10px 16px", borderTop: "1px solid #EEEFF1" }}>
                          <Text as="p" tone="subdued" variant="bodyMd">
                            No detailed rows for this range.
                          </Text>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </BlockStack>
    </div>
  );
}
