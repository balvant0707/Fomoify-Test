export function normalizeShopDomain(rawValue: unknown): string {
  const raw = String(rawValue || "").trim().toLowerCase();
  if (!raw) return "";

  const withoutProtocol = raw.replace(/^https?:\/\//, "");
  const host = withoutProtocol.split(/[/?#]/)[0] || "";
  if (!host) return "";

  const myshopifyMatch = host.match(/^([a-z0-9-]+)\.myshopify\.com$/);
  if (myshopifyMatch?.[1]) {
    return `${myshopifyMatch[1]}.myshopify.com`;
  }

  // Fallback when only handle is available (rare in proxy params).
  if (/^[a-z0-9-]+$/.test(host)) {
    return `${host}.myshopify.com`;
  }

  return "";
}

export function getStoreHandleFromShopDomain(shopDomain: string): string {
  const normalized = normalizeShopDomain(shopDomain);
  if (!normalized) return "";
  return normalized.replace(/\.myshopify\.com$/, "");
}

