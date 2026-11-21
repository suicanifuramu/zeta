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
  // A reset bumps the generation; responses from an older generation are dropped
  // so they cannot append into the freshly reset list or move the cursor.
  const generationRef = useRef(0)
  const inFlightRef = useRef(false)

  const loadPlots = useCallback(async (reset = false) => {
    // Load-more is skipped while any request is running. A reset always proceeds.
    if (!reset && inFlightRef.current) return
    if (reset) {
      generationRef.current += 1
      seenIds.current.clear()
      setPlots([])
      setLoading(true)
      setLoadingMore(false)
      setHasMore(true)
      cursorRef.current = null
    } else {
      setLoadingMore(true)
    }
    const generation = generationRef.current
    inFlightRef.current = true
    try {
      const data = await getHomePlots(20, cursorRef.current || undefined)
      if (generation !== generationRef.current) return
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
      if (generation !== generationRef.current) return
      toast.error(`読み込み失敗: ${e instanceof Error ? e.message : String(e)}`)
      setHasMore(false)
    } finally {
      if (generation === generationRef.current) {
        inFlightRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [])

  // Sync module-level cache when plots change.
  // Only store a non-empty result: this effect runs before the mount effect
  // below, so writing the initial `[]` made `cachedPlots` truthy and the
  // `if (!cachedPlots) loadPlots(true)` guard skipped the very first request —
  // the home page sat on skeletons until the sentinel or the refresh button
  // fired.
  useEffect(() => {
    if (plots.length > 0) cachedPlots = plots
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
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          loadPlots()
        }
      },
      { rootMargin: "300px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, loadPlots])

  return {
    plots,
    loading,
    loadingMore,
    hasMore,
    sentinelRef,
    loadPlots,
  }
}
