import prisma from "../db.server";
import { upsertInstalledShop } from "./upsertShop.server";

const SHOP_PROFILE_REFRESH_MS = 6 * 60 * 60 * 1000;

const normalizeShop = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

const SHOP_PROFILE_QUERY = `#graphql
  query AppInstallOwnerInfo {
    shop {
      email
      contactEmail
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
  }`;

const needsRefresh = (row, maxAgeMs) => {
  if (!row) return true;

  const hasMissingDetails = [
    row.ownerName,
    row.email,
    row.contactEmail,
    row.name,
    row.country,
    row.city,
    row.currency,
    row.phone,
    row.primaryDomain,
    row.plan,
  ].some((v) => v === null || v === undefined || String(v).trim() === "");

  if (hasMissingDetails) return true;

  const updatedAt = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return true;

  return Date.now() - updatedAt >= maxAgeMs;
};

export async function syncShopDetails({
  admin,
  shop: rawShop,
  accessToken,
  force = false,
  maxAgeMs = SHOP_PROFILE_REFRESH_MS,
}) {
  const shop = normalizeShop(rawShop);
  if (!shop) return null;

  // Ensure row exists for every authenticated request.
  const basicRow = await upsertInstalledShop({
    shop,
    accessToken,
  });

  if (!admin?.graphql) return basicRow;

  try {
    const existing = await prisma.shop.findUnique({
      where: { shop },
      select: {
        id: true,
        ownerName: true,
        email: true,
        contactEmail: true,
        name: true,
        country: true,
        city: true,
        currency: true,
        phone: true,
        primaryDomain: true,
        plan: true,
        updatedAt: true,
      },
    });

    if (!force && !needsRefresh(existing, maxAgeMs)) {
      return basicRow || existing;
    }

    const resp = await admin.graphql(SHOP_PROFILE_QUERY);
    const js = await resp.json();
    const shopData = js?.data?.shop;

    if (!shopData) return basicRow;

    return await upsertInstalledShop({
      shop,
      accessToken,
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
  } catch (error) {
    console.error("[shop sync] failed to fetch/persist shop details:", error);
    return basicRow;
  }
}
