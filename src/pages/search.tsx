import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { PlotCard } from "@/components/plot-card"
import { PlotDetailDialog } from "@/components/plot-detail-dialog"
import { usePlotSearch } from "@/hooks/use-plot-search"
import { useSearchSuggestions } from "@/hooks/use-search-suggestions"
import { usePlotNavigation } from "@/hooks/use-plot-navigation"
import { getGender } from "@/lib/auth"
import type { PlotSearchOrder } from "@/lib/api"
import { cn } from "@/lib/utils"

const MAX_DISPLAY_COUNT = 9999
const ORDER_STORAGE_KEY = "zeta_search_order"

const SORT_OPTIONS: Array<{ value: PlotSearchOrder; label: string }> = [
  { value: "RECOMMENDED", label: "オススメ順" },
  { value: "MALE_RECOMMENDED", label: "男性向けオススメ順" },
  { value: "FEMALE_RECOMMENDED", label: "女性向けオススメ順" },
  { value: "LATEST", label: "作成日(降順)" },
]

function formatTotal(count: number) {
  if (count > MAX_DISPLAY_COUNT) return "9,999+"
  return new Intl.NumberFormat("ja-JP").format(count)
}

function readInitialOrder(): PlotSearchOrder {
  try {
    const saved = localStorage.getItem(ORDER_STORAGE_KEY)
    if (saved && SORT_OPTIONS.some((option) => option.value === saved)) {
      return saved as PlotSearchOrder
    }
  } catch {
    /* storage may be unavailable */
  }
  const gender = getGender()
  if (gender === "MALE") return "MALE_RECOMMENDED"
  if (gender === "FEMALE") return "FEMALE_RECOMMENDED"
  return "RECOMMENDED"
}

const countFormatter = new Intl.NumberFormat("ja-JP")

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const keyword = (params.get("keyword") || "").trim()
  const [input, setInput] = useState(keyword)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [order, setOrder] = useState<PlotSearchOrder>(readInitialOrder)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const navigate = useNavigate()

  const suggestions = useSearchSuggestions(input, suggestionsOpen)

  const { plots, totalCount, loading, loadingMore, hasMore, sentinelRef } =
    usePlotSearch(keyword, order)
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

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  const cancelScheduledClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  // Mobile blurs the input before the tap's click lands — delay the close so
  // tapping a suggestion still selects it.
  const scheduleClose = () => {
    cancelScheduledClose()
    closeTimerRef.current = window.setTimeout(() => {
      setSuggestionsOpen(false)
      closeTimerRef.current = null
    }, 150)
  }

  const runSearch = (value: string) => {
    const q = value.trim()
    if (!q) {
      inputRef.current?.focus()
      return
    }
    cancelScheduledClose()
    setSuggestionsOpen(false)
    setActiveIndex(-1)
    setParams({ keyword: q })
  }

  const selectSuggestion = (value: string) => {
    const tag = `#${value.replace(/^#/, "")}`
    setInput(tag)
    runSearch(tag)
  }

  const changeOrder = (value: PlotSearchOrder) => {
    setOrder(value)
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, value)
    } catch {
      /* storage may be unavailable */
    }
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

  const showSuggestions = suggestionsOpen && suggestions.length > 0

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
              type="text"
              value={input}
              onChange={(e) => {
                cancelScheduledClose()
                setInput(e.target.value)
                setSuggestionsOpen(true)
              }}
              onFocus={() => {
                cancelScheduledClose()
                if (input.trim()) setSuggestionsOpen(true)
              }}
              onBlur={scheduleClose}
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
              inputMode="search"
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
      </header>

      {keyword && (
        <div className="flex items-center justify-between gap-2 px-5 pt-3">
          <span
            className="truncate text-xs text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {totalCount === null
              ? "検索中…"
              : `${formatTotal(totalCount)}件の検索結果`}
          </span>
          <label className="relative flex shrink-0 items-center">
            <span className="sr-only">検索結果の並び替え</span>
            <select
              value={order}
              onChange={(e) => changeOrder(e.target.value as PlotSearchOrder)}
              aria-label="検索結果の並び替え"
              className="appearance-none rounded-md bg-transparent py-1 pr-6 pl-1 text-xs font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-popover text-foreground"
                >
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-1 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </label>
        </div>
      )}

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
                onTagClick={(tag) => runSearch(`#${tag}`)}
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
