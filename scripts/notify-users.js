#!/usr/bin/env node
// scripts/notify-users.js
//
// Sends a feature announcement email to all installed shop owners.
//
// Usage:
//   node scripts/notify-users.js
//
// Required .env vars:
//   SMTP_HOST   - e.g. smtp.gmail.com
//   SMTP_PORT   - e.g. 587 (TLS) or 465 (SSL)
//   SMTP_USER   - your email address / SMTP username
//   SMTP_PASS   - your email password or app password
//   EMAIL_FROM  - (optional) display address, defaults to SMTP_USER
//
// ── Edit the email content below before running ───────────────────────────────

// Author email for testing. Set to null to send to all installed users.
const AUTHOR_TEST_EMAIL = "balvant@pryxotech.com";

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

        <!-- Card -->
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

          <!-- Divider -->
          <tr><td style="padding:24px 40px 0 40px;"><div style="border-top:1px solid #f0f0f0;"></div></td></tr>

          <!-- ── Popup 1: Add to Cart ── -->
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#f0f4ff;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#5c6ac4;
                               text-transform:uppercase;letter-spacing:1.2px;">New Popup #1</p>
                    <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">
                      🛒 Add to Cart Popup
                    </h3>
                    <p style="margin:0 0 12px;font-size:14px;color:#4b5563;line-height:1.6;">
                      Show real-time notifications whenever a shopper adds a product to their cart.
                      This creates powerful social proof and encourages other visitors to act fast.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Live add-to-cart activity feed</td></tr>
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Customisable message &amp; position</td></tr>
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Drives urgency without discounts</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Popup 2: Low Stock ── -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#fff8f0;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#d97706;
                               text-transform:uppercase;letter-spacing:1.2px;">New Popup #2</p>
                    <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">
                      ⚠️ Low Stock Popup
                    </h3>
                    <p style="margin:0 0 12px;font-size:14px;color:#4b5563;line-height:1.6;">
                      Alert shoppers when a product's stock is running low. Nothing motivates a
                      purchase faster than knowing an item is almost gone.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Auto-syncs with your real inventory</td></tr>
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Set your own low-stock threshold</td></tr>
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Reduces cart abandonment</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Popup 3: Review ── -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#f0fff4;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#059669;
                               text-transform:uppercase;letter-spacing:1.2px;">New Popup #3</p>
                    <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">
                      ⭐ Review Popup
                    </h3>
                    <p style="margin:0 0 12px;font-size:14px;color:#4b5563;line-height:1.6;">
                      Display genuine customer reviews as live popups on your storefront.
                      Build instant trust and let happy customers do the selling for you.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Show star ratings &amp; review text</td></tr>
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Supports multiple review sources</td></tr>
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Fully customisable design</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Popup 4: Visitor Activity ── -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#fdf4ff;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#7c3aed;
                               text-transform:uppercase;letter-spacing:1.2px;">New Popup #4</p>
                    <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">
                      👁️ Visitor Activity Popup
                    </h3>
                    <p style="margin:0 0 12px;font-size:14px;color:#4b5563;line-height:1.6;">
                      Show shoppers how many people are viewing a product right now.
                      Real-time crowd signals make your store feel busy and in-demand.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Live visitor count per product</td></tr>
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Configurable display rules</td></tr>
                      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">✅ &nbsp;Works on desktop &amp; mobile</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:36px 40px;text-align:center;">
              <a href="https://apps.shopify.com/fomoify-sales-popup-proof"
                 style="display:inline-block;background:linear-gradient(135deg,#5c6ac4,#8c62e3);
                        color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;
                        padding:15px 40px;border-radius:6px;letter-spacing:0.3px;">
                Explore All New Popups &rarr;
              </a>
              <p style="margin:14px 0 0;font-size:13px;color:#9ca3af;">
                Open Fomoify in your Shopify admin to activate them instantly
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><div style="border-top:1px solid #f0f0f0;"></div></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;line-height:1.6;">
                You're receiving this because you installed
                <strong style="color:#6b7280;">Fomoify</strong> on your Shopify store.
              </p>
              <p style="margin:0;font-size:12px;color:#c4c9d4;">
                To stop receiving emails, uninstall Fomoify from your Shopify admin.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

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
// Delay between individual sends (ms) — keep ≥ 200ms to respect SMTP limits.
const SEND_DELAY_MS = 300;

// ── Script logic (no edits needed below) ─────────────────────────────────────

import "dotenv/config";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";

const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL, SMTP_FROM_NAME } = process.env;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const EMAIL_FROM = SMTP_FROM_NAME
  ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL ?? SMTP_USER}>`
  : (SMTP_FROM_EMAIL ?? SMTP_USER);

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error(
    "Missing SMTP config. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to your .env file."
  );
  process.exit(1);
}

const prisma = new PrismaClient();

/** Returns installed shop owners that have a recorded email address. */
async function getRecipients() {
  // Offline sessions (id = "offline_<shop>") hold the permanent app credential
  // and include the account owner's email when the merchant installed via OAuth.
  const sessions = await prisma.session.findMany({
    where: {
      id: { startsWith: "offline_" },
      accountOwner: true,
      email: { not: null },
    },
    select: { shop: true, email: true, firstName: true, lastName: true },
  });

  // Only email shops that are still installed.
  const installedShops = await prisma.shop.findMany({
    where: { installed: true },
    select: { shop: true },
  });
  const installedSet = new Set(installedShops.map((s) => s.shop));

  return sessions
    .filter((s) => installedSet.has(s.shop))
    .map((s) => ({
      shop: s.shop,
      email: s.email,
      name: [s.firstName, s.lastName].filter(Boolean).join(" ") || null,
    }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.verify();
  console.log("SMTP connection verified.\n");

  const recipients = AUTHOR_TEST_EMAIL
    ? [{ shop: "test", email: AUTHOR_TEST_EMAIL, name: null }]
    : await getRecipients();

  if (recipients.length === 0) {
    console.log("No recipients found. Make sure shops are marked installed=true in the DB.");
    await prisma.$disconnect();
    return;
  }

  if (AUTHOR_TEST_EMAIL) {
    console.log(`TEST MODE — sending only to ${AUTHOR_TEST_EMAIL}\n`);
  } else {
    console.log(`Sending to ${recipients.length} shop owner(s)...\n`);
  }

  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    try {
      await new Promise((resolve, reject) =>
        transporter.sendMail(
          { from: EMAIL_FROM, to: r.email, subject: EMAIL_SUBJECT, html: EMAIL_HTML_BODY },
          (err, info) => (err ? reject(err) : resolve(info))
        )
      );
      console.log(`  ✓  ${r.email}  (${r.shop})`);
      sent++;
    } catch (err) {
      console.error(`  ✗  ${r.email}  (${r.shop}) — ${err.message}`);
      failed++;
    }
    await sleep(SEND_DELAY_MS);
  }

  console.log(`\nFinished. Sent: ${sent}  Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
