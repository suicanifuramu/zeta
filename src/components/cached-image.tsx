import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { cacheManager } from "@/lib/cache-db"
import { runStartupCleanup, startPeriodicCleanup } from "@/lib/cache-cleanup"
import { memoryCache, fetchPromises } from "@/lib/image-cache"

// Debug flag - set to true to enable detailed logging
const DEBUG = true

function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log("[CachedImage]", ...args)
  }
}

// Global cache promise to prevent Cache API lock contention
let globalCachePromise: Promise<Cache> | null = null
function getPlotImageCache() {
  if (!globalCachePromise) {
    globalCachePromise = caches.open("plot-images")
  }
  return globalCachePromise
}

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string
}

let cleanupInitialized = false

export function CachedImage({ src, alt, className, onError, onLoad, ...props }: CachedImageProps) {
  const [cachedSrc, setCachedSrc] = useState<string | undefined>(src ? (memoryCache.get(src) || src) : undefined)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!cleanupInitialized) {
      cleanupInitialized = true
      runStartupCleanup()
      startPeriodicCleanup()
    }
  }, [])

  useEffect(() => {
    debugLog("Effect triggered", { src })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(false)
    if (!src) {
      debugLog("No src provided")
      return
    }
    if (memoryCache.has(src)) {
      debugLog("Found in memory cache", { src })
      setCachedSrc(memoryCache.get(src))
      cacheManager.recordAccess(src).catch(() => {})
      return
    }

    let isMounted = true

    async function load() {
      debugLog("Starting load", { src })
      if (fetchPromises.has(src!)) {
        debugLog("Found existing fetch promise", { src })
        try {
          const objectUrl = await fetchPromises.get(src!)
          if (isMounted && objectUrl) {
            debugLog("Resolved existing promise", { src, objectUrl })
            setCachedSrc(objectUrl)
          }
        } catch (e) {
          debugLog("Error in existing promise", { src, error: e })
          if (isMounted) setCachedSrc(src)
        }
        return
      }

      const promise = (async () => {
        debugLog("Creating new fetch promise", { src })
        const cache = await getPlotImageCache()
        debugLog("Cache opened", { src })
        let res = await cache.match(src!)
        if (!res) {
          debugLog("Not in cache, fetching", { src })
          res = await fetch(src!)
          debugLog("Fetch response", { src, status: res.status, ok: res.ok })
          if (res.ok) {
            cache.put(src!, res.clone())
            debugLog("Stored in cache", { src })
          }
        }
        if (res.ok) {
          debugLog("Response OK, creating blob", { src })
          const blob = await res.blob()
          const objectUrl = URL.createObjectURL(blob)
          memoryCache.set(src!, objectUrl)
          debugLog("Created object URL", { src, objectUrl })
          return objectUrl
        }
        throw new Error("Failed to load")
      })()

      fetchPromises.set(src!, promise)

      try {
        const objectUrl = await promise
        if (isMounted) {
          debugLog("Promise resolved, setting cachedSrc", { src, objectUrl })
          setCachedSrc(objectUrl)
        }
      } catch (e) {
        // Fallback to normal URL on CORS or network error
        debugLog("Promise failed, falling back to src", { src, error: e })
        if (isMounted) setCachedSrc(src)
      } finally {
        fetchPromises.delete(src!)
      }
    }

    load()

    return () => { isMounted = false }
  }, [src])

  useEffect(() => {
    if (cachedSrc && cachedSrc !== src && src) {
      cacheManager.recordAccess(src).catch(() => {})
    }
  }, [cachedSrc, src])

  if (!cachedSrc) return null

  return (
    <img
      src={cachedSrc}
      alt={alt}
      className={cn("transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", className)}
      onLoad={(e) => {
        debugLog("Image loaded", { src: cachedSrc })
        setLoaded(true)
        if (onLoad) onLoad(e)
      }}
      onError={(e) => {
        debugLog("Image load error", { src: cachedSrc, error: e })
        if (onError) onError(e)
        else (e.target as HTMLImageElement).style.display = "none"
      }}
      {...props}
    />
  )
}