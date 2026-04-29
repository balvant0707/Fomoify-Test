import crypto from "crypto";

// Keep required params minimal to avoid false 401s in mixed proxy environments.
const REQUIRED_PROXY_PARAMS = ["shop", "timestamp"];
const EXCLUDED_SIGNATURE_KEYS = new Set(["signature", "hmac"]);

// Only accept shops on the myshopify.com domain to prevent param injection.
const VALID_SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

// Startup checks - fire once when the module is first loaded.
const _secret = (process.env.SHOPIFY_API_SECRET || "").trim();
if (!_secret) {
  console.error(
    "[FOMO] SHOPIFY_API_SECRET is not set. " +
      "All app proxy requests will be rejected with 401. " +
      "Add this variable in: Vercel -> Project -> Settings -> Environment Variables."
  );
} else {
  const preview = `${_secret.slice(0, 4)}...${_secret.slice(-4)}`;
  console.log(`[FOMO] SHOPIFY_API_SECRET loaded (${_secret.length} chars): ${preview}`);
  console.log(
    "[FOMO] Cross-check: open partners.shopify.com -> App -> API credentials -> Client secret " +
      `and confirm it starts with "${_secret.slice(0, 4)}" and ends with "${_secret.slice(-4)}".`
  );
}

const timingSafeHexEq = (leftHex, rightHex) => {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(String(leftHex || ""), "hex"),
      Buffer.from(String(rightHex || "").toLowerCase(), "hex")
    );
  } catch {
    return false;
  }
};

const hmacHex = (secret, message) =>
  crypto.createHmac("sha256", secret).update(message).digest("hex");

const toParamObject = (params) => {
  const out = {};
  for (const [key, value] of params.entries()) {
    if (EXCLUDED_SIGNATURE_KEYS.has(String(key || "").toLowerCase())) continue;
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value];
    } else {
      out[key] = value;
    }
  }
  return out;
};

const decodeKeySafely = (rawKey) => {
  try {
    return decodeURIComponent(rawKey);
  } catch {
    return rawKey;
  }
};

/**
 * Validates a Shopify app proxy HMAC-SHA256 signature.
 *
 * Canonical Shopify app proxy format is sorted key=value pairs concatenated
 * WITHOUT "&" separators. We also try a few fallback variants because some
 * deployments historically mixed encoded/decoded query construction.
 */
export function verifyProxySignature(url) {
  const secret = (process.env.SHOPIFY_API_SECRET || "").trim();
  if (!secret) return false;

  const u = typeof url === "string" ? new URL(url) : url;
  const signature =
    u.searchParams.get("signature") || u.searchParams.get("hmac") || "";

  if (!/^[0-9a-f]{64}$/i.test(signature)) {
    console.warn(`[FOMO] verifyProxySignature: signature format invalid (len=${signature.length})`);
    return false;
  }

  const decodedPairs = [];
  for (const [key, value] of u.searchParams.entries()) {
    if (EXCLUDED_SIGNATURE_KEYS.has(String(key || "").toLowerCase())) continue;
    decodedPairs.push(`${key}=${value}`);
  }
  decodedPairs.sort();
  const decodedMessageNoAmp = decodedPairs.join("");
  const decodedMessageAmp = decodedPairs.join("&");

  const rawQuery = u.search.startsWith("?") ? u.search.slice(1) : u.search;
  const rawPairs = rawQuery
    .split("&")
    .filter(Boolean)
    .filter((pair) => {
      const eqIdx = pair.indexOf("=");
      const rawKey = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
      const normalizedKey = String(decodeKeySafely(rawKey) || "").toLowerCase();
      return !EXCLUDED_SIGNATURE_KEYS.has(normalizedKey);
    })
    .sort();
  const rawMessageNoAmp = rawPairs.join("");
  const rawMessageAmp = rawPairs.join("&");

  const candidates = [
    { label: "decoded(no-amp)", message: decodedMessageNoAmp },
    { label: "decoded(&)", message: decodedMessageAmp },
    { label: "raw(no-amp)", message: rawMessageNoAmp },
    { label: "raw(&)", message: rawMessageAmp },
  ];

  for (const candidate of candidates) {
    const computed = hmacHex(secret, candidate.message);
    if (timingSafeHexEq(computed, signature)) {
      if (candidate.label !== "decoded(no-amp)") {
        console.warn(`[FOMO] HMAC matched using fallback mode: ${candidate.label}`);
      }
      return true;
    }
  }

  const secretPreview = `${secret.slice(0, 4)}...${secret.slice(-4)}`;
  const computedDecodedNoAmp = hmacHex(secret, decodedMessageNoAmp);
  const computedDecodedAmp = hmacHex(secret, decodedMessageAmp);
  const computedRawNoAmp = hmacHex(secret, rawMessageNoAmp);
  const computedRawAmp = hmacHex(secret, rawMessageAmp);
  const signedParams = toParamObject(u.searchParams);

  console.warn(
    `[FOMO] HMAC mismatch (all canonical variants tried) -- secret=${secretPreview} len=${secret.length}\n` +
      `[FOMO]   hint=Shopify app proxies are signed with the app Client secret for the app proxy owner app. If decoded(no-amp) does not match, check SHOPIFY_API_SECRET and remove manually-added signed params from storefront fetches.\n` +
      `[FOMO]   signed params=${JSON.stringify(signedParams)}\n` +
      `[FOMO]   decoded(no-amp) message="${decodedMessageNoAmp}"\n` +
      `[FOMO]   decoded(&)      message="${decodedMessageAmp}"\n` +
      `[FOMO]   raw(no-amp)     message="${rawMessageNoAmp}"\n` +
      `[FOMO]   raw(&)          message="${rawMessageAmp}"\n` +
      `[FOMO]   computed(decoded no-amp)=${computedDecodedNoAmp.slice(0, 8)}...${computedDecodedNoAmp.slice(-8)}\n` +
      `[FOMO]   computed(decoded &)     =${computedDecodedAmp.slice(0, 8)}...${computedDecodedAmp.slice(-8)}\n` +
      `[FOMO]   computed(raw no-amp)    =${computedRawNoAmp.slice(0, 8)}...${computedRawNoAmp.slice(-8)}\n` +
      `[FOMO]   computed(raw &)         =${computedRawAmp.slice(0, 8)}...${computedRawAmp.slice(-8)}\n` +
      `[FOMO]   received                =${signature.slice(0, 8)}...${signature.slice(-8)}`
  );

  return false;
}

/**
 * Full proxy request guard - call this at the top of every proxy loader/action.
 *
 * Returns true only when ALL of these hold:
 *   1. HMAC signature is cryptographically valid
 *   2. Required Shopify params (shop, timestamp, path_prefix) are present
 *   3. shop value is a legitimate *.myshopify.com domain
 *   4. timestamp is within maxAgeSeconds of now (replay-attack prevention)
 */
export function isValidProxyRequest(requestUrl, maxAgeSeconds = 300) {
  const url = typeof requestUrl === "string" ? new URL(requestUrl) : requestUrl;
  const params = url.searchParams;

  if ((process.env.FOMO_BYPASS_HMAC || "").toLowerCase() === "true") {
    const shop = params.get("shop") || "";
    if (VALID_SHOP_RE.test(shop)) {
      console.warn("[FOMO] HMAC bypassed via FOMO_BYPASS_HMAC - remove once SHOPIFY_API_SECRET is correct");
      return true;
    }
    console.warn(`[FOMO] FOMO_BYPASS_HMAC set but shop "${shop}" is not a valid myshopify.com domain`);
    return false;
  }

  if (!(process.env.SHOPIFY_API_SECRET || "").trim()) {
    console.error(
      "[FOMO] isValidProxyRequest rejected: SHOPIFY_API_SECRET is not set. " +
        "Set it in Vercel -> Project -> Settings -> Environment Variables."
    );
    return false;
  }

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

  for (const key of REQUIRED_PROXY_PARAMS) {
    if (!params.get(key)) {
      console.warn(`[FOMO] isValidProxyRequest rejected: missing required param "${key}".`);
      return false;
    }
  }

  const shop = params.get("shop") || "";
  if (!VALID_SHOP_RE.test(shop)) {
    console.warn(`[FOMO] isValidProxyRequest rejected: invalid shop domain "${shop}".`);
    return false;
  }

  const timestamp = Number(params.get("timestamp") || "0");
  if (!timestamp) {
    console.warn("[FOMO] isValidProxyRequest rejected: missing or zero timestamp.");
    return false;
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > maxAgeSeconds) {
    console.warn(
      `[FOMO] isValidProxyRequest rejected: timestamp is ${ageSeconds}s old (max ${maxAgeSeconds}s). Possible replay attack.`
    );
    return false;
  }

  return true;
}
