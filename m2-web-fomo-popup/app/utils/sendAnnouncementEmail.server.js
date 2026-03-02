// app/utils/sendAnnouncementEmail.server.js
//
// Sends the "new popups" announcement email to a single shop owner.
// Called from the index page loader on first visit after a new announcement.
//
// To announce a NEW batch of features in future:
//   1. Update EMAIL_SUBJECT and EMAIL_HTML_BODY below
//   2. Bump ANNOUNCEMENT_CUTOFF to today's date
//   3. Deploy — each merchant gets the email on their next app visit

import nodemailer from "nodemailer";
import prisma from "../db.server";

// ── Update this date whenever you deploy new features ────────────────────────
// Merchants whose announcementEmailSentAt is before this date (or null)
// will receive the email on their next visit.
export const ANNOUNCEMENT_CUTOFF = new Date("2026-02-25T00:00:00.000Z");

// ── Email content — edit when announcing new features ────────────────────────
const EMAIL_SUBJECT = "🆕 4 Powerful New Popups Just Launched in Fomoify!";

const EMAIL_HTML_BODY = /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>4 New Popups Launched in Fomoify</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#5c6ac4 0%,#8c62e3 100%);padding:36px 40px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;color:rgba(255,255,255,0.75);letter-spacing:1.5px;text-transform:uppercase;">
                Fomoify Sales Popup &amp; Social Proof
              </p>
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;line-height:1.3;">
                4 New Popups Just Launched!
              </h1>
              <p style="margin:12px 0 0;font-size:15px;color:rgba(255,255,255,0.85);line-height:1.5;">
                More ways to convert your visitors into paying customers
              </p>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.7;">Hi there,</p>
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">
                We've been busy building for you! Fomoify now includes
                <strong style="color:#5c6ac4;">4 brand-new popup types</strong> — each designed to
                boost trust, create urgency, and turn more store visitors into buyers.
              </p>
            </td>
          </tr>

          <tr><td style="padding:24px 40px 0 40px;"><div style="border-top:1px solid #f0f0f0;"></div></td></tr>

          <!-- Popup 1 -->
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4ff;border-radius:8px;">
                <tr><td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#5c6ac4;text-transform:uppercase;letter-spacing:1.2px;">New Popup #1</p>
                  <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">🛒 Add to Cart Popup</h3>
                  <p style="margin:0 0 12px;font-size:14px;color:#4b5563;line-height:1.6;">Show real-time notifications whenever a shopper adds a product to their cart. This creates powerful social proof and encourages other visitors to act fast.</p>
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Live add-to-cart activity feed</td></tr>
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Customisable message &amp; position</td></tr>
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Drives urgency without discounts</td></tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- Popup 2 -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff8f0;border-radius:8px;">
                <tr><td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:1.2px;">New Popup #2</p>
                  <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">⚠️ Low Stock Popup</h3>
                  <p style="margin:0 0 12px;font-size:14px;color:#4b5563;line-height:1.6;">Alert shoppers when a product's stock is running low. Nothing motivates a purchase faster than knowing an item is almost gone.</p>
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Auto-syncs with your real inventory</td></tr>
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Set your own low-stock threshold</td></tr>
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Reduces cart abandonment</td></tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- Popup 3 -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border-radius:8px;">
                <tr><td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1.2px;">New Popup #3</p>
                  <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">⭐ Review Popup</h3>
                  <p style="margin:0 0 12px;font-size:14px;color:#4b5563;line-height:1.6;">Display genuine customer reviews as live popups on your storefront. Build instant trust and let happy customers do the selling for you.</p>
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Show star ratings &amp; review text</td></tr>
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Supports multiple review sources</td></tr>
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Fully customisable design</td></tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- Popup 4 -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf4ff;border-radius:8px;">
                <tr><td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1.2px;">New Popup #4</p>
                  <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">👁️ Visitor Activity Popup</h3>
                  <p style="margin:0 0 12px;font-size:14px;color:#4b5563;line-height:1.6;">Show shoppers how many people are viewing a product right now. Real-time crowd signals make your store feel busy and in-demand.</p>
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Live visitor count per product</td></tr>
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Configurable display rules</td></tr>
                    <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Works on desktop &amp; mobile</td></tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:36px 40px;text-align:center;">
              <a href="https://apps.shopify.com/fomoify-sales-popup-proof"
                 style="display:inline-block;background:linear-gradient(135deg,#5c6ac4,#8c62e3);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:15px 40px;border-radius:6px;">
                Explore All New Popups &rarr;
              </a>
              <p style="margin:14px 0 0;font-size:13px;color:#9ca3af;">
                Open Fomoify in your Shopify admin to activate them instantly
              </p>
            </td>
          </tr>

          <tr><td style="padding:0 40px;"><div style="border-top:1px solid #f0f0f0;"></div></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;line-height:1.6;">
                You're receiving this because you installed <strong style="color:#6b7280;">Fomoify</strong> on your Shopify store.
              </p>
              <p style="margin:0;font-size:12px;color:#c4c9d4;">
                To stop receiving emails, uninstall Fomoify from your Shopify admin.
              </p>
            </td>
          </tr>

        </table>

        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:20px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                &copy; 2025 Pryxo Tech LTD PVT &bull; Fomoify Sales Popup &amp; Social Proof
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─────────────────────────────────────────────────────────────────────────────

function buildFrom() {
  const name = process.env.SMTP_FROM_NAME;
  const email = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER;
  return name ? `"${name}" <${email}>` : email;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/**
 * Checks if the shop needs the announcement email and sends it.
 * Marks announcementEmailSentAt in DB after sending to prevent duplicates.
 *
 * @param {string} shopDomain  - e.g. "example.myshopify.com"
 * @param {string|null} toEmail - store contact email from Shopify
 */
export async function maybeSendAnnouncementEmail(shopDomain, toEmail) {
  // Test override — if set in .env, redirect to that address
  const recipient = process.env.WELCOME_TEST_EMAIL ?? toEmail;

  if (!recipient) {
    console.warn(`[announcement email] No email for ${shopDomain} — skipping.`);
    return;
  }

  // Check if already sent for this announcement cycle
  const shopRow = await prisma.shop.findUnique({
    where: { shop: shopDomain },
    select: { announcementEmailSentAt: true },
  });

  const alreadySent =
    shopRow?.announcementEmailSentAt &&
    shopRow.announcementEmailSentAt >= ANNOUNCEMENT_CUTOFF;

  if (alreadySent) return;

  const transporter = createTransporter();

  await new Promise((resolve, reject) =>
    transporter.sendMail(
      { from: buildFrom(), to: recipient, subject: EMAIL_SUBJECT, html: EMAIL_HTML_BODY },
      (err, info) => (err ? reject(err) : resolve(info))
    )
  );

  // Mark as sent
  await prisma.shop.update({
    where: { shop: shopDomain },
    data: { announcementEmailSentAt: new Date() },
  });

  console.log(`[announcement email] Sent to ${recipient} for ${shopDomain}`);
}
