import { useVirtualizer } from "@tanstack/react-virtual"
import { useRef } from "react"

interface UseMessageVirtualizerOptions {
  count: number
  estimateSize?: number
  overscan?: number
  scrollMargin?: number
}

export function useMessageVirtualizer({
  count,
  estimateSize = 120,
  overscan = 5,
  scrollMargin = 0,
}: UseMessageVirtualizerOptions) {
  const virtualizerRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    count,
    getScrollElement: () => virtualizerRef.current,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin,
  })

  return { virtualizerRef, virtualizer }
}