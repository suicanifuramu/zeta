import { useVirtualizer } from "@tanstack/react-virtual"
import { useRef } from "react"

interface UseMessageVirtualizerOptions {
  count: number
  estimateSize?: number
  overscan?: number
  scrollMargin?: number
  scrollRef?: React.RefObject<HTMLDivElement | null>
}

export function useMessageVirtualizer({
  count,
  estimateSize = 120,
  overscan = 5,
  scrollMargin = 0,
  scrollRef,
}: UseMessageVirtualizerOptions) {
  const virtualizerRef = useRef<HTMLDivElement>(null)

  // Use provided scrollRef or fall back to virtualizerRef
  const scrollElementRef = scrollRef ?? virtualizerRef

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    count,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin,
  })

  return { virtualizerRef, virtualizer }
}