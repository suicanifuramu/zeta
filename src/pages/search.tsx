import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { PlotCard } from "@/components/plot-card"
import { PlotDetailDialog } from "@/components/plot-detail-dialog"
import { usePlotSearch } from "@/hooks/use-plot-search"
import { usePlotNavigation } from "@/hooks/use-plot-navigation"

const MAX_DISPLAY_COUNT = 9999

function formatTotal(count: number) {
  if (count > MAX_DISPLAY_COUNT) return "9,999+"
  return new Intl.NumberFormat("ja-JP").format(count)
}

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const keyword = (params.get("keyword") || "").trim()
  const [input, setInput] = useState(keyword)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const { plots, totalCount, loading, loadingMore, hasMore, sentinelRef } =
    usePlotSearch(keyword)
  const {
    dialogPlot,
    dialogOpen,
    setDialogOpen,
    handlePlotClick,
    handleStartChat,
  } = usePlotNavigation()

  useEffect(() => {
    setInput(keyword)
  }, [keyword])

  const runSearch = (value: string) => {
    const q = value.trim()
    if (!q) {
      inputRef.current?.focus()
      return
    }
    setParams({ keyword: q })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(input)
  }

  return (
    <div className="animate-fade-in pb-4">
      <header className="glass sticky top-0 z-40 border-b border-border/60 px-3 pt-[max(10px,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => navigate(-1)}
            aria-label="戻る"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <form onSubmit={handleSubmit} role="search" className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={inputRef}
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="タグ・キーワードで検索…"
              aria-label="検索キーワード"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="h-10 w-full rounded-full border border-border bg-secondary/60 pr-9 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              style={{ fontSize: "16px" }}
            />
            {input && (
              <button
                type="button"
                onClick={() => {
                  setInput("")
                  inputRef.current?.focus()
                }}
                aria-label="入力をクリア"
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </form>
        </div>
        {keyword && (
          <div className="flex items-center justify-between gap-2 px-1 pt-2 text-xs text-muted-foreground">
            <span className="truncate">「{keyword}」の検索結果</span>
            <span className="shrink-0 tabular-nums">
              {totalCount === null ? "" : `${formatTotal(totalCount)}件`}
            </span>
          </div>
        )}
      </header>

      {!keyword ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
          <Search className="size-8 opacity-40" aria-hidden />
          <p className="text-sm">タグかキーワードで検索してね</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 px-5 pt-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[3/4] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : plots.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 py-20 text-muted-foreground">
          <p className="text-sm">
            「{keyword}」に一致するプロットはありません
          </p>
          <p className="text-xs">別のタグやキーワードで試してね</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 px-5 pt-3">
          {plots.map((plot, i) => (
            <div
              key={plot.id}
              className="animate-slide-up"
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
            >
              <PlotCard
                plot={plot}
                cached={false}
                onClick={() => handlePlotClick(plot)}
                onTagClick={(tag) => runSearch(tag)}
              />
            </div>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="flex justify-center py-4">
        {loadingMore && <Spinner className="size-6" />}
        {!hasMore && !loading && plots.length > 0 && (
          <p className="text-xs text-muted-foreground">
            すべて読み込みました
          </p>
        )}
      </div>

      <PlotDetailDialog
        plot={dialogPlot}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onStartChat={handleStartChat}
      />
    </div>
  )
}
