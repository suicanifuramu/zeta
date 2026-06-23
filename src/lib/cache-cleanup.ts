import { cacheManager, clearAllUrls } from "./cache-db";
import { clearMemoryCache } from "./image-cache";
import type { CleanupResult } from "./cache-types";

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let isCleanupRunning = false;
let visibilityHandler: (() => void) | null = null;

async function deleteFromCacheAPI(urls: string[]): Promise<string[]> {
  if (urls.length === 0) return [];

  try {
    const cache = await caches.open("plot-images");
    const deleted: string[] = [];

    for (const url of urls) {
      try {
        const result = await cache.delete(url);
        if (result) deleted.push(url);
      } catch {
        // Ignore individual failures
      }
    }

    return deleted;
  } catch {
    return [];
  }
}

export async function runCleanup(): Promise<CleanupResult> {
  if (isCleanupRunning) {
    console.log("[CacheCleanup] Already running, skipping");
    return { scanned: 0, deleted: 0, errors: ["Already running"], durationMs: 0 };
  }

  isCleanupRunning = true;
  console.log("[CacheCleanup] Starting...");

  try {
    const expiredUrls = await cacheManager.getExpiredUrls(MAX_AGE_MS);

    if (expiredUrls.length === 0) {
      console.log("[CacheCleanup] No expired items");
      return { scanned: 0, deleted: 0, errors: [], durationMs: 0 };
    }

    await cacheManager.deleteUrls(expiredUrls);
    const cacheDeleted = await deleteFromCacheAPI(expiredUrls);

    const result: CleanupResult = {
      scanned: expiredUrls.length,
      deleted: cacheDeleted.length,
      errors: [],
      durationMs: 0,
    };

    console.log(`[CacheCleanup] Completed: deleted ${result.deleted} items`);
    return result;
  } catch (e) {
    const errorMsg = String(e);
    console.warn("[CacheCleanup] Failed:", errorMsg);
    return { scanned: 0, deleted: 0, errors: [errorMsg], durationMs: 0 };
  } finally {
    isCleanupRunning = false;
  }
}

export function startPeriodicCleanup(): () => void {
  cleanupTimer = setInterval(() => {
    runCleanup().catch((e) => console.warn("[CacheCleanup] Periodic run failed:", e));
  }, CLEANUP_INTERVAL_MS);

  visibilityHandler = () => {
    if (!document.hidden) {
      runCleanup().catch((e) => console.warn("[CacheCleanup] Visibility run failed:", e));
    }
  };
  document.addEventListener("visibilitychange", visibilityHandler);

  return () => stopPeriodicCleanup();
}

export function stopPeriodicCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
}

export function runStartupCleanup(): void {
  setTimeout(() => {
    runCleanup().catch((e) => console.warn("[CacheCleanup] Startup run failed:", e));
  }, 1000);
}

export async function clearAllCache(): Promise<{ deletedCount: number }> {
  clearMemoryCache();

  let deletedCount = 0;

  try {
    const cache = await caches.open("plot-images");
    const keys = await cache.keys();
    await Promise.all(keys.map((req) => cache.delete(req)));
    deletedCount = keys.length;
  } catch (e) {
    console.warn("[CacheCleanup] Cache API clear failed:", e);
  }

  try {
    await clearAllUrls();
  } catch (e) {
    console.warn("[CacheCleanup] IndexedDB clear failed:", e);
  }

  console.log(`[CacheCleanup] All cache cleared: ${deletedCount} items`);
  return { deletedCount };
}