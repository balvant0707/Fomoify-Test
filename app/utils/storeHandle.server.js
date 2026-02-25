export function getStoreHandleFromShopDomain(shopDomain) {
  const raw = String(shopDomain || "").trim().toLowerCase();
  if (!raw) return "";

  const withoutProtocol = raw.replace(/^https?:\/\//, "");

  const storePathMatch = withoutProtocol.match(/\/store\/([a-z0-9-]+)/);
  if (storePathMatch?.[1]) return storePathMatch[1];

  const domain = withoutProtocol.split(/[/?#]/)[0];
  const domainMatch = domain.match(/^([a-z0-9-]+)\.myshopify\.com$/);
  if (domainMatch?.[1]) return domainMatch[1];

  if (domain && !domain.includes(".")) return domain;
  return "";
}

