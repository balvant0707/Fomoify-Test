# Webhook Fix + Store Owner Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix webhook 404 failures by consolidating routes and aligning TOML config, and add store owner data collection to the `shop` table for newsletter/marketing use.

**Architecture:** Extend the existing `shop` Prisma model with owner fields (email, name, country, etc.) and a `status` column. Consolidate two conflicting webhook route files into one. Expand the GraphQL query in `auth.$.jsx` to fetch extended owner data and persist it via `upsertInstalledShop`.

**Tech Stack:** Remix 2.17, Prisma 6 (MySQL), Shopify Admin GraphQL API 2026-01

---

### Task 1: Update Prisma schema — add owner fields to `shop` model

**Files:**
- Modify: `prisma/schema.prisma:31-41`

**Step 1: Add new columns to the `shop` model**

Replace the current `shop` model block (lines 31-41) with:

```prisma
model shop {
  id                      Int       @id @default(autoincrement())
  shop                    String    @unique(map: "Shop_shop_key")
  accessToken             String?
  installed               Boolean   @default(false)
  status                  String?   @default("installed") @db.VarChar(32)
  ownerName               String?   @db.VarChar(255)
  email                   String?   @db.VarChar(320)
  contactEmail            String?   @db.VarChar(320)
  name                    String?   @db.VarChar(255)
  country                 String?   @db.VarChar(100)
  city                    String?   @db.VarChar(100)
  currency                String?   @db.VarChar(10)
  phone                   String?   @db.VarChar(50)
  primaryDomain           String?   @db.VarChar(255)
  plan                    String?   @db.VarChar(100)
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  onboardedAt             DateTime?
  uninstalledAt           DateTime?
  announcementEmailSentAt DateTime?
}
```

**Step 2: Push schema changes to the database**

Run: `npx prisma db push`
Expected: Schema synced, new columns added. No data loss (all new fields are nullable).

**Step 3: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully.

---

### Task 2: Update `shopify.app.toml` — fix webhook URIs

**Files:**
- Modify: `shopify.app.toml:12-31`

**Step 1: Replace the entire `[webhooks]` section**

Replace lines 12-31 with:

```toml
[webhooks]
api_version = "2026-01"

  [[webhooks.subscriptions]]
  topics = ["app/uninstalled"]
  uri = "/webhooks"

  [[webhooks.subscriptions]]
  topics = ["app/scopes_update"]
  uri = "/webhooks"

  [[webhooks.subscriptions]]
  topics = ["orders/create"]
  uri = "/webhooks"

  [[webhooks.subscriptions]]
  compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
  uri = "/webhooks"
```

All URIs now point to `/webhooks` — matching both the programmatic config in `shopify.server.js` and the Remix route file `webhooks.jsx`.

---

### Task 3: Rewrite `webhooks.jsx` — consolidated handler with all topics

**Files:**
- Modify: `app/routes/webhooks.jsx` (full rewrite)

**Step 1: Replace the entire file with the consolidated handler**

```jsx
// app/routes/webhooks.jsx
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { sendOwnerEmail } from "../utils/sendOwnerEmail.server";

const norm = (s) => (s || "").toLowerCase();

export const action = async ({ request }) => {
  let parsed;
  try {
    parsed = await authenticate.webhook(request);
  } catch (err) {
    console.error("[webhook] verify/parse failed:", err);
    return new Response("Unauthorized", { status: 401 });
  }

  const { topic, shop, payload } = parsed;
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

export const loader = () => new Response("Method Not Allowed", { status: 405 });
```

---

### Task 4: Delete `webhooks.$.jsx` — remove conflicting splat route

**Files:**
- Delete: `app/routes/webhooks.$.jsx`

Run: `rm app/routes/webhooks.$.jsx`

This eliminates the Remix routing conflict that caused 404s.

---

### Task 5: Update `upsertShop.server.js` — accept and persist owner fields

**Files:**
- Modify: `app/utils/upsertShop.server.js`

**Step 1: Replace the entire file**

```js
import prisma from "../db.server";

const normalizeShop = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

export async function upsertInstalledShop({ shop: rawShop, accessToken, ownerData }) {
  const shop = normalizeShop(rawShop);
  if (!shop) return null;

  const owner = ownerData || {};
  const updateData = {
    accessToken: accessToken ?? null,
    installed: true,
    status: "installed",
    uninstalledAt: null,
    ...(owner.ownerName !== undefined && { ownerName: owner.ownerName }),
    ...(owner.email !== undefined && { email: owner.email }),
    ...(owner.contactEmail !== undefined && { contactEmail: owner.contactEmail }),
    ...(owner.name !== undefined && { name: owner.name }),
    ...(owner.country !== undefined && { country: owner.country }),
    ...(owner.city !== undefined && { city: owner.city }),
    ...(owner.currency !== undefined && { currency: owner.currency }),
    ...(owner.phone !== undefined && { phone: owner.phone }),
    ...(owner.primaryDomain !== undefined && { primaryDomain: owner.primaryDomain }),
    ...(owner.plan !== undefined && { plan: owner.plan }),
  };

  try {
    return await prisma.shop.upsert({
      where: { shop },
      update: updateData,
      create: {
        shop,
        ...updateData,
      },
    });
  } catch (error) {
    console.error("[shop upsert] failed:", error);
    return null;
  }
}
```

Note: The SQL fallback is removed. The Prisma upsert is sufficient and the fallback was a workaround for table name casing issues that are no longer relevant.

---

### Task 6: Update `auth.$.jsx` — expand GraphQL query and persist owner data

**Files:**
- Modify: `app/routes/auth.$.jsx:45-67`

**Step 1: Replace the GraphQL query and data extraction block (lines 45-67)**

Replace:
```js
    try {
      const resp = await admin.graphql(
        `#graphql
        query AppInstallOwnerEmail {
          shop {
            email
            contactEmail
            myshopifyDomain
            name
          }
        }`
      );
      const js = await resp.json();
      ownerEmail =
        js?.data?.shop?.contactEmail ||
        js?.data?.shop?.email ||
        null;

      shopName = js?.data?.shop?.name || shop;
      myshopifyDomain = js?.data?.shop?.myshopifyDomain || shop;
    } catch (e) {
      console.error("[FOMO][INSTALL EMAIL] failed to fetch shop info:", e);
    }
```

With:
```js
    try {
      const resp = await admin.graphql(
        `#graphql
        query AppInstallOwnerInfo {
          shop {
            email
            contactEmail
            myshopifyDomain
            name
            shopOwnerName
            currencyCode
            plan { displayName }
            primaryDomain { host }
            billingAddress {
              country
              city
              phone
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
          ownerName: shopData.shopOwnerName || null,
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
```

---

### Task 7: Clean up `shopify.server.js` afterAuth — remove duplicate welcome email

**Files:**
- Modify: `app/shopify.server.js:129-173`

**Step 1: Simplify the afterAuth hook**

Replace lines 129-173 with:

```js
  hooks: {
    afterAuth: async ({ session }) => {
      await upsertInstalledShop({
        shop: session.shop,
        accessToken: session.accessToken ?? null,
      });

      const reg = await shopify.registerWebhooks({ session });
      console.log("registerWebhooks:", JSON.stringify(reg, null, 2));
    },
  },
```

The welcome email logic is already handled in `auth.$.jsx`. The `onboardedAt` check and welcome email send in this hook were duplicate. The `sendWelcomeEmail` import at the top of this file can also be removed (it was never imported — check if it exists; if so, remove it).

---

### Task 8: Build and verify

Run: `npm run build`
Expected: Prisma client generated + Remix build succeeds with no errors.

---

### Task 9: Commit all changes

```bash
git add prisma/schema.prisma shopify.app.toml app/routes/webhooks.jsx app/utils/upsertShop.server.js app/routes/auth.$.jsx app/shopify.server.js
git rm app/routes/webhooks.$.jsx
git commit -m "fix: consolidate webhook routes to resolve 404 failures and add store owner tracking

- Merge webhooks.jsx and webhooks.$.jsx into single /webhooks handler
- Align shopify.app.toml URIs to /webhooks (was /webhooks/app/uninstalled etc.)
- Add owner fields to shop table (email, name, country, city, currency, phone, plan, etc.)
- Add status column (installed/uninstalled) for marketing segmentation
- Expand GraphQL query in auth to fetch and persist extended shop owner data
- Remove duplicate welcome email logic from shopify.server.js afterAuth

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Deploy and verify webhooks

After deploying to Vercel:
1. Run `npx shopify app deploy` to sync the updated TOML webhook config with Shopify
2. Check the Shopify Dev Dashboard > Logs to confirm webhook deliveries switch from 404 to OK
3. Install on a dev store and verify the `shop` table populates owner fields
