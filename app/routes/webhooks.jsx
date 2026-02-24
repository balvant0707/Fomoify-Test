// app/routes/webhooks.jsx
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { sendOwnerEmail } from "../utils/sendOwnerEmail.server";

const norm = (s) => (s || "").toLowerCase();

export const action = async ({ request }) => {
  const { topic, shop } = await authenticate.webhook(request); // ✅ v3 way
  const s = norm(shop);

  console.log("[WEBHOOK RECEIVED]", topic, s);

  if (topic === "APP_UNINSTALLED" && s) {
    // 1️⃣ Update DB status
    await prisma.shop.upsert({
      where: { shop: s },
      update: {
        installed: false,
        accessToken: null,
        uninstalledAt: new Date(),
      },
      create: {
        shop: s,
        installed: false,
        accessToken: null,
        uninstalledAt: new Date(),
      },
    });

    console.log(`[APP_UNINSTALLED] ${s} → installed=false`);

    // 2️⃣ Send uninstall notification email to you (owner)
    try {
      const textBody = `
Store ${s} has just uninstalled the Fomoify Sales Popup & Proof app.

You may want to follow up with the merchant to understand the reason
or offer help with setup/optimization.

— Fomoify App
      `.trim();

      const htmlBody = `
<html>
  <body style="font-family:Arial, sans-serif; line-height:1.6; color:#333;">
    <h2 style="color:#FF5C5C;">⚠️ App Uninstalled</h2>
    <p>
      The store <strong>${s}</strong> has just uninstalled 
      <strong>Fomoify Sales Popup & Proof</strong>.
    </p>
    <p>
      You may want to reach out to the merchant to understand why they uninstalled
      or to offer help with setup, optimization, or troubleshooting.
    </p>
    <p style="margin-top:20px;">
      — Fomoify App
    </p>
  </body>
</html>
      `.trim();

      await sendOwnerEmail({
        to: process.env.APP_OWNER_FALLBACK_EMAIL,
        subject: `⚠️ ${s} uninstalled Fomoify Sales Popup & Proof`,
        text: textBody,
        html: htmlBody,
      });

      console.log("[APP_UNINSTALLED] uninstall email sent");
    } catch (err) {
      console.error("[APP_UNINSTALLED] failed to send uninstall email:", err);
    }
  }

  if (topic === "ORDERS_CREATE" && s) {
    try {
      const table = prisma.popupAnalyticsEvent || prisma.popupanalyticsevent;
      if (table) {
        await table.create({
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
      }
    } catch (err) {
      console.error("[ORDERS_CREATE] analytics insert failed:", err);
    }
  }

  return new Response(null, { status: 200 });
};

export const loader = () =>
  new Response("Method Not Allowed", { status: 405 });
