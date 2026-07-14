/**
 * Simple in-memory cache for Naver API responses
 * TTL: 10 minutes (600 seconds)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, CacheEntry<any>>();

/**
 * Generate cache key from request parameters
 */
export function generateCacheKey(
  type: "unified",
  keywords: string[],
  category: string,
  startDate: string,
  endDate: string,
  timeUnit: string,
  device?: string,
  gender?: string,
  ages?: string[]
): string {
  // Sort keywords for consistent cache key (don't mutate original)
  const keywordStr = [...keywords].sort().join("|");
  const ageStr = ages ? [...ages].sort().join("|") : "";
  return `${type}:${keywordStr}:${category}:${startDate}:${endDate}:${timeUnit}:${device || ""}:${gender || ""}:${ageStr}`;
}

/**
 * Get cached data if available and not expired
 */
export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    // Cache expired, remove it
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

/**
 * Store data in cache
 */
export function setInCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  cache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cache.delete(key));
}

/**
 * Clear all cache (for testing)
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ key: string; age: number }>;
} {
  const now = Date.now();
  const entries = Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    age: now - entry.timestamp,
  }));

  return {
    size: cache.size,
    entries,
  };
}
