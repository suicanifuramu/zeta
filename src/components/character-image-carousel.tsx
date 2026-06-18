"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { CachedImage } from "@/components/cached-image"
import { Skeleton } from "@/components/ui/skeleton"

interface CharacterImageCarouselProps {
  images: Array<{ imageUrl: string; aspectRatio: number }>
  index: number
  onIndexChange?: (index: number) => void
}

export function CharacterImageCarousel({
  images,
  index,
  onIndexChange,
}: CharacterImageCarouselProps) {
  const [scale, setScale] = useState(1)
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  const touchState = useRef<{
    startX: number
    startY: number
    isSwiping: boolean
    isPanning: boolean
  } | null>(null)

  const minScale = 1
  const maxScale = 4

  useEffect(() => {
    setLoadedImages(new Set())
  }, [images])

  const handleImageLoad = useCallback((i: number) => {
    setLoadedImages((prev) => {
      if (prev.has(i)) return prev
      const next = new Set(prev)
      next.add(i)
      return next
    })
  }, [])

  const goToIndex = useCallback((newIndex: number) => {
    const clamped = Math.max(0, Math.min(newIndex, images.length - 1))
    console.log("[Carousel] goToIndex", { newIndex, clamped, imagesLength: images.length, indexProp: index })
    onIndexChange?.(clamped)
    setScale(1)
  }, [images.length, onIndexChange, index])

  const goToPrev = useCallback(() => {
    const prev = index <= 0 ? images.length - 1 : index - 1
    console.log("[Carousel] goToPrev", { currentIndex: index, imagesLength: images.length, prev })
    goToIndex(prev)
  }, [index, images.length, goToIndex])

  const goToNext = useCallback(() => {
    const next = index >= images.length - 1 ? 0 : index + 1
    console.log("[Carousel] goToNext", { currentIndex: index, imagesLength: images.length, next })
    goToIndex(next)
  }, [index, images.length, goToIndex])

  const handleDoubleClick = useCallback(() => {
    setScale((prev) => (prev > 1 ? 1 : 2))
  }, [])

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
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    touchState.current = {
      startX: t.clientX,
      startY: t.clientY,
      isSwiping: false,
      isPanning: false,
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const s = touchState.current
    if (!s || e.touches.length !== 1) return

    const t = e.touches[0]
    const diffX = t.clientX - s.startX
    const diffY = t.clientY - s.startY

    if (!s.isSwiping && !s.isPanning) {
      if (Math.abs(diffY) > Math.abs(diffX) + 10) {
        s.isPanning = true
        return
      }
      if (Math.abs(diffX) > 10) {
        s.isSwiping = true
      }
    }

    if (s.isSwiping && scale <= 1) {
      e.preventDefault()
      const el = containerRef.current?.firstElementChild as HTMLElement | null
      if (el) {
        const offset = t.clientX - s.startX
        el.style.transition = 'none'
        el.style.transform = `translateX(calc(-${index * 100 / images.length}% + ${offset}px))`
      }
    }

    if (s.isPanning && scale > 1) {
      e.preventDefault()
    }
  }, [index, scale, images.length])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const s = touchState.current
    if (!s) return

    if (s.isSwiping && scale <= 1) {
      const el = containerRef.current?.firstElementChild as HTMLElement | null
      const diffX = e.changedTouches[0].clientX - s.startX

      console.log("[Carousel] touchEnd swipe", { diffX, currentIndex: index, imagesLength: images.length, threshold: Math.abs(diffX) > 60 })

      if (Math.abs(diffX) > 60) {
        let target = diffX > 0 ? index - 1 : index + 1
        if (target < 0) target = images.length - 1
        if (target >= images.length) target = 0
        console.log("[Carousel] touchEnd target", { target, fromIndex: index })
        if (el) {
          el.style.transition = 'transform 0.3s ease-out'
          el.style.transform = `translateX(-${target * 100 / images.length}%)`
        }
        if (target !== index) {
          goToIndex(target)
        }
      } else {
        if (el) {
          el.style.transition = 'transform 0.3s ease-out'
          el.style.transform = `translateX(-${index * 100 / images.length}%)`
        }
      }
    }

    touchState.current = null
  }, [scale, index, images.length, goToIndex])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrev()
    else if (e.key === "ArrowRight") goToNext()
  }, [goToPrev, goToNext])

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
          transform: `translateX(-${index * 100 / images.length}%)`,
          width: `${images.length * 100}%`,
        }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            className="w-full h-full flex items-center justify-center"
            style={{ width: `${100 / images.length}%` }}
          >
            <div
              className="w-full h-full flex items-center justify-center touch-none select-none relative"
              onDoubleClick={handleDoubleClick}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {!loadedImages.has(i) && <Skeleton className="absolute inset-0 w-full h-full" />}
              <CachedImage
                src={images[i].imageUrl}
                alt=""
                className="max-w-full max-h-full object-contain"
                style={{
                  transform: `scale(${Math.max(1, scale)})`,
                  transformOrigin: "center center",
                  transition: "transform 0.1s ease-out",
                }}
                onLoad={() => handleImageLoad(i)}
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
