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
const REVIEW_POPUP_DELAY_DAYS = Number(process.env.REVIEW_POPUP_DELAY_DAYS || 7);

function getDaysSince(dateLike) {
  if (!dateLike) return null;
  const then = new Date(dateLike).getTime();
  if (!Number.isFinite(then)) return null;
  const diffMs = Date.now() - then;
  if (!Number.isFinite(diffMs) || diffMs < 0) return 0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

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
  let shopCreatedAt = null;

  try {
    if (shop && prisma?.shop?.findUnique) {
      const shopRow = await prisma.shop.findUnique({
        where: { shop },
        select: { createdAt: true },
      });
      shopCreatedAt = shopRow?.createdAt || null;
    }
  } catch {}

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
  const allPopupConfigsSaved = configuredPopupCount >= requiredPopupConfigCount;
  const daysSinceInstall = getDaysSince(shopCreatedAt);
  const installAgeReached =
    daysSinceInstall === null ? true : daysSinceInstall >= REVIEW_POPUP_DELAY_DAYS;
  const shouldShowReviewPopup =
    popupOrderCount >= 1 && allPopupConfigsSaved && installAgeReached;

  return {
    popupOrderCount,
    shouldShowReviewPopup,
    configuredPopupCount,
    requiredPopupConfigCount,
    allPopupConfigsSaved,
    shopCreatedAt,
    daysSinceInstall,
    reviewPopupDelayDays: REVIEW_POPUP_DELAY_DAYS,
    installAgeReached,
  };
}
