import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { getRanking } from "@/lib/api"
import { getGender } from "@/lib/auth"
import { preloadImagesAsync } from "@/lib/image-preloader"
import { optimizeImageUrl } from "@/lib/image-url"
import type { Plot } from "@/lib/types"

const BATCH_SIZE = 20
const MAX_ITEMS = 100
/** Warm only the first screenful; the rest loads as the user scrolls. */
const PRELOAD_LIMIT = 12

type RankingGender = "MALE" | "FEMALE"

export interface UseRankingPlotsReturn {
  tab: string
  setTab: (v: string) => void
  gender: RankingGender
  setGender: (v: RankingGender) => void
  displayed: Plot[]
  loading: boolean
  hasMore: boolean
  sentinelRef: React.RefObject<HTMLDivElement | null>
  loadRanking: (type: string) => Promise<void>
}

export function useRankingPlots(): UseRankingPlotsReturn {
  const [tab, setTab] = useState("TRENDING")
  const [gender, setGender] = useState<RankingGender>(() =>
    getGender() === "FEMALE" ? "FEMALE" : "MALE"
  )
  const [allItems, setAllItems] = useState<Plot[]>([])
  const [displayed, setDisplayed] = useState<Plot[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  const loadRanking = useCallback(
    async (type: string) => {
      const requestId = ++requestIdRef.current
      setLoading(true)
      setAllItems([])
      setDisplayed([])
      setHasMore(true)
      try {
        const data = await getRanking(type, MAX_ITEMS, "all", gender)
        if (requestId !== requestIdRef.current) return
        const items = data.rankings || []

        // Preload the same URL the cards request. Preloading the raw
        // `imageUrl` pulled multi-megabyte originals (0.6–5.5 MB each) for up
        // to 100 plots and never shared a cache entry with the thumbnails.
        const imageUrls = items
          .map((p: Plot) => optimizeImageUrl(p.imageUrl, 384))
          .filter((u): u is string => typeof u === "string")
        if (imageUrls.length > 0) {
          preloadImagesAsync(imageUrls.slice(0, PRELOAD_LIMIT), {
            priority: "low",
            scheduling: "idle",
          })
        }

        // Match the official app: the badge is the row position, not the
        // server rank. Server ranks skip numbers when plots get hidden.
        // rankDiff stays the server value (it is relative to the server rank).
        const ranked = items.map((p, i) => ({
          ...p,
          rank: i + 1,
        }))

        setAllItems(ranked)
        setDisplayed(ranked.slice(0, BATCH_SIZE))
        setHasMore(ranked.length > BATCH_SIZE)
      } catch (e: unknown) {
        if (requestId !== requestIdRef.current) return
        toast.error(
          `読み込み失敗: ${e instanceof Error ? e.message : String(e)}`
        )
        setHasMore(false)
      } finally {
        if (requestId === requestIdRef.current) setLoading(false)
      }
    },
    [gender]
  )

  useEffect(() => {
    loadRanking(tab)
    return () => {
      requestIdRef.current += 1
    }
  }, [tab, loadRanking])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || loading) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore) {
          setDisplayed((prev) => {
            const next = allItems.slice(0, prev.length + BATCH_SIZE)
            return next
          })
        }
      },
      { rootMargin: "300px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [allItems, hasMore, loading])

  // Sync hasMore when displayed reaches the end
  useEffect(() => {
    if (displayed.length >= allItems.length && allItems.length > 0) {
      setHasMore(false)
    }
  }, [displayed, allItems])

  return {
    tab,
    setTab,
    gender,
    setGender,
    displayed,
    loading,
    hasMore,
    sentinelRef,
    loadRanking,
  }
}
