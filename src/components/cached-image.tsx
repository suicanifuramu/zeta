import { useState } from "react"
import { cn } from "@/lib/utils"
import { useImageCache } from "@/hooks/use-image-cache"

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string
  noCache?: boolean
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
  const imgLoaded = src !== undefined && loadedSrc === src

  if (!cachedSrc) return null

  return (
    <img
      src={cachedSrc}
      alt={alt}
      className={cn(
        "transition-opacity duration-300",
        imgLoaded ? "opacity-100" : "opacity-0",
        className
      )}
      onLoad={(e) => {
        setLoadedSrc(src)
        onLoad?.(e)
      }}
      onError={(e) => {
        if (onError) onError(e)
        else (e.target as HTMLImageElement).style.display = "none"
      }}
      {...props}
    />
  )
}
