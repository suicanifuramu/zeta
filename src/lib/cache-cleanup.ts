import { cacheManager, clearAllUrls } from "./cache-db"
import { PLOT_IMAGE_CACHE, clearMemoryCache } from "./image-cache"
import type { CleanupResult } from "./cache-types"
import { logger } from "./log"

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

let cleanupTimer: ReturnType<typeof setInterval> | null = null
let isCleanupRunning = false
let visibilityHandler: (() => void) | null = null

async function deleteFromCacheAPI(urls: string[]): Promise<string[]> {
  if (urls.length === 0) return []
  if (typeof caches === "undefined") return []

  try {
    const cache = await caches.open(PLOT_IMAGE_CACHE)
    const deleted: string[] = []

    for (const url of urls) {
      try {
        const result = await cache.delete(url)
        if (result) deleted.push(url)
      } catch {
        // Ignore individual failures
      }
    }

    return deleted
  } catch {
    return []
  }
}

/** Empty the whole cover bucket. Returns how many entries were removed. */
async function clearPlotImageCache(): Promise<number> {
  if (typeof caches === "undefined") return 0

  try {
    const cache = await caches.open(PLOT_IMAGE_CACHE)
    const keys = await cache.keys()
    await Promise.all(
      keys.map((request) => cache.delete(request).catch(() => false))
    )
    return keys.length
  } catch {
    return 0
  }
}

export async function runCleanup(): Promise<CleanupResult> {
  if (isCleanupRunning) {
    logger.debug("[CacheCleanup] Already running, skipping")
    return {
      scanned: 0,
      deleted: 0,
      errors: ["Already running"],
      durationMs: 0,
    }
  }

  isCleanupRunning = true
  logger.debug("[CacheCleanup] Starting...")

  try {
    const expiredUrls = await cacheManager.getExpiredUrls(MAX_AGE_MS)

    if (expiredUrls.length === 0) {
      logger.debug("[CacheCleanup] No expired items")
      return { scanned: 0, deleted: 0, errors: [], durationMs: 0 }
    }

    await cacheManager.deleteUrls(expiredUrls)
    const cacheDeleted = await deleteFromCacheAPI(expiredUrls)

    const result: CleanupResult = {
      scanned: expiredUrls.length,
      deleted: cacheDeleted.length,
      errors: [],
      durationMs: 0,
    }

    logger.debug(`[CacheCleanup] Completed: deleted ${result.deleted} items`)
    return result
  } catch (e) {
    const errorMsg = String(e)
    console.warn("[CacheCleanup] Failed:", errorMsg)
    return { scanned: 0, deleted: 0, errors: [errorMsg], durationMs: 0 }
  } finally {
    isCleanupRunning = false
  }
}

export function startPeriodicCleanup(): () => void {
  cleanupTimer = setInterval(() => {
    runCleanup().catch((e) =>
      console.warn("[CacheCleanup] Periodic run failed:", e)
    )
  }, CLEANUP_INTERVAL_MS)

  visibilityHandler = () => {
    if (!document.hidden) {
      runCleanup().catch((e) =>
        console.warn("[CacheCleanup] Visibility run failed:", e)
      )
    }
  }
  document.addEventListener("visibilitychange", visibilityHandler)

  return () => stopPeriodicCleanup()
}

export function stopPeriodicCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler)
    visibilityHandler = null
  }
}

export function runStartupCleanup(): void {
  setTimeout(() => {
    runCleanup().catch((e) =>
      console.warn("[CacheCleanup] Startup run failed:", e)
    )
  }, 1000)
}

export interface ClearAllCacheResult {
  /** Object URLs revoked from the in-memory map. */
  deletedCount: number
  /** Entries removed from the Cache API bucket. */
  cacheEntries: number
}

export async function clearAllCache(): Promise<ClearAllCacheResult> {
  const deletedCount = clearMemoryCache()

  try {
    await clearAllUrls()
  } catch (e) {
    console.warn("[CacheCleanup] IndexedDB clear failed:", e)
  }

  // The Cache API holds the actual image bodies; leaving it alone meant a
  // single bad response could never be cleared from the app.
  const cacheEntries = await clearPlotImageCache()

  logger.debug(
    `[CacheCleanup] Cache cleared: ${deletedCount} memory, ${cacheEntries} cache API`
  )
  return { deletedCount, cacheEntries }
}
