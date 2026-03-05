// app/routes/webhooks.jsx
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { sendOwnerEmail } from "../utils/sendOwnerEmail.server";

const norm = (s) => (s || "").toLowerCase();

// Topics we can handle without an active session (no Admin API call needed)
const SESSION_LESS_TOPICS = new Set([
  "ORDERS_CREATE",
  "SHOP_REDACT",
  "CUSTOMERS_DATA_REQUEST",
  "CUSTOMERS_REDACT",
]);

export const action = async ({ request }) => {
  // Clone before authenticate.webhook() consumes the body, so we can read
  // headers if the library throws a 410 (HMAC valid, shop session missing).
  const rawRequest = request.clone();

  let topic, shop, payload;
  try {
    ({ topic, shop, payload } = await authenticate.webhook(request));
  } catch (err) {
    if (err instanceof Response) {
      // 410 = HMAC verified but shop has no session (uninstalled / never re-authed).
      // For topics that don't require admin access, handle them anyway and
      // return 200 so Shopify stops marking deliveries as failed.
      if (err.status === 410) {
        const shopHeader = rawRequest.headers.get("X-Shopify-Shop-Domain");
        const topicHeader = rawRequest.headers.get("X-Shopify-Topic");
        if (shopHeader && topicHeader) {
          const t = topicHeader.toUpperCase().replace(/\//g, "_");
          const s = norm(shopHeader);
          if (SESSION_LESS_TOPICS.has(t)) {
            console.log(`[webhook] 410-fallback topic=${t} shop=${s}`);
            if (t === "SHOP_REDACT") {
              try {
                await prisma.shop.deleteMany({ where: { shop: s } });
                console.log("GDPR SHOP_REDACT (no-session):", s);
              } catch (e) {
                console.error("[SHOP_REDACT] failed:", e);
              }
            }
            // ORDERS_CREATE, CUSTOMERS_DATA_REQUEST, CUSTOMERS_REDACT: ack only
            return new Response(null, { status: 200 });
          }
        }
      }
      return err;
    }
    console.error("[webhook] verify/parse failed:", err);
    return new Response("Unauthorized", { status: 401 });
  }
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

      // GDPR required webhooks
      case "CUSTOMERS_DATA_REQUEST": {
        console.log("GDPR CUSTOMERS_DATA_REQUEST:", s, payload?.customer?.id);
        break;
      }

      case "CUSTOMERS_REDACT": {
        console.log("GDPR CUSTOMERS_REDACT:", s, payload?.customer?.id);
        break;
      }

      case "SHOP_REDACT": {
        await prisma.shop.deleteMany({ where: { shop: s } });
        console.log("GDPR SHOP_REDACT:", s);
        break;
      }

      default: {
        console.log("[webhook] unhandled topic:", topic, s);
      }
    }
  } catch (err) {
    console.error("[webhook] handler error:", topic, err);
  }

  return new Response(null, { status: 200 });
};

export const loader = () =>
  new Response(JSON.stringify({ ok: true, webhook: "ready" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
