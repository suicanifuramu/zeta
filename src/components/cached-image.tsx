import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

// In-memory object URL cache
const memoryCache = new Map<string, string>()

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string
}

export function CachedImage({ src, alt, className, onError, onLoad, ...props }: CachedImageProps) {
  const [cachedSrc, setCachedSrc] = useState<string | undefined>(src ? (memoryCache.get(src) || src) : undefined)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    if (!src) return
    if (memoryCache.has(src)) {
      setCachedSrc(memoryCache.get(src))
      return
    }

    let isMounted = true

    async function load() {
      try {
        const cache = await caches.open("plot-images")
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
          if (isMounted) setCachedSrc(objectUrl)
        }
      } catch (e) {
        // Fallback to normal URL on CORS or network error
        if (isMounted) setCachedSrc(src)
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
