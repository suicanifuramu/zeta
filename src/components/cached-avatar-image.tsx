import { useState } from "react"
import { AvatarImage } from "@/components/ui/avatar"
import { useImageCache } from "@/hooks/use-image-cache"
import { optimizeImageUrl } from "@/lib/image-url"

interface CachedAvatarImageProps {
  src?: string
  alt?: string
  noCache?: boolean
  className?: string
  /** Requested CDN width in CSS pixels (default 96). */
  width?: number
}

export function CachedAvatarImage({
  src,
  alt,
  noCache = false,
  className,
  width = 96,
}: CachedAvatarImageProps) {
  const optimizedSrc = optimizeImageUrl(src, width)
  const { cachedSrc } = useImageCache(optimizedSrc, noCache)
  const [errored, setErrored] = useState(false)

  if (!cachedSrc || errored) return null

  return (
    <AvatarImage
      src={cachedSrc}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
    />
  )
}
