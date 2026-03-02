// app/routes/auth.$.jsx
import { redirect } from "@remix-run/node";
import { authenticate, registerWebhooks } from "../shopify.server";
import prisma from "../db.server";
import { ensureShopRow } from "../utils/ensureShop.server";
import { sendOwnerEmail } from "../utils/sendOwnerEmail.server";
import { upsertInstalledShop } from "../utils/upsertShop.server";

const norm = (s) => (s || "").toLowerCase().replace(/^https?:\/\//, "");

export const loader = async ({ request }) => {
  // authenticate the admin (install / re-auth)
  const result = await authenticate.admin(request);
  if (result instanceof Response) return result;

  const { admin, session } = result;
  const shop = norm(session.shop);

  // Check if this shop already exists (to detect first-time install if needed)
  const existing = await prisma.shop.findUnique({
    where: { shop },
    select: { id: true, installed: true },
  });

  // Primary upsert (install/update)
  await upsertInstalledShop({
    shop,
    accessToken: session.accessToken ?? null,
  });

  // Safety net: even if above silently skips, ensure row exists from session table
  await ensureShopRow(shop);

  // Register all webhooks
  await registerWebhooks({ session });

  // 🔔 Send email on every successful auth (install / re-auth)
  // If you only want FIRST install, wrap this block in:
  // if (!existing || !existing.installed) { ... }
  try {
    let ownerEmail = null;
    let shopName = shop;
    let myshopifyDomain = shop;

    try {
      const resp = await admin.graphql(
        `#graphql
        query AppInstallOwnerInfo {
          shop {
            email
            contactEmail
            myshopifyDomain
            name
            currencyCode
            plan { displayName }
            primaryDomain { host }
            billingAddress {
              country
              city
              phone
            }
            accountOwner {
              name
            }
          }
        }`
      );
      const js = await resp.json();
      const shopData = js?.data?.shop || {};

      ownerEmail = shopData.contactEmail || shopData.email || null;
      shopName = shopData.name || shop;
      myshopifyDomain = shopData.myshopifyDomain || shop;

      // Persist extended owner data
      await upsertInstalledShop({
        shop,
        accessToken: session.accessToken ?? null,
        ownerData: {
          ownerName: shopData.accountOwner?.name || null,
          email: shopData.email || null,
          contactEmail: shopData.contactEmail || null,
          name: shopData.name || null,
          country: shopData.billingAddress?.country || null,
          city: shopData.billingAddress?.city || null,
          currency: shopData.currencyCode || null,
          phone: shopData.billingAddress?.phone || null,
          primaryDomain: shopData.primaryDomain?.host || null,
          plan: shopData.plan?.displayName || null,
        },
      });
    } catch (e) {
      console.error("[FOMO][INSTALL EMAIL] failed to fetch shop info:", e);
    }

    const installedAt = new Date().toISOString();

    const textBody = `
Hi there,

Great news! Your store has successfully installed “Fomoify Sales Popup & Proof”.

You're all set to display real-time sales notifications, build trust, and increase conversions automatically.

🛍️ Store: ${shopName}
🔗 Domain: ${myshopifyDomain}
📅 Installed On: ${installedAt}

If you need help customizing the popup design or want advanced setups, feel free to contact our support anytime.

Thank you for choosing Fomoify Sales Popup & Proof!

Best regards,
Fomoify Support Team
support@fomoify.app
    `.trim();

    const htmlBody = `
<html>
  <body style="font-family:Arial, sans-serif; line-height:1.6; color:#333;">
    <h2 style="color:#6C63FF;">🎉 Fomoify Sales Popup & Proof Installed!</h2>

    <p>
      Hi there,<br><br>
      Great news! Your store has successfully installed 
      <strong>Fomoify Sales Popup & Proof</strong>.<br>
      You're ready to show real-time sales & activity popups that build trust 
      and boost conversions.
    </p>

    <table style="margin-top:10px;">
      <tr><td>🛍️ <strong>Store:</strong></td><td>${shopName}</td></tr>
      <tr><td>🔗 <strong>Domain:</strong></td><td>${myshopifyDomain}</td></tr>
      <tr><td>📅 <strong>Installed:</strong></td><td>${installedAt}</td></tr>
    </table>

    <p style="margin-top:20px;">
      If you need help with setup or customization, our team is here to support you anytime.
    </p>

    <p>
      Thanks for choosing <strong>Fomoify Sales Popup & Proof</strong>!
    </p>

    <p style="color:#6C63FF; font-weight:bold;">
      — Fomoify Support Team<br>
      support@fomoify.app
    </p>
  </body>
</html>
    `.trim();

    await sendOwnerEmail({
      to: ownerEmail || process.env.APP_OWNER_FALLBACK_EMAIL,
      subject:
        "🎉 Fomoify Sales Popup & Proof Installed Successfully on Your Store!",
      text: textBody,
      html: htmlBody,
    });
  } catch (e) {
    // Do not block install flow because of email failure
    console.error("[FOMO][INSTALL EMAIL] outer error:", e);
  }

  const requestUrl = new URL(request.url);
  const qp = new URLSearchParams();
  if (session?.shop) qp.set("shop", session.shop);
  const host = requestUrl.searchParams.get("host");
  if (host) qp.set("host", host);

  return redirect(qp.toString() ? `/app?${qp.toString()}` : "/app");
};
