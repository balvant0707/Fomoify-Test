// app/routes/webhooks.jsx
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { sendOwnerEmail } from "../utils/sendOwnerEmail.server";

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
        await prisma.shop.upsert({
          where: { shop: s },
          update: {
            installed: false,
            status: "uninstalled",
            accessToken: null,
            uninstalledAt: new Date(),
          },
          create: {
            shop: s,
            installed: false,
            status: "uninstalled",
            accessToken: null,
            uninstalledAt: new Date(),
          },
        });
        console.log(`[APP_UNINSTALLED] ${s}`);

        try {
          await sendOwnerEmail({
            to: process.env.APP_OWNER_FALLBACK_EMAIL,
            subject: `Store ${s} uninstalled Fomoify Sales Popup & Proof`,
            text: `Store ${s} removed the Fomoify Sales Popup & Proof app.`,
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.4;color:#111">
                <h3>Shopify App Uninstalled</h3>
                <p><strong>${s}</strong> just removed the Fomoify Sales Popup & Proof app.</p>
                <p>Consider following up to understand why or to offer help.</p>
              </div>
            `,
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
