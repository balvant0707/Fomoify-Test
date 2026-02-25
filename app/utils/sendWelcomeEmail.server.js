// app/utils/sendWelcomeEmail.server.js
//
// Sends a welcome email to a newly installed shop owner.
// If WELCOME_TEST_EMAIL is set in .env, all welcome emails are redirected
// to that address instead of the real shop email (for testing).

import nodemailer from "nodemailer";

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildFrom() {
  const name = process.env.SMTP_FROM_NAME;
  const email = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER;
  return name ? `"${name}" <${email}>` : email;
}

function buildHtml(shopName, shopDomain) {
  const greeting = shopName ? `Hi ${shopName},` : "Hi there,";
  return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Fomoify!</title>
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
            <td style="background:linear-gradient(135deg,#5c6ac4 0%,#8c62e3 100%);padding:40px 40px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;color:rgba(255,255,255,0.75);letter-spacing:1.5px;text-transform:uppercase;">
                Fomoify Sales Popup &amp; Social Proof
              </p>
              <h1 style="margin:0;font-size:30px;font-weight:700;color:#ffffff;line-height:1.3;">
                Welcome aboard! 🎉
              </h1>
              <p style="margin:12px 0 0;font-size:15px;color:rgba(255,255,255,0.85);line-height:1.5;">
                Your store is now set up to convert more visitors into buyers
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.7;">${greeting}</p>
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">
                Thank you for installing <strong style="color:#5c6ac4;">Fomoify</strong> on your Shopify store.
                You now have access to powerful social proof and FOMO tools that help turn visitors into paying customers.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:24px 40px 0 40px;"><div style="border-top:1px solid #f0f0f0;"></div></td></tr>

          <!-- Feature 1 -->
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#f0f4ff;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#1a1a2e;">🛍️ Recent Purchase Popups</h3>
                    <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">
                      Show live notifications when customers buy from your store — builds instant trust and urgency.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Feature 2 -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#fff8f0;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#1a1a2e;">⚡ Flash Sale Bars</h3>
                    <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">
                      Add countdown timers to create limited-time urgency and drive more purchases.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Feature 3 -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#f0fff4;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#1a1a2e;">👁️ Visitor Activity Alerts</h3>
                    <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">
                      Show how many people are viewing a product right now — make your store feel busy and in-demand.
                    </p>
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
                Set Up Your First Popup &rarr;
              </a>
              <p style="margin:14px 0 0;font-size:13px;color:#9ca3af;">
                Open Fomoify in your Shopify admin to get started
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
}

/**
 * Sends a welcome email for a newly installed shop.
 *
 * @param {object} params
 * @param {string|null} params.shopEmail  - Store contact email from Shopify (shop.email)
 * @param {string|null} params.shopName   - Store name from Shopify (shop.name)
 * @param {string}      params.shopDomain - e.g. "example.myshopify.com"
 */
export async function sendWelcomeEmail({ shopEmail, shopName, shopDomain }) {
  const toEmail = process.env.WELCOME_TEST_EMAIL ?? shopEmail;

  if (!toEmail) {
    console.warn(`[welcome email] No email for ${shopDomain} — skipping.`);
    return;
  }

  const isTest = Boolean(process.env.WELCOME_TEST_EMAIL);
  if (isTest) {
    console.log(`[welcome email] TEST MODE — redirecting to ${toEmail} (real: ${shopEmail ?? "unknown"})`);
  }

  const transporter = createTransporter();

  await new Promise((resolve, reject) =>
    transporter.sendMail(
      {
        from: buildFrom(),
        to: toEmail,
        subject: "🎉 Welcome to Fomoify — You're All Set!",
        html: buildHtml(shopName, shopDomain),
      },
      (err, info) => (err ? reject(err) : resolve(info))
    )
  );

  console.log(`[welcome email] Sent to ${toEmail} for shop ${shopDomain}`);
}
