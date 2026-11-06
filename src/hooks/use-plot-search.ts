import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { getPlotSearchCount, searchPlots } from "@/lib/api"
import type { Plot } from "@/lib/types"

const PAGE_SIZE = 18

export interface UsePlotSearchReturn {
  plots: Plot[]
  totalCount: number | null
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  sentinelRef: React.RefObject<HTMLDivElement | null>
  retry: () => void
}

/**
 * Cursor-paginated plot search against `/v2/plots/search`.
 * Resets automatically when the keyword changes.
 */
export function usePlotSearch(keyword: string): UsePlotSearchReturn {
  const [plots, setPlots] = useState<Plot[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(() => keyword.trim().length > 0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<string | null>(null)
  const seenRef = useRef<Set<string>>(new Set())
  const requestIdRef = useRef(0)
  const inFlightRef = useRef(false)

  const loadPage = useCallback(
    async (reset: boolean) => {
      const q = keyword.trim()
      if (!q) return
      if (!reset && inFlightRef.current) return

      const requestId = ++requestIdRef.current
      inFlightRef.current = true

      if (reset) {
        cursorRef.current = null
        seenRef.current = new Set()
        setLoading(true)
        setHasMore(false)
      } else {
        setLoadingMore(true)
      }

      try {
        const data = await searchPlots(q, {
          limit: PAGE_SIZE,
          cursor: reset ? undefined : cursorRef.current || undefined,
        })
        if (requestId !== requestIdRef.current) return

        const incoming = (data.items || [])
          .map((item) => item?.plot)
          .filter((plot): plot is Plot => Boolean(plot?.id))
          .map((plot) =>
            plot.imageUrl || !plot.coverImageUrl
              ? plot
              : { ...plot, imageUrl: plot.coverImageUrl }
          )
        const fresh = incoming.filter((plot) => !seenRef.current.has(plot.id))
        fresh.forEach((plot) => seenRef.current.add(plot.id))

        cursorRef.current = data.nextCursor || null
        setPlots((prev) => (reset ? fresh : [...prev, ...fresh]))
        setHasMore(Boolean(data.nextCursor))
      } catch (e: unknown) {
        if (requestId === requestIdRef.current) {
          toast.error(
            `検索失敗: ${e instanceof Error ? e.message : String(e)}`
          )
          setHasMore(false)
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
          setLoadingMore(false)
        }
        inFlightRef.current = false
      }
    },
    [keyword]
  )

  // Reset + first page whenever the keyword changes
  useEffect(() => {
    const q = keyword.trim()
    requestIdRef.current += 1
    cursorRef.current = null
    seenRef.current = new Set()
    setPlots([])
    setTotalCount(null)
    setHasMore(false)
    setLoadingMore(false)

    if (!q) {
      setLoading(false)
      return
    }

    loadPage(true)
    let cancelled = false
    getPlotSearchCount(q)
      .then((count) => {
        if (!cancelled) setTotalCount(count)
      })
      .catch(() => {
        /* count is decorative — ignore failures */
      })
    return () => {
      cancelled = true
      requestIdRef.current += 1
    }
  }, [keyword, loadPage])

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          loadPage(false)
        }
      },
      { rootMargin: "300px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, loadPage])

  const retry = useCallback(() => {
    loadPage(true)
  }, [loadPage])

  return {
    plots,
    totalCount,
    loading,
    loadingMore,
    hasMore,
    sentinelRef,
    retry,
  }
}
