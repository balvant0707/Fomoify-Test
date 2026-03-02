const cache = new Map();

export function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function setCache(key, value, ttlMs = 30000) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export async function getOrSetCache(key, ttlMs, loader) {
  const cached = getCache(key);
  if (cached) return cached;
  const value = await loader();
  return setCache(key, value, ttlMs);
}
