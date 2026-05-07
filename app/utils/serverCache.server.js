const cache = new Map();

// Sentinel so we can cache null without it being confused with a cache miss.
const CACHED_NULL = Symbol("fomo-cached-null");

export function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value === CACHED_NULL ? null : hit.value;
}

export function setCache(key, value, ttlMs = 30000) {
  cache.set(key, {
    value: value === null || value === undefined ? CACHED_NULL : value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
}

export function deleteCache(key) {
  cache.delete(key);
}

export function deleteCacheByPrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export async function getOrSetCache(key, ttlMs, loader) {
  const cached = getCache(key);
  // undefined = cache miss; null/false/0/"" are valid cached values
  if (cached !== undefined) return cached;
  const value = await loader();
  return setCache(key, value, ttlMs);
}
