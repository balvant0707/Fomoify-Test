import crypto from "crypto";

// Shopify always sends these three params on every proxied request.
const REQUIRED_PROXY_PARAMS = ["shop", "timestamp", "path_prefix"];

// Only accept shops on the myshopify.com domain to prevent param injection.
const VALID_SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

// Startup checks — fire once when the module is first loaded.
const _secret = (process.env.SHOPIFY_API_SECRET || "").trim();
if (!_secret) {
  console.error(
    "[FOMO] ⚠️  SHOPIFY_API_SECRET is not set. " +
    "All app proxy requests will be rejected with 401. " +
    "Add this variable in: Vercel → Project → Settings → Environment Variables."
  );
} else {
  // Log the first 4 + last 4 chars so you can cross-check with the Partner Dashboard
  // without exposing the full secret in logs.
  const preview = `${_secret.slice(0, 4)}…${_secret.slice(-4)}`;
  console.log(`[FOMO] SHOPIFY_API_SECRET loaded (${_secret.length} chars): ${preview}`);
  console.log(
    "[FOMO] Cross-check: open partners.shopify.com → App → API credentials → Client secret " +
    `and confirm it starts with "${_secret.slice(0, 4)}" and ends with "${_secret.slice(-4)}".`
  );
}

/**
 * Validates a Shopify app proxy HMAC-SHA256 signature.
 *
 * Algorithm (per Shopify docs):
 *   1. Collect every query param EXCEPT "signature"
 *   2. Sort the pairs alphabetically by key
 *   3. Join as "key=value" with "&"
 *   4. HMAC-SHA256( SHOPIFY_API_SECRET, message ) → compare hex to "signature"
 *
 * Uses crypto.timingSafeEqual to prevent timing-based side-channel attacks.
 */
export function verifyProxySignature(url) {
  // .trim() catches accidental copy-paste whitespace in Vercel env var editor
  const secret = (process.env.SHOPIFY_API_SECRET || "").trim();
  if (!secret) return false; // startup warning already fired above

  const u = typeof url === "string" ? new URL(url) : url;
  const signature = u.searchParams.get("signature") || "";

  // Shopify HMAC-SHA256 is always exactly 64 lowercase hex chars.
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
    // timingSafeEqual prevents attackers guessing the HMAC byte-by-byte via response time
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(signature.toLowerCase(), "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Full proxy request guard — call this at the top of every proxy loader/action.
 *
 * Returns true only when ALL of these hold:
 *   1. HMAC signature is cryptographically valid
 *   2. Required Shopify params (shop, timestamp, path_prefix) are present
 *   3. shop value is a legitimate *.myshopify.com domain
 *   4. timestamp is within maxAgeSeconds of now (replay-attack prevention)
 *
 * Logs the exact failing check so the Vercel log makes the problem obvious.
 */
export function isValidProxyRequest(requestUrl, maxAgeSeconds = 300) {
  const url = typeof requestUrl === "string" ? new URL(requestUrl) : requestUrl;
  const params = url.searchParams;

  // Fast-fail with a clear message when the env var is the problem.
  if (!(process.env.SHOPIFY_API_SECRET || "").trim()) {
    console.error(
      "[FOMO] isValidProxyRequest rejected: SHOPIFY_API_SECRET is not set. " +
      "Set it in Vercel → Project → Settings → Environment Variables."
    );
    return false;
  }

  // Validate HMAC first so we don't leak which other checks would have failed.
  if (!verifyProxySignature(url)) {
    const hasAll = REQUIRED_PROXY_PARAMS.every((k) => !!params.get(k));
    if (!hasAll) {
      const missing = REQUIRED_PROXY_PARAMS.filter((k) => !params.get(k));
      console.warn(
        `[FOMO] isValidProxyRequest rejected: missing required params: ${missing.join(", ")}. ` +
        "Request may not have gone through Shopify's app proxy."
      );
    } else {
      console.warn(
        "[FOMO] isValidProxyRequest rejected: HMAC mismatch. " +
        "Verify that SHOPIFY_API_SECRET in Vercel matches the Client Secret in your Shopify Partner Dashboard."
      );
    }
    return false;
  }

  // Required params must all be present (signature confirmed above).
  for (const key of REQUIRED_PROXY_PARAMS) {
    if (!params.get(key)) {
      console.warn(`[FOMO] isValidProxyRequest rejected: missing required param "${key}".`);
      return false;
    }
  }

  // Shop must be a well-formed myshopify.com domain.
  const shop = params.get("shop") || "";
  if (!VALID_SHOP_RE.test(shop)) {
    console.warn(`[FOMO] isValidProxyRequest rejected: invalid shop domain "${shop}".`);
    return false;
  }

  // Reject stale requests to prevent replay attacks (5-minute window).
  const timestamp = Number(params.get("timestamp") || "0");
  if (!timestamp) {
    console.warn("[FOMO] isValidProxyRequest rejected: missing or zero timestamp.");
    return false;
  }
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > maxAgeSeconds) {
    console.warn(`[FOMO] isValidProxyRequest rejected: timestamp is ${ageSeconds}s old (max ${maxAgeSeconds}s). Possible replay attack.`);
    return false;
  }

  return true;
}
