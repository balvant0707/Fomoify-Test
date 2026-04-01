// app/routes/app.review-popup-status.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getDashboardReviewPopupStatus } from "../utils/reviewPopupStatus.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  return json(await getDashboardReviewPopupStatus(session.shop));
}
