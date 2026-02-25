import { json } from "@remix-run/node";

// Static demo data (date wise)
export const loader = () =>
  json([
    {
      popup_type: "recent_purchase",
      visitors: 5,
      views: 2,
      engagements: 1,
      date: "2025-08-28",
    },
    {
      popup_type: "flash_sale",
      visitors: 7,
      views: 3,
      engagements: 2,
      date: "2025-08-28",
    },
    {
      popup_type: "recent_purchase",
      visitors: 10,
      views: 4,
      engagements: 1,
      date: "2025-08-29",
    },
    {
      popup_type: "flash_sale",
      visitors: 12,
      views: 6,
      engagements: 3,
      date: "2025-08-29",
    },
    {
      popup_type: "recent_purchase",
      visitors: 8,
      views: 5,
      engagements: 2,
      date: "2025-08-30",
    },
    {
      popup_type: "flash_sale",
      visitors: 15,
      views: 9,
      engagements: 4,
      date: "2025-08-30",
    },
  ]);
