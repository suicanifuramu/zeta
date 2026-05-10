import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

// In-memory object URL cache
const memoryCache = new Map<string, string>()

// Deduplicate concurrent fetch requests for the same image
const fetchPromises = new Map<string, Promise<string>>()

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

export function CachedImage({ src, alt, className, onError, onLoad, ...props }: CachedImageProps) {
  const [cachedSrc, setCachedSrc] = useState<string | undefined>(src ? (memoryCache.get(src) || src) : undefined)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(false)
    if (!src) return
    if (memoryCache.has(src)) {
       
      setCachedSrc(memoryCache.get(src))
      return
    }

    let isMounted = true

    async function load() {
      if (fetchPromises.has(src!)) {
        try {
          const objectUrl = await fetchPromises.get(src!)
          if (isMounted && objectUrl) setCachedSrc(objectUrl)
        } catch {
          if (isMounted) setCachedSrc(src)
        }
        return
      }

      const promise = (async () => {
        const cache = await getPlotImageCache()
        let res = await cache.match(src!)
        if (!res) {
          res = await fetch(src!)
          if (res.ok) {
            cache.put(src!, res.clone())
          }
        }
        if (res.ok) {
          const blob = await res.blob()
          const objectUrl = URL.createObjectURL(blob)
          memoryCache.set(src!, objectUrl)
          return objectUrl
        }
        throw new Error("Failed to load")
      })()

      fetchPromises.set(src!, promise)

      try {
        const objectUrl = await promise
        if (isMounted) setCachedSrc(objectUrl)
      } catch {
        // Fallback to normal URL on CORS or network error
        if (isMounted) setCachedSrc(src)
      } finally {
        fetchPromises.delete(src!)
      }
    }

    load()

    return () => { isMounted = false }
  }, [src])

  if (!cachedSrc) return null

  return (
    <img 
      src={cachedSrc} 
      alt={alt} 
      className={cn("transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", className)} 
      onLoad={(e) => {
        setLoaded(true)
        if (onLoad) onLoad(e)
      }}
      onError={(e) => {
        if (onError) onError(e)
        else (e.target as HTMLImageElement).style.display = "none"
      }}
      {...props} 
    />
  )
}
