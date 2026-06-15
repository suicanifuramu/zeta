import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { PlotCard } from "@/components/plot-card"
import { PlotDetailDialog } from "@/components/plot-detail-dialog"
import { getRanking, getActiveRoomId } from "@/lib/api"
import { startNewChat } from "@/lib/new-chat"
import { preloadImagesAsync } from "@/lib/image-preloader"
import type { Plot } from "@/lib/types"

const TABS = [
  { value: "TRENDING", label: "トレンド" },
  { value: "BEST", label: "ベスト" },
  { value: "NEW", label: "新着" },
] as const

const BATCH_SIZE = 20
const MAX_ITEMS = 100

export function RankingPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState("TRENDING")
  const [allItems, setAllItems] = useState<Plot[]>([])
  const [displayed, setDisplayed] = useState<Plot[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Plot detail dialog
  const [dialogPlot, setDialogPlot] = useState<Plot | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadRanking = useCallback(async (type: string) => {
    setLoading(true)
    setDisplayed([])
    setHasMore(true)
    try {
      const data = await getRanking(type, MAX_ITEMS)
      const items = data.rankings || []
      
      const imageUrls = items
        .map((p: Plot) => p.imageUrl)
        .filter((u: string | undefined): u is string => typeof u === "string")
      if (imageUrls.length > 0) {
        preloadImagesAsync(imageUrls, { concurrency: 6, priority: "low" })
      }
      
      setAllItems(items)
      setDisplayed(items.slice(0, BATCH_SIZE))
      setHasMore(items.length > BATCH_SIZE)
    } catch (e: unknown) {
      toast.error(`読み込み失敗: ${e instanceof Error ? e.message : String(e)}`)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { 
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRanking(tab) 
  }, [tab, loadRanking])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || loading) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore) {
          setDisplayed((prev) => {
            const next = allItems.slice(0, prev.length + BATCH_SIZE)
            if (next.length >= allItems.length) setHasMore(false)
            return next
          })
        }
      },
      { rootMargin: "300px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [allItems, hasMore, loading])

  const handleClick = async (plot: Plot) => {
    try {
      const data = await getActiveRoomId(plot.id)
      if (data.roomId) {
        sessionStorage.setItem("chat_plot_name", plot.name || "")
        sessionStorage.setItem("chat_plot_img", plot.imageUrl || "")
        navigate(`/chat/${data.roomId}`)
      } else {
        // No room — show detail dialog
        setDialogPlot(plot)
        setDialogOpen(true)
      }
    } catch {
      setDialogPlot(plot)
      setDialogOpen(true)
    }
  }

  const handleStartChat = async (plot: Plot) => {
    setDialogOpen(false)
    await startNewChat(plot.id, navigate)
  }

  return (
    <div className="animate-fade-in">
      <header className="px-5 pt-[max(18px,env(safe-area-inset-top))] pb-1">
        <h1 className="text-2xl font-bold">ランキング</h1>
      </header>

      <div className="px-5 py-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="flex-1">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 px-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[3/4] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <p>データがありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 px-5">
          {displayed.map((plot, i) => (
            <div key={plot.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <PlotCard plot={plot} onClick={() => handleClick(plot)} />
            </div>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="flex justify-center py-4">
        {hasMore && !loading && <Spinner className="size-6" />}
        {!hasMore && displayed.length > 0 && (
          <p className="text-xs text-muted-foreground">すべて表示しました</p>
        )}
      </div>

      {/* Plot detail dialog */}
      <PlotDetailDialog
        plot={dialogPlot}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onStartChat={handleStartChat}
      />
    </div>
  )
}
