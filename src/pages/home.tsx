import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { PlotCard } from "@/components/plot-card"
import { PlotDetailDialog } from "@/components/plot-detail-dialog"
import { getHomePlots, getActiveRoomId } from "@/lib/api"
import { startNewChat } from "@/lib/new-chat"
import type { Plot } from "@/lib/types"

let cachedPlots: Plot[] | null = null
let cachedHasMore = true
let cachedSeenIds = new Set<string>()
let cachedCursor: string | null = null

export function HomePage() {
  const navigate = useNavigate()
  const [plots, setPlots] = useState<Plot[]>(cachedPlots || [])
  const [loading, setLoading] = useState(!cachedPlots)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(cachedHasMore)
  const seenIds = useRef(new Set<string>(cachedSeenIds))
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Plot detail dialog
  const [dialogPlot, setDialogPlot] = useState<Plot | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

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
      const newPlots = (data.plots || []).filter((p: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => !seenIds.current.has(p.id))
      newPlots.forEach((p: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => seenIds.current.add(p.id))
      
      cachedSeenIds = new Set(seenIds.current)
      
      const nextCursor = data.nextCursor || data.cursor || null
      cursorRef.current = nextCursor
      cachedCursor = nextCursor

      if (newPlots.length === 0 && !nextCursor) {
        setHasMore(false)
        cachedHasMore = false
      } else {
        setPlots((prev) => {
          const next = reset ? newPlots : [...prev, ...newPlots]
          cachedPlots = next
          
          const more = !!nextCursor || (newPlots.length > 0 && data.plots?.length >= 20)
          setHasMore(more)
          cachedHasMore = more
          return next
        })
      }
    } catch (e: unknown) {
      toast.error(`読み込み失敗: ${e instanceof Error ? e.message : String(e)}`)
      setHasMore(false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { 
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      ([entry]) => { if (entry.isIntersecting && hasMore && !loadingMore) loadPlots() },
      { rootMargin: "300px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadPlots])

  const handlePlotClick = async (plot: Plot) => {
    try {
      const data = await getActiveRoomId(plot.id)
      if (data.roomId) {
        // Existing room — go directly to chat
        sessionStorage.setItem("chat_plot_name", plot.name || "")
        sessionStorage.setItem("chat_plot_img", plot.imageUrl || "")
        navigate(`/chat/${data.roomId}`)
      } else {
        // No room — show detail dialog
        setDialogPlot(plot)
        setDialogOpen(true)
      }
    } catch {
      // API error (likely no room) — show detail dialog
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
      <header className="flex items-center justify-between px-5 pt-[max(18px,env(safe-area-inset-top))] pb-3">
        <div>
          <h1 className="text-2xl font-bold">おすすめ</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { loadPlots(true); toast.success("更新しました") }}>
          <RefreshCw className="mr-1 size-4" />
          更新
        </Button>
      </header>

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 px-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[3/4] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : plots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p>コンテンツがありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 px-5">
          {plots.map((plot, i) => (
            <div key={plot.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <PlotCard plot={plot} onClick={() => handlePlotClick(plot)} />
            </div>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="flex justify-center py-4">
        {loadingMore && <Spinner className="size-6" />}
        {!hasMore && plots.length > 0 && (
          <p className="text-xs text-muted-foreground">すべて読み込みました</p>
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
