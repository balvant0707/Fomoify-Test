import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request, params }) {
  await authenticate.admin(request);
  const key = String(params?.key || "");
  if (!key) throw new Response("Missing key", { status: 400 });
  const url = new URL(request.url);
  return redirect(`/app/notification/${key}${url.search || ""}`);
}

export async function action({ request, params }) {
  await authenticate.admin(request);
  const key = String(params?.key || "");
  if (!key) throw new Response("Missing key", { status: 400 });
  const url = new URL(request.url);
  return redirect(`/app/notification/${key}${url.search || ""}`);
}

export default function NotificationRedirect() {
  return null;
}
