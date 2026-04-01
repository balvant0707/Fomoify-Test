// app/utils/sendOrderReviewEmail.server.js
import { sendOwnerEmail } from "./sendOwnerEmail.server";

const fmt = (v) => String(v || "").trim();
const fmtDate = (d) => {
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

function buildProductRows(products) {
  if (!Array.isArray(products) || !products.length) {
    return `<tr><td colspan="3" style="padding:10px 8px;color:#6b7280;">No products</td></tr>`;
  }
  return products
    .map(
      (p) => `
    <tr>
      <td style="padding:9px 8px;border-bottom:1px solid #f3f4f6;">${fmt(p.name) || "—"}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #f3f4f6;text-align:center;">${Number(p.quantity) || 1}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">$${fmt(p.price) || "0.00"}</td>
    </tr>`
    )
    .join("");
}

function buildAnalyticsRows(events) {
  if (!Array.isArray(events) || !events.length) return null;
  return events
    .slice(0, 15)
    .map(
      (ev) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;">${fmt(ev.productHandle) || "—"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;">${fmt(ev.pagePath) || "—"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;">${fmtDate(ev.createdAt)}</td>
    </tr>`
    )
    .join("");
}

function buildAnalyticsSection(title, count, rows, accentColor) {
  const rowsHtml =
    rows ||
    `<tr><td colspan="3" style="padding:10px 8px;color:#6b7280;font-size:13px;">No events yet.</td></tr>`;
  return `
    <h3 style="margin:32px 0 4px;font-size:15px;color:#374151;">${title}</h3>
    <p style="margin:0 0 10px;font-size:13px;color:#6b7280;">
      Total: <strong style="color:${accentColor};">${count}</strong>
      event${count !== 1 ? "s" : ""} in the last 30 days
    </p>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:7px 8px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:13px;color:#374151;">Product</th>
          <th style="padding:7px 8px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:13px;color:#374151;">Page</th>
          <th style="padding:7px 8px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:13px;color:#374151;">Date</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

export async function sendOrderReviewEmail({
  shop,
  shopName,
  ownerEmail,
  order,
  reviewStats,
}) {
  const { customerName, customerEmail, products, orderId } = order || {};
  const { impressions = [], clicks = [] } = reviewStats || {};

  const displayShop = fmt(shopName) || shop;
  const displayOrderId = fmt(orderId) || "N/A";
  const displayName = fmt(customerName) || "Customer";
  const displayEmail = fmt(customerEmail) || "—";

  const reviewRequestUrl = [
    `https://${shop}/apps/fomo/review-request`,
    `?shop=${encodeURIComponent(shop)}`,
    `&orderId=${encodeURIComponent(displayOrderId)}`,
    `&email=${encodeURIComponent(displayEmail)}`,
    `&name=${encodeURIComponent(displayName)}`,
  ].join("");

  const impressionRows = buildAnalyticsRows(impressions);
  const clickRows = buildAnalyticsRows(clicks);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:620px;margin:0 auto;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 24px;border-radius:10px 10px 0 0;">
      <h2 style="margin:0 0 6px;color:#fff;font-size:20px;">New Order Received</h2>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">Order #${displayOrderId} &mdash; ${displayShop}</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;">

      <!-- Customer -->
      <h3 style="margin:0 0 12px;font-size:15px;color:#374151;">Customer Details</h3>
      <table style="border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:4px 16px 4px 0;color:#6b7280;">Name</td>
          <td style="padding:4px 0;color:#111;">${displayName}</td>
        </tr>
        <tr>
          <td style="padding:4px 16px 4px 0;color:#6b7280;">Email</td>
          <td style="padding:4px 0;color:#111;">${displayEmail}</td>
        </tr>
      </table>

      <!-- Products -->
      <h3 style="margin:28px 0 10px;font-size:15px;color:#374151;">Products Ordered</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:9px 8px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:14px;color:#374151;">Product</th>
            <th style="padding:9px 8px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:14px;color:#374151;">Qty</th>
            <th style="padding:9px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:14px;color:#374151;">Price</th>
          </tr>
        </thead>
        <tbody>${buildProductRows(products)}</tbody>
      </table>

      <!-- Analytics -->
      ${buildAnalyticsSection("Review Popup Impressions", impressions.length, impressionRows, "#6366f1")}
      ${buildAnalyticsSection("Review Popup Clicks", clicks.length, clickRows, "#10b981")}

      <!-- CTA -->
      <div style="margin:36px 0 8px;padding:24px;background:#f9fafb;border-radius:8px;text-align:center;">
        <p style="margin:0 0 16px;font-size:15px;color:#374151;">
          Ask <strong>${displayName}</strong> to leave a review for their purchase!
        </p>
        <a href="${reviewRequestUrl}"
           style="display:inline-block;background:#6366f1;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
          Request a Review
        </a>
        <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
          Clicking this button will send a review request email to ${displayEmail}
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="padding:14px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;text-align:center;font-size:12px;color:#9ca3af;">
      Fomoify Sales Popup &amp; Proof &mdash; ${shop}
    </div>

  </div>
</body>
</html>`;

  await sendOwnerEmail({
    to: ownerEmail,
    subject: `New Order #${displayOrderId} — Request a Review from ${displayName}`,
    text: `New order from ${displayName} (${displayEmail}). Review popup stats: ${impressions.length} impression(s), ${clicks.length} click(s). Request a review: ${reviewRequestUrl}`,
    html,
  });
}
