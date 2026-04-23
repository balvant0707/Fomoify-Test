import crypto from "crypto";

// Shopify always sends these three params on every proxy request.
const REQUIRED_PROXY_PARAMS = ["shop", "timestamp", "path_prefix"];

// Only accept shops on the myshopify.com domain to prevent param injection.
const VALID_SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

/**
 * Validates a Shopify app proxy HMAC-SHA256 signature.
 *
 * Algorithm (per Shopify docs):
 *   1. Collect every query param EXCEPT "signature"
 *   2. Sort the pairs alphabetically by key
 *   3. Join as "key=value" with "&"
 *   4. HMAC-SHA256( SHOPIFY_API_SECRET, message ) → compare hex to signature
 *
 * Uses crypto.timingSafeEqual to prevent timing-based side-channel attacks.
 *
 * Reference: https://shopify.dev/docs/apps/build/online-store/app-proxies#calculate-a-proxy-signature
 */
export function verifyProxySignature(url) {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  if (!secret) {
    // Fatal misconfiguration — fail closed so no data leaks
    console.error("[FOMO] SHOPIFY_API_SECRET is not set — proxy signature cannot be verified");
    return false;
  }

  const u = typeof url === "string" ? new URL(url) : url;
  const signature = u.searchParams.get("signature") || "";

  // Shopify HMAC-SHA256 is always exactly 64 lowercase hex chars.
  // Reject anything that doesn't match to avoid crypto.timingSafeEqual length errors.
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;

  const pairs = [];
  for (const [key, value] of u.searchParams.entries()) {
    if (key !== "signature") pairs.push(`${key}=${value}`);
  }
  pairs.sort(); // must sort alphabetically — Shopify spec

  const computed = crypto
    .createHmac("sha256", secret)
    .update(pairs.join("&"))
    .digest("hex");

  try {
    // timingSafeEqual prevents attackers from guessing the HMAC one byte at a time
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(signature.toLowerCase(), "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Full proxy request guard. Returns true only when ALL of the following hold:
 *
 *   1. HMAC signature is cryptographically valid
 *   2. Required Shopify params (shop, timestamp, path_prefix) are present
 *   3. shop value is a legitimate *.myshopify.com domain (no injection)
 *   4. timestamp is within maxAgeSeconds of now (replay-attack prevention)
 *
 * Call this at the very top of every proxy loader and action before
 * touching the database or returning any data.
 */
export function isValidProxyRequest(requestUrl, maxAgeSeconds = 300) {
  const url = typeof requestUrl === "string" ? new URL(requestUrl) : requestUrl;
  const params = url.searchParams;

  // 1 — HMAC must be valid first; do this before anything else so we don't
  //     leak information about which other checks would have failed.
  if (!verifyProxySignature(url)) return false;

  // 2 — Required params must all be present (signature already confirmed above)
  for (const key of REQUIRED_PROXY_PARAMS) {
    if (!params.get(key)) return false;
  }

  // 3 — Shop must be a well-formed myshopify.com domain.
  //     The signature guarantees it hasn't been tampered with, but we still
  //     enforce the format so downstream code can safely trust the value.
  const shop = params.get("shop") || "";
  if (!VALID_SHOP_RE.test(shop)) return false;

  // 4 — Reject stale requests to prevent replay attacks.
  //     Shopify's own docs recommend a 60-second window; we use 300s (5 min)
  //     to accommodate modest clock skew between Shopify's edge and our server.
  const timestamp = Number(params.get("timestamp") || "0");
  if (!timestamp) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  return ageSeconds <= maxAgeSeconds;
}
