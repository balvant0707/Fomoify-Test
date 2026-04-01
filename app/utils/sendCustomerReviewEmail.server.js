// app/utils/sendCustomerReviewEmail.server.js
import { sendOwnerEmail } from "./sendOwnerEmail.server";

const fmt = (v) => String(v || "").trim();

/**
 * Sends a review request email to a customer on behalf of a shop.
 *
 * @param {object} opts
 * @param {string} opts.shop          - myshopify.com domain
 * @param {string} opts.shopName      - Human-readable store name
 * @param {string} opts.customerEmail - Recipient email address
 * @param {string} opts.customerName  - Customer display name
 * @param {string} opts.orderId       - Order number / ID shown in the email
 * @param {string} [opts.reviewUrl]   - Where the customer should leave their review
 */
export async function sendCustomerReviewEmail({
  shop,
  shopName,
  customerEmail,
  customerName,
  orderId,
  reviewUrl,
}) {
  const displayShop = fmt(shopName) || shop;
  const displayName = fmt(customerName) || "Valued Customer";
  const displayOrder = fmt(orderId) ? `#${orderId}` : "";

  const SHOPIFY_REVIEW_URL =
    "https://apps.shopify.com/fomoify-sales-popup-proof#modal-show=WriteReviewModal";

  // Use the Shopify App Store review page by default
  const destination = fmt(reviewUrl) || SHOPIFY_REVIEW_URL;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 24px;border-radius:10px 10px 0 0;text-align:center;">
      <h2 style="margin:0 0 6px;color:#fff;font-size:20px;">How was your experience?</h2>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">${displayShop}</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;text-align:center;">
      <p style="font-size:16px;color:#374151;margin:0 0 8px;">
        Hi <strong>${displayName}</strong>,
      </p>
      <p style="font-size:15px;color:#6b7280;margin:0 0 28px;line-height:1.6;">
        Thank you for your recent purchase${displayOrder ? ` (order ${displayOrder})` : ""}!
        We&rsquo;d love to hear what you think. Your feedback helps us improve and
        helps other shoppers make confident decisions.
      </p>

      <a href="${destination}"
         style="display:inline-block;background:#6366f1;color:#fff;padding:14px 36px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
        Leave a Review
      </a>

      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
        It only takes a minute &mdash; we really appreciate it!
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:14px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;text-align:center;font-size:12px;color:#9ca3af;">
      ${displayShop} &mdash; Powered by Fomoify
    </div>

  </div>
</body>
</html>`;

  await sendOwnerEmail({
    to: customerEmail,
    subject: `How was your experience with ${displayShop}? Leave a review!`,
    text: `Hi ${displayName}, thank you for your purchase${displayOrder ? ` (order ${displayOrder})` : ""}! Please leave a review: ${destination}`,
    html,
  });
}
