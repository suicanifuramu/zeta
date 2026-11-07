"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CachedImage } from "@/components/cached-image"
import { optimizeImageUrl } from "@/lib/image-url"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Travel time of one slide.
 *
 * Every slide is *also* backed by a watchdog timer (see `SETTLE_GRACE_MS`).
 * `transitionend` is not guaranteed: a transform that ends up unchanged, a
 * background tab, or a gesture that rewrites the transform mid-flight fires
 * `transitioncancel` (or nothing at all). Trusting the event alone leaves the
 * carousel latched in "transitioning" forever, which is what made rapid
 * swiping kill the viewer.
 */
const SLIDE_MS = 320
const SLIDE_TRANSITION = `transform ${SLIDE_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
const SETTLE_GRACE_MS = 120

const SWIPE_TRIGGER_PX = 56
const DIRECTION_SLOP_PX = 10
const MIN_SCALE = 1
const MAX_SCALE = 4

type Slide = { imageUrl: string; aspectRatio: number }
type Phase = "idle" | "dragging" | "settle" | "snapping"
type Gesture = { id: number; x: number; y: number; mode: "pending" | "h" | "v" }

interface CharacterImageCarouselProps {
  images: Slide[]
  index: number
  onIndexChange?: (index: number) => void
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  )

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  return reduced
}

interface SlideViewProps {
  imageUrl: string
  loaded: boolean
  scale: number
  hidden: boolean
  onLoad: (url: string) => void
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void
  onLostPointerCapture: (event: React.PointerEvent<HTMLDivElement>) => void
  onDoubleClick: () => void
}

/**
 * One picture in the strip. Memoised: dragging re-renders the track on every
 * pointer move, and the pictures must not re-render with it.
 */
const SlideView = memo(function SlideView({
  imageUrl,
  loaded,
  scale,
  hidden,
  onLoad,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onDoubleClick,
}: SlideViewProps) {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      aria-hidden={hidden}
    >
      <div
        className="relative flex h-full w-full touch-none items-center justify-center overflow-hidden select-none"
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
      >
        {!loaded && <Skeleton className="absolute inset-0 h-full w-full" />}
        <CachedImage
          src={optimizeImageUrl(imageUrl, 1024)}
          alt=""
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            transition: "transform 0.1s ease-out",
          }}
          onLoad={() => onLoad(imageUrl)}
        />
      </div>
    </div>
  )
})

export function CharacterImageCarousel({
  images,
  index,
  onIndexChange,
}: CharacterImageCarouselProps) {
  const reducedMotion = usePrefersReducedMotion()

  const total = images.length
  // `displayImages` wraps the real slides in one clone on each side so the
  // gallery can be flipped forever. Clones are jumped over once a slide ends.
  const displayImages = useMemo(
    () => (total > 1 ? [images[total - 1], ...images, images[0]] : images),
    [images, total]
  )
  const displayCount = displayImages.length
  const lastDisplay = Math.max(0, displayCount - 1)

  const realToDisplay = useCallback(
    (real: number) => (total > 1 ? real + 1 : real),
    [total]
  )
  const displayToReal = useCallback(
    (display: number) => {
      if (total <= 1) return 0
      if (display <= 0) return total - 1
      if (display >= displayCount - 1) return 0
      return display - 1
    },
    [total, displayCount]
  )
  const clampReal = useCallback(
    (real: number) => Math.max(0, Math.min(total - 1, real)),
    [total]
  )

  const [track, setTrack] = useState<{ display: number; instant: boolean }>(
    () => ({ display: realToDisplay(clampReal(index)), instant: true })
  )
  const [phase, setPhase] = useState<Phase>("idle")
  const [scale, setScale] = useState(1)
  // Live finger offset. It has to be React state, not a CSS variable: the
  // release must clear it in the *same* style commit that moves the track to
  // the next slide, otherwise the transition starts from the undragged
  // position and the picture travels "finger + one full slide".
  const [dragPx, setDragPx] = useState(0)
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(() => new Set())
  const [syncedImages, setSyncedImages] = useState(images)

  const containerRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const dragOffsetRef = useRef(0)
  const pendingStepsRef = useRef(0)
  const lastEmittedRef = useRef(index)
  const prevIndexRef = useRef(index)

  /**
   * Latest committed values for event handlers and timers. Handlers fire
   * between renders (a transition can end at any moment), so reading state
   * directly would act on a stale slide.
   */
  const latest = useRef({
    track,
    phase,
    total,
    displayCount,
    index,
  })
  latest.current = { track, phase, total, displayCount, index }

  const emitIndex = useCallback(
    (real: number) => {
      if (real === lastEmittedRef.current) return
      lastEmittedRef.current = real
      onIndexChange?.(real)
    },
    [onIndexChange]
  )

  /** Start (or continue) one slide in display space. */
  const startStep = useCallback((direction: number) => {
    const state = latest.current
    if (state.total <= 1) return
    const max = Math.max(0, state.displayCount - 1)
    const base = Math.min(state.track.display, max)
    const next = Math.max(0, Math.min(max, base + direction))
    setScale(1)
    if (next === base) {
      if (state.phase === "settle") setPhase("idle")
      return
    }
    setTrack({ display: next, instant: false })
    setPhase("settle")
  }, [])

  /**
   * Close out the slide that just finished. Safe to call more than once
   * (event + watchdog both land here); the phase guard makes it idempotent.
   */
  const settle = useCallback(() => {
    const state = latest.current
    if (state.phase !== "settle") return

    const max = Math.max(0, state.displayCount - 1)
    const display = Math.min(state.track.display, max)
    const real = displayToReal(display)
    const snapped = realToDisplay(real)
    emitIndex(real)

    if (snapped !== display) {
      // Parked on a wrap clone showing the same picture as `snapped`: move
      // there with transitions off so nothing animates on screen.
      setTrack({ display: snapped, instant: true })
      setPhase("snapping")
      return
    }
    if (pendingStepsRef.current !== 0) {
      const step = Math.sign(pendingStepsRef.current)
      pendingStepsRef.current -= step
      startStep(step)
      return
    }
    setPhase("idle")
  }, [displayToReal, realToDisplay, emitIndex, startStep])

  // Watchdog: whatever happened to `transitionend`, the slide resolves.
  useEffect(() => {
    if (phase !== "settle") return
    const wait = reducedMotion ? 0 : SLIDE_MS + SETTLE_GRACE_MS
    const id = window.setTimeout(settle, wait)
    return () => window.clearTimeout(id)
  }, [phase, track.display, reducedMotion, settle])

  // Let the silent clone jump paint before transitions are re-enabled, then
  // resume whatever input is still queued.
  useEffect(() => {
    if (phase !== "snapping" || !track.instant) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setTrack((current) =>
          current.instant ? { ...current, instant: false } : current
        )
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [phase, track.instant])

  useEffect(() => {
    if (phase !== "snapping" || track.instant) return
    if (pendingStepsRef.current !== 0) {
      const step = Math.sign(pendingStepsRef.current)
      pendingStepsRef.current -= step
      startStep(step)
      return
    }
    setPhase("idle")
  }, [phase, track.instant, startStep])

  // Parent moved the index (thumbnail tap / character switch). Ignore the echo
  // of an index we just reported ourselves.
  useEffect(() => {
    if (prevIndexRef.current === index) return
    prevIndexRef.current = index
    if (index === lastEmittedRef.current) return
    if (latest.current.phase === "dragging") return
    pendingStepsRef.current = 0
    setTrack({ display: realToDisplay(clampReal(index)), instant: false })
    setPhase("settle")
  }, [index, realToDisplay, clampReal])

  // A new set of images re-anchors the whole track (and its skeleton state).
  if (syncedImages !== images) {
    setSyncedImages(images)
    setLoadedUrls(new Set())
    pendingStepsRef.current = 0
    lastEmittedRef.current = index
    setTrack({ display: realToDisplay(clampReal(index)), instant: true })
    setPhase("idle")
  }

  const handleTransitionEnd = useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return
      if (event.propertyName !== "transform") return
      settle()
    },
    [settle]
  )

  const requestStep = useCallback(
    (direction: number) => {
      const state = latest.current
      if (state.phase === "dragging") return
      // Taps that land mid-slide are queued instead of dropped; without this a
      // fast series of taps simply disappeared.
      if (state.phase !== "idle") {
        pendingStepsRef.current += direction
        return
      }
      startStep(direction)
    },
    [startStep]
  )

  const endGesture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.id !== event.pointerId) return
      gestureRef.current = null

      const offset = dragOffsetRef.current
      dragOffsetRef.current = 0
      // Same batch as the step below: the transform React renders goes from
      // `slide + offset` to `next slide + 0` in one commit, so the transition
      // picks up exactly where the finger let go.
      setDragPx(0)

      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      if (latest.current.phase !== "dragging") return

      if (
        cancelled ||
        gesture.mode !== "h" ||
        Math.abs(offset) < SWIPE_TRIGGER_PX
      ) {
        setPhase("idle")
        return
      }
      startStep(offset < 0 ? 1 : -1)
    },
    [startStep]
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return
      const state = latest.current
      if (state.total <= 1) return
      // Catch a moving slide instead of fighting it: finish it, then drag from
      // a known slide.
      pendingStepsRef.current = 0
      if (state.phase === "settle") settle()
      // Drop the "no transition" latch left over from a clone jump so the
      // release below eases normally again.
      setTrack((current) =>
        current.instant ? { ...current, instant: false } : current
      )

      gestureRef.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        mode: "pending",
      }
      dragOffsetRef.current = 0
      setDragPx(0)
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId)
      } catch {
        // Capture is a nicety (it keeps `pointerup` coming when the finger
        // leaves the slide). A browser that refuses must not kill the drag.
      }
      setPhase("dragging")
    },
    [settle]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.id !== event.pointerId) return

      const dx = event.clientX - gesture.x
      const dy = event.clientY - gesture.y

      if (gesture.mode === "pending") {
        if (Math.abs(dy) > Math.abs(dx) + DIRECTION_SLOP_PX) {
          gesture.mode = "v"
          return
        }
        if (Math.abs(dx) <= DIRECTION_SLOP_PX) return
        gesture.mode = "h"
      }
      if (gesture.mode !== "h" || scale > 1) return
      if (dx === dragOffsetRef.current) return

      dragOffsetRef.current = dx
      setDragPx(dx)
    },
    [scale]
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => endGesture(event, false),
    [endGesture]
  )
  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => endGesture(event, true),
    [endGesture]
  )
  const handleLostPointerCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => endGesture(event, true),
    [endGesture]
  )

  const handleDoubleClick = useCallback(() => {
    setScale((current) => (current > MIN_SCALE ? MIN_SCALE : 2))
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        requestStep(-1)
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        requestStep(1)
      }
    },
    [requestStep]
  )

  // Ctrl/⌘ + wheel zoom. React's `onWheel` is passive at the root, so the
  // browser would zoom the whole app instead of the picture.
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      setScale((current) =>
        Math.max(MIN_SCALE, Math.min(MAX_SCALE, current - event.deltaY * 0.01))
      )
    }
    element.addEventListener("wheel", onWheel, { passive: false })
    return () => element.removeEventListener("wheel", onWheel)
  }, [])

  const handleImageLoad = useCallback((url: string) => {
    setLoadedUrls((previous) => {
      if (previous.has(url)) return previous
      const next = new Set(previous)
      next.add(url)
      return next
    })
  }, [])

  if (total === 0) return null

  const displayIndex = Math.min(track.display, lastDisplay)
  const transition =
    track.instant || phase === "dragging" || reducedMotion
      ? "none"
      : SLIDE_TRANSITION
  const slideWidth = 100 / Math.max(1, displayCount)
  const pictureScale = Math.max(MIN_SCALE, scale)

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-black"
      role="group"
      aria-roledescription="carousel"
      aria-label="キャラクター画像"
      tabIndex={0}
      // The mobile sheet is a vaul drawer: without this, a horizontal swipe
      // also drags the sheet.
      data-vaul-no-drag=""
      onKeyDown={handleKeyDown}
    >
      <div
        className="flex h-full"
        style={{
          transform: `translateX(calc(-${displayIndex * slideWidth}% + ${dragPx}px))`,
          width: `${displayCount * 100}%`,
          transition,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {displayImages.map((img, i) => (
          <div key={i} style={{ width: `${slideWidth}%` }}>
            <SlideView
              imageUrl={img.imageUrl}
              loaded={loadedUrls.has(img.imageUrl)}
              scale={pictureScale}
              hidden={i !== displayIndex}
              onLoad={handleImageLoad}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onLostPointerCapture={handleLostPointerCapture}
              onDoubleClick={handleDoubleClick}
            />
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            className="absolute top-1/2 left-4 z-20 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            onClick={() => requestStep(-1)}
            aria-label="前の画像"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="absolute top-1/2 right-4 z-20 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            onClick={() => requestStep(1)}
            aria-label="次の画像"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
