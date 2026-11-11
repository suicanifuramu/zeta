import { useEffect, useState } from "react"
import { cacheManager } from "@/lib/cache-db"
import {
  PLOT_IMAGE_CACHE,
  fetchPromises,
  memoryCache,
  subscribeToCacheClear,
} from "@/lib/image-cache"
import { runStartupCleanup, startPeriodicCleanup } from "@/lib/cache-cleanup"

let cleanupInitialized = false

/**
 * A request that never settles used to wedge its URL for the rest of the
 * session: the shared promise stayed in `fetchPromises`, `cachedSrc` stayed on
 * the plain URL, and the `<img>` sat at opacity 0 until a reload. Give up
 * after this and fall back to the network path.
 */
const FETCH_TIMEOUT_MS = 8000

let globalCachePromise: Promise<Cache | null> | null = null

/** `null` when the Cache API is missing (insecure origin, private mode). */
function getPlotImageCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return Promise.resolve(null)
  if (!globalCachePromise) {
    globalCachePromise = caches
      .open(PLOT_IMAGE_CACHE)
      .catch(() => null as Cache | null)
  }
  return globalCachePromise
}

function isImageResponse(res: Response): boolean {
  const type = res.headers.get("content-type")
  // Blob-backed responses can omit the header; only reject a known-bad type.
  return !type || type.startsWith("image/")
}

async function fetchImage(src: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(src, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!isImageResponse(res)) throw new Error("not an image response")
    return res
  } finally {
    clearTimeout(timer)
  }
}

async function loadImage(src: string): Promise<string> {
  const cache = await getPlotImageCache()

  let res = cache ? await cache.match(src) : undefined
  if (res && !isImageResponse(res)) {
    // A cached HTML/JSON error page would otherwise be served forever.
    await cache!.delete(src).catch(() => {})
    res = undefined
  }

  if (!res) {
    res = await fetchImage(src)
    if (cache) {
      // Not awaited: a quota failure must not fail the image.
      void cache.put(src, res.clone()).catch(() => {})
    }
  }

  const blob = await res.blob()
  if (blob.size === 0) throw new Error("empty image")

  const objectUrl = URL.createObjectURL(blob)
  memoryCache.set(src, objectUrl)
  return objectUrl
}

export function useImageCache(
  src: string | undefined,
  noCache = false
): { cachedSrc: string | undefined } {
  const [cacheTick, setCacheTick] = useState(0)
  const [asyncKey, setAsyncKey] = useState(() => `${src}|${noCache}`)
  const [asyncObjectUrl, setAsyncObjectUrl] = useState<string | undefined>()

  const newKey = `${src}|${noCache}|${cacheTick}`
  if (newKey !== asyncKey) {
    setAsyncKey(newKey)
    setAsyncObjectUrl(undefined)
  }

  const syncCachedSrc = !src || noCache ? src : memoryCache.get(src) || src
  const cachedSrc = asyncObjectUrl ?? syncCachedSrc

  useEffect(() => {
    return subscribeToCacheClear(() => setCacheTick((t) => t + 1))
  }, [])

  useEffect(() => {
    if (!cleanupInitialized) {
      cleanupInitialized = true
      runStartupCleanup()
      startPeriodicCleanup()
    }
  }, [])

  useEffect(() => {
    if (!src || noCache) return

    if (memoryCache.has(src)) {
      cacheManager.recordAccess(src).catch(() => {})
      return
    }

    let isMounted = true

    async function load() {
      if (fetchPromises.has(src!)) {
        try {
          const objectUrl = await fetchPromises.get(src!)
          if (isMounted && objectUrl) setAsyncObjectUrl(objectUrl)
        } catch {
          // fallback to sync src
        }
        return
      }

      const promise = loadImage(src!)
      fetchPromises.set(src!, promise)

      try {
        const objectUrl = await promise
        if (isMounted) {
          setAsyncObjectUrl(objectUrl)
          cacheManager.recordAccess(src!).catch(() => {})
        }
      } catch {
        // fallback to sync src
      } finally {
        fetchPromises.delete(src!)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [src, noCache, cacheTick])

  return { cachedSrc }
}
