import { json } from "@remix-run/node";

export const isRouteResponse = (value) =>
  value instanceof Response ||
  (value &&
    typeof value === "object" &&
    typeof value.status === "number" &&
    value.headers instanceof Headers);

export const isActionDataRequest = (request) => {
  const accept = request.headers.get("accept") || "";
  const contentType = request.headers.get("content-type") || "";
  return (
    request.headers.get("X-Remix-Request") === "yes" ||
    accept.includes("application/json") ||
    contentType.includes("application/json")
  );
};

export const handleAdminAuthActionResponse = (error, request) => {
  if (!isRouteResponse(error)) return null;
  if (!isActionDataRequest(request)) throw error;

  const location = error.headers?.get?.("location") || "";
  return json(
    {
      ok: false,
      success: false,
      authRequired: true,
      authRedirect: location,
      error: "Session expired. Please refresh the app and try again.",
    },
    {
      status: 401,
      headers: location ? { "X-Shopify-Auth-Redirect": location } : undefined,
    }
  );
};
