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
  const transitionRef = useRef(false)
  const touchState = useRef<{
    startX: number
    startY: number
    isSwiping: boolean
    isPanning: boolean
  } | null>(null)

  const minScale = 1
  const maxScale = 4

  const total = images.length
  const displayImages = total > 1
    ? [images[total - 1], ...images, images[0]]
    : images

  const displayCount = displayImages.length

  const realToDisplay = (realIdx: number) => realIdx + 1
  const displayToReal = (displayIdx: number) => {
    if (displayIdx === 0) return total - 1
    if (displayIdx === displayCount - 1) return 0
    return displayIdx - 1
  }

  const [displayIndex, setDisplayIndex] = useState(() => realToDisplay(index))
  const displayIndexRef = useRef(displayIndex)
  displayIndexRef.current = displayIndex

  useEffect(() => {
    setLoadedImages(new Set())
  }, [images])

  useEffect(() => {
    if (!transitionRef.current) {
      setDisplayIndex(realToDisplay(index))
    }
  }, [index])

  const handleTransitionEnd = useCallback(() => {
    if (!transitionRef.current) return
    transitionRef.current = false
    const di = displayIndexRef.current
    const real = displayToReal(di)
    if (di === 0 || di === displayCount - 1) {
      setDisplayIndex(realToDisplay(real))
      onIndexChange?.(real)
    }
  }, [displayCount, onIndexChange])

  const snapToReal = useCallback((realIdx: number) => {
    transitionRef.current = false
    setDisplayIndex(realToDisplay(realIdx))
    onIndexChange?.(realIdx)
    setScale(1)
  }, [onIndexChange])

  const goToIndex = useCallback((newIndex: number) => {
    const clamped = Math.max(0, Math.min(newIndex, total - 1))
    snapToReal(clamped)
  }, [total, snapToReal])

  const goToPrev = useCallback(() => {
    if (transitionRef.current) return
    if (displayIndexRef.current <= 0) return
    transitionRef.current = true
    setDisplayIndex((prev) => prev - 1)
    setScale(1)
  }, [])

  const goToNext = useCallback(() => {
    if (transitionRef.current) return
    if (displayIndexRef.current >= displayCount - 1) return
    transitionRef.current = true
    setDisplayIndex((prev) => prev + 1)
    setScale(1)
  }, [displayCount])

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
        el.style.transform = `translateX(calc(-${displayIndexRef.current * 100 / displayCount}% + ${offset}px))`
      }
    }

    if (s.isPanning && scale > 1) {
      e.preventDefault()
    }
  }, [scale, displayCount])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const s = touchState.current
    if (!s) return

    if (s.isSwiping && scale <= 1) {
      const el = containerRef.current?.firstElementChild as HTMLElement | null
      const diffX = e.changedTouches[0].clientX - s.startX
      const di = displayIndexRef.current

      if (Math.abs(diffX) > 60) {
        if (diffX > 0) {
          if (di > 0) {
            if (el) {
              el.style.transition = 'transform 0.3s ease-out'
              el.style.transform = `translateX(-${(di - 1) * 100 / displayCount}%)`
            }
            goToPrev()
          }
        } else {
          if (di < displayCount - 1) {
            if (el) {
              el.style.transition = 'transform 0.3s ease-out'
              el.style.transform = `translateX(-${(di + 1) * 100 / displayCount}%)`
            }
            goToNext()
          }
        }
      } else {
        if (el) {
          el.style.transition = 'transform 0.3s ease-out'
          el.style.transform = `translateX(-${di * 100 / displayCount}%)`
        }
      }
    }

    touchState.current = null
  }, [scale, displayCount, goToPrev, goToNext])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrev()
    else if (e.key === "ArrowRight") goToNext()
  }, [goToPrev, goToNext])

  if (total === 0) return null

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black"
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        className="flex h-full"
        style={{
          transform: `translateX(-${displayIndex * 100 / displayCount}%)`,
          width: `${displayCount * 100}%`,
          transition: transitionRef.current ? 'transform 0.3s ease-out' : 'none',
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {displayImages.map((img, i) => {
          const realIndex = i === 0 ? total - 1 : i === displayCount - 1 ? 0 : i - 1
          return (
            <div
              key={i}
              className="w-full h-full flex items-center justify-center"
              style={{ width: `${100 / displayCount}%` }}
            >
              <div
                className="w-full h-full flex items-center justify-center touch-none select-none relative"
                onDoubleClick={handleDoubleClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {!loadedImages.has(realIndex) && <Skeleton className="absolute inset-0 w-full h-full" />}
                <CachedImage
                  src={img.imageUrl}
                  alt=""
                  className="max-w-full max-h-full object-contain"
                  style={{
                    transform: `scale(${Math.max(1, scale)})`,
                    transformOrigin: "center center",
                    transition: "transform 0.1s ease-out",
                  }}
                  onLoad={() => handleImageLoad(realIndex)}
                />
              </div>
            </div>
          )
        })}
      </div>

      {total > 1 && (
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
