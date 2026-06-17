"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { CachedImage } from "@/components/cached-image"
import { Skeleton } from "@/components/ui/skeleton"

interface CharacterImageCarouselProps {
  images: Array<{ imageUrl: string; aspectRatio: number }>
  initialIndex?: number
  onIndexChange?: (index: number) => void
}

export function CharacterImageCarousel({
  images,
  initialIndex = 0,
  onIndexChange,
}: CharacterImageCarouselProps) {
  const [index, setIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRefs = useRef<(HTMLDivElement | null)[]>([])

  const minScale = 1
  const maxScale = 4

  useEffect(() => {
    if (onIndexChange) onIndexChange(index)
  }, [index, onIndexChange])

  const goToIndex = useCallback((newIndex: number) => {
    setIndex(Math.max(0, Math.min(newIndex, images.length - 1)))
    setScale(1)
  }, [images.length])

  const goToPrev = useCallback(() => {
    if (index > 0) goToIndex(index - 1)
  }, [index, goToIndex])

  const goToNext = useCallback(() => {
    if (index < images.length - 1) goToIndex(index + 1)
  }, [index, images.length, goToIndex])

  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      setScale(1)
    } else {
      setScale(2)
    }
  }, [scale])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setScale((prev) => {
        const delta = -e.deltaY * 0.01
        return Math.max(minScale, Math.min(maxScale, prev + delta))
      })
    }
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    } else if (e.touches.length === 2) {
      setIsDragging(false)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || scale <= 1) return
    if (e.touches.length === 1) {
      e.preventDefault()
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    }
  }, [isDragging])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrev()
    else if (e.key === "ArrowRight") goToNext()
  }, [goToPrev, goToNext])

  const handleImageClick = useCallback(() => {
    if (scale > 1) {
      setScale(1)
    }
  }, [scale])

  if (images.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black"
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(-${index * 100}%)`,
          width: `${images.length * 100}%`,
        }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            ref={(el) => { imageRefs.current[i] = el; }}
            className="w-full h-full flex items-center justify-center"
            style={{ width: `${100 / images.length}%` }}
          >
            <div
              className="w-full h-full flex items-center justify-center touch-none select-none relative"
              onClick={handleImageClick}
              onDoubleClick={handleDoubleClick}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <Skeleton className="absolute inset-0 w-full h-full" />
              <CachedImage
                src={images[i].imageUrl}
                alt=""
                className="max-w-full max-h-full object-contain"
                style={{
                  transform: `scale(${Math.max(1, scale)})`,
                  transformOrigin: "center center",
                  transition: "transform 0.1s ease-out",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            onClick={goToPrev}
            aria-label="Previous image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            onClick={goToNext}
            aria-label="Next image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}