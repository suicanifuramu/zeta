const ZETA_IMAGE_HOST = "image.zeta-ai.io"

/**
 * Ask the Zeta image CDN for a resized WebP.
 *
 * Plot covers are stored as multi-megabyte PNGs; the CDN honours
 * `?w=<width>&q=<quality>&f=webp` and returns a thumbnail ~100x smaller.
 * Unknown hosts and malformed URLs are returned unchanged.
 */
export function optimizeImageUrl(
  src: string | undefined,
  width: number,
  quality = 75
): string | undefined {
  if (!src) return undefined
  try {
    const url = new URL(src)
    if (url.hostname !== ZETA_IMAGE_HOST) return src
    if (!url.searchParams.has("w")) url.searchParams.set("w", String(width))
    if (!url.searchParams.has("q")) url.searchParams.set("q", String(quality))
    if (!url.searchParams.has("f")) url.searchParams.set("f", "webp")
    return url.toString()
  } catch {
    return src
  }
}
