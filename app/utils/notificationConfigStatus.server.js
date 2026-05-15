import prisma from "../db.server";

export const MANAGEABLE_NOTIFICATION_KEYS = [
  "recent",
  "flash",
  "visitor",
  "lowstock",
  "addtocart",
  "review",
  "visitor-block",
  "stock-block",
];

export function notificationConfigModel(key) {
  switch (key) {
    case "recent":
      return prisma.recentpopupconfig || prisma.recentPopupConfig || null;
    case "flash":
      return prisma.flashpopupconfig || prisma.flashPopupConfig || null;
    case "visitor":
      return prisma.visitorpopupconfig || prisma.visitorPopupConfig || null;
    case "lowstock":
      return prisma.lowstockpopupconfig || prisma.lowStockPopupConfig || null;
    case "addtocart":
      return prisma.addtocartpopupconfig || prisma.addToCartPopupConfig || null;
    case "review":
      return prisma.reviewpopupconfig || prisma.reviewPopupConfig || null;
    case "visitor-block":
      return prisma.visitorannouncementconfig || prisma.visitorAnnouncementConfig || null;
    case "stock-block":
      return prisma.stockannouncementconfig || prisma.stockAnnouncementConfig || null;
    default:
      return null;
  }
}

export async function hasSavedNotificationConfig(shop, key) {
  const model = notificationConfigModel(key);
  if (!shop || !model?.count) return false;

  try {
    const count = await model.count({ where: { shop } });
    return Number(count) > 0;
  } catch (error) {
    console.error(`[notificationConfigStatus] ${key} count failed:`, error);
    return false;
  }
}

export async function getNotificationManageVisibility(shop, keys) {
  const normalizedKeys = [...new Set((keys || []).filter(Boolean))];
  const entries = await Promise.all(
    normalizedKeys.map(async (key) => [
      key,
      await hasSavedNotificationConfig(shop, key),
    ])
  );

  return Object.fromEntries(entries);
}
