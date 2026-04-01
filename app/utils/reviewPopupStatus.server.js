// app/utils/reviewPopupStatus.server.js
import prisma from "../db.server";

export async function getDashboardReviewPopupStatus(shop) {
  let popupOrderCount = 0;

  // Try orderreviewrequest table first
  try {
    const orderReviewModel =
      prisma.orderreviewrequest || prisma.orderReviewRequest || null;
    if (orderReviewModel?.count) {
      popupOrderCount = await orderReviewModel.count({ where: { shop } });
      return { popupOrderCount, shouldShowReviewPopup: popupOrderCount >= 1 };
    }
  } catch {}

  // Fall back to popupanalyticsevent
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

  return { popupOrderCount, shouldShowReviewPopup: popupOrderCount >= 1 };
}
