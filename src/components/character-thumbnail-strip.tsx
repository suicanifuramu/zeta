"use client"

import { CachedImage } from "@/components/cached-image"
import { cn } from "@/lib/utils"

interface CharacterThumbnailStripProps {
  images: Array<{ imageUrl: string; aspectRatio: number }>
  currentIndex: number
  onSelect: (index: number) => void
}

export function CharacterThumbnailStrip({
  images,
  currentIndex,
  onSelect,
}: CharacterThumbnailStripProps) {
  if (images.length <= 1) return null

  return (
    <div className="px-4 py-3">
      <div className="flex flex-row gap-1.5 pb-2 pt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "relative flex flex-col items-center justify-center overflow-hidden rounded-6 bg-background transition-all duration-100 ease-out",
              i === currentIndex
                ? "ring-2 ring-primary"
                : "ring-1 ring-transparent opacity-70 hover:opacity-100"
            )}
            style={{ height: 56, width: 56, flexShrink: 0 }}
            aria-label={`キャラクター画像 ${i + 1}/${images.length}`}
            aria-current={i === currentIndex ? "true" : "false"}
          >
            <CachedImage
              src={images[i].imageUrl}
              alt={`Thumbnail ${i + 1}`}
              className="aspect-square object-cover w-full h-full"
            />
            {i === currentIndex && (
              <div className="absolute inset-0 ring-2 ring-primary rounded-6 pointer-events-none" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
