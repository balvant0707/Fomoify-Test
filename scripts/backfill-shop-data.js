#!/usr/bin/env node
// scripts/backfill-shop-data.js
//
// Backfills shop owner data (name, email, country, etc.) for all installed
// shops that currently have NULL owner fields.
//
// Usage:
//   node scripts/backfill-shop-data.js
//
// Reads DATABASE_URL from .env automatically.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
try {
  const envPath = resolve(__dirname, "../.env");
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not found — rely on environment variables already set
}

const { prisma } = await import("../app/db.server.js");

const SHOPIFY_API_VERSION = "2025-01";

const GQL_QUERY = `{
  shop {
    name
    email
    contactEmail
    myshopifyDomain
    shopOwnerName
    currencyCode
    plan { displayName }
    primaryDomain { host }
    billingAddress { country city phone }
  }
}`;

async function fetchShopData(shopDomain, accessToken) {
  const resp = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: GQL_QUERY }),
    }
  );
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const js = await resp.json();
  if (js.errors) throw new Error(JSON.stringify(js.errors));
  return js?.data?.shop || null;
}

async function main() {
  // Get all installed shops with missing owner data
  const shops = await prisma.shop.findMany({
    where: {
      installed: true,
      accessToken: { not: null },
      name: null, // missing owner data
    },
    select: { id: true, shop: true, accessToken: true },
  });

  console.log(`Found ${shops.length} shops to backfill.\n`);

  let success = 0;
  let failed = 0;

  for (const row of shops) {
    process.stdout.write(`  ${row.shop} ... `);
    try {
      const sd = await fetchShopData(row.shop, row.accessToken);
      if (!sd) {
        console.log("no data returned");
        failed++;
        continue;
      }

      await prisma.shop.update({
        where: { id: row.id },
        data: {
          ownerName: sd.shopOwnerName || null,
          email: sd.email || null,
          contactEmail: sd.contactEmail || null,
          name: sd.name || null,
          country: sd.billingAddress?.country || null,
          city: sd.billingAddress?.city || null,
          currency: sd.currencyCode || null,
          phone: sd.billingAddress?.phone || null,
          primaryDomain: sd.primaryDomain?.host || null,
          plan: sd.plan?.displayName || null,
          updatedAt: new Date(),
        },
      });

      console.log(`✓ ${sd.name || sd.myshopifyDomain}`);
      success++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      failed++;
    }

    // Small delay to avoid hitting Shopify rate limits
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
