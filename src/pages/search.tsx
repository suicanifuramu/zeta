import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { PlotCard } from "@/components/plot-card"
import { PlotDetailDialog } from "@/components/plot-detail-dialog"
import { usePlotSearch } from "@/hooks/use-plot-search"
import { useSearchSuggestions } from "@/hooks/use-search-suggestions"
import { usePlotNavigation } from "@/hooks/use-plot-navigation"
import { cn } from "@/lib/utils"

const MAX_DISPLAY_COUNT = 9999

function formatTotal(count: number) {
  if (count > MAX_DISPLAY_COUNT) return "9,999+"
  return new Intl.NumberFormat("ja-JP").format(count)
}

const countFormatter = new Intl.NumberFormat("ja-JP")

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const keyword = (params.get("keyword") || "").trim()
  const [input, setInput] = useState(keyword)
  const [focused, setFocused] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const suggestions = useSearchSuggestions(input, focused)

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

  useEffect(() => {
    setActiveIndex(-1)
  }, [suggestions])

  const runSearch = (value: string) => {
    const q = value.trim()
    if (!q) {
      inputRef.current?.focus()
      return
    }
    setSuggestionsOpen(false)
    setActiveIndex(-1)
    setParams({ keyword: q })
  }

  const selectSuggestion = (value: string) => {
    setInput(value)
    runSearch(value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (suggestions.length === 0) return
      e.preventDefault()
      setSuggestionsOpen(true)
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      if (suggestions.length === 0) return
      e.preventDefault()
      setSuggestionsOpen(true)
      setActiveIndex((i) =>
        i <= 0 ? suggestions.length - 1 : i - 1
      )
    } else if (e.key === "Escape") {
      setSuggestionsOpen(false)
      setActiveIndex(-1)
    } else if (e.key === "Enter") {
      const active = activeIndex >= 0 ? suggestions[activeIndex] : undefined
      if (suggestionsOpen && active) {
        e.preventDefault()
        selectSuggestion(active.hashtag)
      }
    }
  }

  const showSuggestions =
    focused && suggestionsOpen && suggestions.length > 0

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
              onChange={(e) => {
                setInput(e.target.value)
                setSuggestionsOpen(true)
              }}
              onFocus={() => {
                setFocused(true)
                if (input.trim()) setSuggestionsOpen(true)
              }}
              onBlur={() => {
                setFocused(false)
                setSuggestionsOpen(false)
              }}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls="search-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={
                showSuggestions && activeIndex >= 0
                  ? `search-suggestion-${activeIndex}`
                  : undefined
              }
              placeholder="タグ・キーワードで検索…"
              aria-label="検索キーワード"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
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
                  setSuggestionsOpen(false)
                  inputRef.current?.focus()
                }}
                aria-label="入力をクリア"
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}

            {showSuggestions && (
              <ul
                id="search-suggestions"
                role="listbox"
                aria-label="検索候補"
                className="absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover py-1 shadow-lg"
              >
                {suggestions.map((suggestion, i) => (
                  <li
                    key={suggestion.hashtag}
                    id={`search-suggestion-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => selectSuggestion(suggestion.hashtag)}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition-colors",
                      i === activeIndex
                        ? "bg-secondary text-foreground"
                        : "text-foreground/90 hover:bg-secondary/70"
                    )}
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">#</span>
                      {suggestion.hashtag}
                    </span>
                    {suggestion.count != null && (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {countFormatter.format(suggestion.count)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
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
