// app/routes/app.health.jsx
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return json({ ok: true, shop: session.shop });
};

export default function Health() {
  const d = useLoaderData();
  return <div style={{ padding: 16 }}>OK — {d.shop}</div>;
}