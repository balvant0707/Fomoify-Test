import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const NOTIFICATION_KEYS = new Set([
  "recent",
  "flash",
  "visitor",
  "lowstock",
  "addtocart",
  "review",
]);

function repairedSearchFromPathToken(key, currentSearch = "") {
  const raw = String(key || "");
  const ampIndex = raw.indexOf("&");
  if (ampIndex < 0) return currentSearch || "";

  const params = new URLSearchParams(raw.slice(ampIndex + 1));
  const current = new URLSearchParams(
    String(currentSearch || "").replace(/^\?/, "")
  );
  for (const [name, value] of current.entries()) {
    if (!params.has(name)) params.set(name, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function targetFor(request, key) {
  const url = new URL(request.url);
  const cleanKey = String(key || "").split("&")[0];

  if (NOTIFICATION_KEYS.has(cleanKey)) {
    return `/app/notification/${cleanKey}${url.search || ""}`;
  }

  if (cleanKey.startsWith("notification")) {
    return `/app/notification${repairedSearchFromPathToken(key, url.search)}`;
  }

  return `/app/notification${url.search || ""}`;
}

export async function loader({ request, params }) {
  await authenticate.admin(request);
  return redirect(targetFor(request, params?.key));
}

export async function action({ request, params }) {
  await authenticate.admin(request);
  return redirect(targetFor(request, params?.key));
}

export default function NotificationFallbackRedirect() {
  return null;
}
