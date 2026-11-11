import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useImageCache } from "@/hooks/use-image-cache"
import { invalidateImage } from "@/lib/image-cache"

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string
  noCache?: boolean
}

/** One retry, then give up on this element. */
const MAX_RETRIES = 2

/**
 * Ask for a URL the CDN has not seen before, so a failed response that the
 * browser already cached does not get replayed. The image host ignores the
 * unknown parameter and still applies `w`/`q`/`f`.
 */
function withRetry(src: string | undefined, attempt: number): string | undefined {
  if (!src || attempt === 0) return src
  if (!/^https?:/i.test(src)) return src
  try {
    const url = new URL(src)
    url.searchParams.set("__retry", String(attempt))
    return url.toString()
  } catch {
    return src
  }
}

export function CachedImage({
  src,
  alt,
  className,
  noCache = false,
  onError,
  onLoad,
  ...props
}: CachedImageProps) {
  const { cachedSrc } = useImageCache(src, noCache)
  // Track *which* source finished loading, not just "something loaded".
  // React reuses this component when only `src` changes (carousel slides,
  // thumbnails); a bare boolean stays `true` and keeps the previous picture
  // at full opacity while the new one decodes.
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const retryTimer = useRef<number | null>(null)

  const effectiveSrc = withRetry(cachedSrc, attempt)
  const imgLoaded = effectiveSrc !== undefined && loadedSrc === effectiveSrc

  // A decoded image can finish before React attaches `onLoad` (memory-cache
  // hits, remounts). Without this the <img> stays at opacity 0 forever even
  // though the pixels are ready.
  useEffect(() => {
    const el = imgRef.current
    if (!el || effectiveSrc === undefined || loadedSrc === effectiveSrc) return
    if (el.complete && el.naturalWidth > 0) setLoadedSrc(effectiveSrc)
  }, [effectiveSrc, loadedSrc])

  useEffect(() => {
    return () => {
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current)
    }
  }, [])

  if (!effectiveSrc) return null

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (onError) {
      onError(e)
      return
    }

    if (attempt >= MAX_RETRIES) {
      // Out of retries: hide instead of showing a broken-image glyph.
      e.currentTarget.style.display = "none"
      return
    }

    // Drop the object URL and the Cache API entry, then re-render with a
    // cache-busting URL. This is the only path back from a failed load —
    // before, one failure lasted until the user reloaded the page.
    if (src) void invalidateImage(src).catch(() => {})
    setLoadedSrc(undefined)

    // Give a stalled connection / DNS blip time to clear before re-asking.
    const delay = 600 * (attempt + 1)
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current)
    retryTimer.current = window.setTimeout(() => {
      setAttempt((n) => n + 1)
    }, delay)
  }

  return (
    <img
      ref={imgRef}
      src={effectiveSrc}
      alt={alt}
      className={cn(
        "transition-opacity duration-300",
        imgLoaded ? "opacity-100" : "opacity-0",
        className
      )}
      onLoad={(e) => {
        setLoadedSrc(effectiveSrc)
        onLoad?.(e)
      }}
      onError={handleError}
      {...props}
    />
  )
}
