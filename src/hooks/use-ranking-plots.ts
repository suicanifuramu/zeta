import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { getRanking } from "@/lib/api"
import { getGender } from "@/lib/auth"
import { preloadImagesAsync } from "@/lib/image-preloader"
import type { Plot } from "@/lib/types"

const BATCH_SIZE = 20
const MAX_ITEMS = 100

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

        const imageUrls = items
          .map((p: Plot) => p.imageUrl)
          .filter((u: string | undefined): u is string => typeof u === "string")
        if (imageUrls.length > 0) {
          preloadImagesAsync(imageUrls, {
            priority: "low",
            scheduling: "idle",
          })
        }

        setAllItems(items)
        setDisplayed(items.slice(0, BATCH_SIZE))
        setHasMore(items.length > BATCH_SIZE)
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
