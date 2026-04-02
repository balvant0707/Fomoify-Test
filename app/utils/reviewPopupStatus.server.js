// app/utils/reviewPopupStatus.server.js
import prisma from "../db.server";

const POPUP_CONFIG_MODELS = [
  ["recentpopupconfig", "recentPopupConfig"],
  ["flashpopupconfig", "flashPopupConfig"],
  ["visitorpopupconfig", "visitorPopupConfig"],
  ["lowstockpopupconfig", "lowStockPopupConfig"],
  ["addtocartpopupconfig", "addToCartPopupConfig"],
  ["reviewpopupconfig", "reviewPopupConfig"],
];

function resolveModel(keys) {
  for (const key of keys) {
    if (prisma?.[key]) return prisma[key];
  }
  return null;
}

async function hasSavedPopupConfig(shop, keys) {
  const model = resolveModel(keys);
  if (!shop || !model?.count) return false;
  try {
    const count = await model.count({ where: { shop } });
    return Number(count) > 0;
  } catch {
    return false;
  }
}

export async function getDashboardReviewPopupStatus(shop) {
  let popupOrderCount = 0;
  let hasOrderReviewCount = false;

  // Try orderreviewrequest table first
  try {
    const orderReviewModel =
      prisma.orderreviewrequest || prisma.orderReviewRequest || null;
    if (orderReviewModel?.count) {
      popupOrderCount = await orderReviewModel.count({ where: { shop } });
      hasOrderReviewCount = true;
    }
  } catch {}

  // Fall back to popupanalyticsevent only if orderreviewrequest isn't available.
  if (!hasOrderReviewCount) {
    try {
      const analyticsModel =
        prisma.popupanalyticsevent || prisma.popupAnalyticsEvent || null;
      if (analyticsModel?.count) {
        popupOrderCount = await analyticsModel.count({
          where: {
            shop,
            eventType: "order",
            popupType: {
              in: ["flash", "recent", "visitor", "lowstock", "addtocart", "review"],
            },
          },
        });
      }
    } catch {}
  }

  const popupConfigChecks = await Promise.all(
    POPUP_CONFIG_MODELS.map((keys) => hasSavedPopupConfig(shop, keys))
  );
  const configuredPopupCount = popupConfigChecks.filter(Boolean).length;
  const requiredPopupConfigCount = POPUP_CONFIG_MODELS.length;

  return {
    popupOrderCount,
    shouldShowReviewPopup: popupOrderCount >= 1,
    configuredPopupCount,
    requiredPopupConfigCount,
    allPopupConfigsSaved: configuredPopupCount >= requiredPopupConfigCount,
  };
}
