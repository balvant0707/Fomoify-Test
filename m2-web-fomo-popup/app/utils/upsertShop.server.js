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
    installed: true,
    status: "installed",
    uninstalledAt: null,
    ...(accessToken !== undefined && { accessToken: accessToken ?? null }),
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
        accessToken: accessToken ?? null,
        ...updateData,
      },
    });
  } catch (error) {
    console.error("[shop upsert] failed:", error);
    return null;
  }
}
