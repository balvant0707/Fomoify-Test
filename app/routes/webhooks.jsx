// app/routes/webhooks.jsx
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { sendOwnerEmail } from "../utils/sendOwnerEmail.server";
import { sendOrderReviewEmail } from "../utils/sendOrderReviewEmail.server";

const norm = (s) => (s || "").toLowerCase();

export const action = async ({ request }) => {
  // Do NOT wrap in try/catch — authenticate.webhook throws a Response on failure.
  // Catching it and returning 401 causes Shopify to retry, creating thousands of failures.
  const { topic, shop, payload } = await authenticate.webhook(request);

  const s = norm(shop);
  console.log("[WEBHOOK]", topic, s);

  try {
    switch (topic) {
      case "APP_UNINSTALLED": {
        const now = new Date();

        // Read existing shop record before zeroing it out
        const existingShop = await prisma.shop.findUnique({ where: { shop: s } });
        const ownerName = existingShop?.ownerName || null;
        const ownerEmail = existingShop?.email || null;
        const contactEmail = existingShop?.contactEmail || null;

        await prisma.shop.upsert({
          where: { shop: s },
          update: {
            installed: false,
            status: "uninstalled",
            accessToken: null,
            uninstalledAt: now,
          },
          create: {
            shop: s,
            installed: false,
            status: "uninstalled",
            accessToken: null,
            uninstalledAt: now,
          },
        });

        // Persist uninstall feedback record with a unique token for the feedback form
        let feedbackToken = null;
        try {
          feedbackToken = `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
          await prisma.uninstallfeedback.create({
            data: {
              shop: s,
              ownerName,
              email: ownerEmail,
              contactEmail,
              feedbackToken,
              uninstalledAt: now,
            },
          });
        } catch (err) {
          console.error("[APP_UNINSTALLED] feedback DB insert failed:", err);
          feedbackToken = null;
        }

        // Send feedback-request email to the merchant
        if ((ownerEmail || contactEmail) && feedbackToken) {
          try {
            const appHost = process.env.SHOPIFY_APP_URL || process.env.HOST || "";
            const feedbackUrl = appHost
              ? `${appHost.replace(/\/$/, "")}/feedback?token=${feedbackToken}`
              : null;

            const merchantTo = ownerEmail || contactEmail;
            const displayName = ownerName ? ownerName.split(" ")[0] : "there";

            await sendOwnerEmail({
              to: merchantTo,
              subject: "Can you share why you uninstalled Fomoify?",
              text: [
                `Hi ${displayName},`,
                "",
                "We noticed you recently uninstalled Fomoify Sales Popup & Proof.",
                "Your feedback helps us improve — it only takes a minute!",
                "",
                feedbackUrl ? `Leave feedback: ${feedbackUrl}` : "",
                "",
                "Thank you,\nThe Fomoify Team",
              ]
                .filter((l) => l !== null)
                .join("\n"),
              html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:26px 24px;border-radius:10px 10px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:19px;">We&rsquo;re sorry to see you go, ${displayName}!</h2>
      <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px;">Fomoify Sales Popup &amp; Proof</p>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;">
      <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 20px;">
        We noticed you recently uninstalled Fomoify from <strong>${s}</strong>.
        Your honest feedback helps us build a better product for every merchant.
      </p>
      <p style="font-size:15px;color:#374151;margin:0 0 24px;">
        Could you spare one minute to tell us why?
      </p>
      ${
        feedbackUrl
          ? `<div style="text-align:center;">
              <a href="${feedbackUrl}"
                 style="display:inline-block;background:#6366f1;color:#fff;padding:14px 36px;
                        border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;">
                Share My Feedback
              </a>
             </div>`
          : ""
      }
      <p style="font-size:13px;color:#9ca3af;margin-top:20px;text-align:center;">
        We read every response and use it to make Fomoify better.
      </p>
    </div>
    <div style="padding:14px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;
                border-radius:0 0 10px 10px;text-align:center;font-size:12px;color:#9ca3af;">
      Fomoify Sales Popup &amp; Proof
    </div>
  </div>
</body></html>`,
            });
          } catch (err) {
            console.error("[APP_UNINSTALLED] merchant feedback email failed:", err);
          }
        }

        console.log(`[APP_UNINSTALLED] ${s}`);

        // Send detailed notification email to app owner
        try {
          const rows = [
            ["Domain", s],
            ["Owner name", ownerName || "—"],
            ["Email", ownerEmail || "—"],
            ["Contact email", contactEmail || "—"],
            ["Uninstalled at", now.toUTCString()],
          ]
            .map(
              ([label, value]) => `
              <tr>
                <td style="padding:6px 16px 6px 0;color:#6b7280;white-space:nowrap;font-size:14px;">${label}</td>
                <td style="padding:6px 0;color:#111;font-size:14px;">${value}</td>
              </tr>`
            )
            .join("");

          await sendOwnerEmail({
            to: process.env.APP_OWNER_FALLBACK_EMAIL,
            subject: `Uninstalled: ${s} removed Fomoify Sales Popup & Proof`,
            text: [
              `Store ${s} removed the Fomoify Sales Popup & Proof app.`,
              `Owner: ${ownerName || "—"}`,
              `Email: ${ownerEmail || "—"}`,
              `Contact email: ${contactEmail || "—"}`,
              `Time: ${now.toUTCString()}`,
            ].join("\n"),
            html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:22px 24px;border-radius:10px 10px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:18px;">App Uninstalled</h2>
      <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px;">Fomoify Sales Popup &amp; Proof</p>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;">
      <p style="font-size:14px;color:#374151;margin:0 0 18px;">
        A merchant has removed the app. Here are the details:
      </p>
      <table style="border-collapse:collapse;width:100%;">
        ${rows}
      </table>
      <div style="margin-top:20px;padding:14px 16px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 6px 6px 0;font-size:13px;color:#7f1d1d;">
        Consider following up to understand why or to offer assistance.
      </div>
    </div>
    <div style="padding:14px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;text-align:center;font-size:12px;color:#9ca3af;">
      Fomoify Sales Popup &amp; Proof
    </div>
  </div>
</body></html>`,
          });
        } catch (err) {
          console.error("[APP_UNINSTALLED] email failed:", err);
        }
        break;
      }

      case "APP_SCOPES_UPDATE": {
        await prisma.shop.updateMany({
          where: { shop: s },
          data: { updatedAt: new Date() },
        });
        console.log(`[APP_SCOPES_UPDATE] ${s}`);
        break;
      }

      case "ORDERS_CREATE": {
        try {
          await prisma.popupanalyticsevent.create({
            data: {
              shop: s,
              popupType: "orders",
              eventType: "order",
              productHandle: null,
              visitorId: null,
              pagePath: null,
              sourceUrl: null,
            },
          });
        } catch (err) {
          console.error("[ORDERS_CREATE] analytics insert failed:", err);
        }

        // Send order notification + review request email to shop owner
        try {
          const shopRecord = await prisma.shop.findUnique({ where: { shop: s } });
          const ownerEmail =
            shopRecord?.email ||
            shopRecord?.contactEmail ||
            process.env.APP_OWNER_FALLBACK_EMAIL;

          if (ownerEmail) {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const [impressions, clicks] = await Promise.all([
              prisma.popupanalyticsevent.findMany({
                where: {
                  shop: s,
                  popupType: "review",
                  eventType: "view",
                  createdAt: { gte: thirtyDaysAgo },
                },
                orderBy: { createdAt: "desc" },
                take: 50,
                select: { productHandle: true, pagePath: true, createdAt: true },
              }),
              prisma.popupanalyticsevent.findMany({
                where: {
                  shop: s,
                  popupType: "review",
                  eventType: "click",
                  createdAt: { gte: thirtyDaysAgo },
                },
                orderBy: { createdAt: "desc" },
                take: 50,
                select: { productHandle: true, pagePath: true, createdAt: true },
              }),
            ]);

            const customer = payload?.customer || {};
            const customerName =
              [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
              "Customer";
            const customerEmail = String(customer.email || "").trim();
            const orderId = String(payload?.order_number || payload?.id || "");
            const products = (Array.isArray(payload?.line_items) ? payload.line_items : []).map(
              (line) => ({
                name: line.name || line.title || "Product",
                quantity: line.quantity || 1,
                price: line.price || "0.00",
              })
            );

            await sendOrderReviewEmail({
              shop: s,
              shopName: shopRecord?.name,
              ownerEmail,
              order: { customerName, customerEmail, products, orderId },
              reviewStats: { impressions, clicks },
            });

            console.log(`[ORDERS_CREATE] review email sent to ${ownerEmail} for order #${orderId}`);
          }
        } catch (err) {
          console.error("[ORDERS_CREATE] review email failed:", err);
        }
        break;
      }

      // GDPR mandatory webhooks — must return 200
      case "CUSTOMERS_DATA_REQUEST": {
        console.log("GDPR CUSTOMERS_DATA_REQUEST:", s, payload?.customer?.id);
        break;
      }

      case "CUSTOMERS_REDACT": {
        console.log("GDPR CUSTOMERS_REDACT:", s, payload?.customer?.id);
        break;
      }

      case "SHOP_REDACT": {
        try {
          await prisma.shop.deleteMany({ where: { shop: s } });
        } catch (err) {
          console.error("[SHOP_REDACT] db delete failed:", err);
        }
        console.log("GDPR SHOP_REDACT:", s);
        break;
      }

      default: {
        console.log("[webhook] unhandled topic:", topic, s);
      }
    }
  } catch (err) {
    console.error("[webhook] handler error:", topic, err);
    // Still return 200 — Shopify must not retry on handler-level errors
    return new Response(null, { status: 200 });
  }

  return new Response(null, { status: 200 });
};

export const loader = () => new Response("Method Not Allowed", { status: 405 });
