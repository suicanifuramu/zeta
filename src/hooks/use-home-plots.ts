import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { getHomePlots } from "@/lib/api"
import type { Plot } from "@/lib/types"

let cachedPlots: Plot[] | null = null
let cachedHasMore = true
let cachedSeenIds = new Set<string>()
let cachedCursor: string | null = null

export interface UseHomePlotsReturn {
  plots: Plot[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  sentinelRef: React.RefObject<HTMLDivElement | null>
  loadPlots: (reset?: boolean) => Promise<void>
}

export function useHomePlots(): UseHomePlotsReturn {
  const [plots, setPlots] = useState<Plot[]>(cachedPlots || [])
  const [loading, setLoading] = useState(!cachedPlots)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(cachedHasMore)
  const seenIds = useRef(new Set<string>(cachedSeenIds))
  const sentinelRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<string | null>(cachedCursor)

  const loadPlots = useCallback(async (reset = false) => {
    if (reset) {
      seenIds.current.clear()
      setPlots([])
      setLoading(true)
      setHasMore(true)
      cursorRef.current = null
    } else {
      setLoadingMore(true)
    }
    try {
      const data = await getHomePlots(20, cursorRef.current || undefined)
      const newPlots = (data.plots || []).filter(
        (p: Plot) => !seenIds.current.has(p.id)
      )
      newPlots.forEach((p: Plot) => seenIds.current.add(p.id))

      cachedSeenIds = new Set(seenIds.current)

      const nextCursor = data.nextCursor || data.cursor || null
      cursorRef.current = nextCursor
      cachedCursor = nextCursor

      if (newPlots.length === 0 && !nextCursor) {
        setHasMore(false)
        cachedHasMore = false
      } else {
        setPlots((prev) => (reset ? newPlots : [...prev, ...newPlots]))
        const more =
          !!nextCursor || (newPlots.length > 0 && (data.plots?.length ?? 0) >= 20)
        setHasMore(more)
        cachedHasMore = more
      }
    } catch (e: unknown) {
      toast.error(`読み込み失敗: ${e instanceof Error ? e.message : String(e)}`)
      setHasMore(false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Sync module-level cache when plots change
  useEffect(() => {
    cachedPlots = plots
  }, [plots])

  useEffect(() => {
    if (!cachedPlots) loadPlots(true)
  }, [loadPlots])

  useEffect(() => {
    const handleRefresh = () => {
      window.scrollTo(0, 0)
      loadPlots(true)
    }
    window.addEventListener("refreshHome", handleRefresh)
    return () => window.removeEventListener("refreshHome", handleRefresh)
  }, [loadPlots])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) loadPlots()
      },
      { rootMargin: "300px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadPlots])

  return {
    plots,
    loading,
    loadingMore,
    hasMore,
    sentinelRef,
    loadPlots,
  }
}
