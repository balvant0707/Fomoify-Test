// app/routes/app.notification.jsx
import { Frame } from "@shopify/polaris";
import { Outlet } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function NotificationLayout() {
  // Parent layout for all /app/notification/* routes
  return (
    <Frame>
      <Outlet />  {/* renders: /app/notification (index), /recent, /flash */}
    </Frame>
  );
}
