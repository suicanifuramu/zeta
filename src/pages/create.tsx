import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { PenLine, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createCreatorPlot, listCreatorPlots } from "@/lib/api"
import type { CreatorPlot } from "@/lib/types"
import { errorMessage, formatDateTime } from "@/lib/creator-util"

/**
 * Three lists, as in the official app:
 * - draft: PRERELEASE (any privacy)
 * - public: RELEASE, isPrivate=false
 * - private: RELEASE, isPrivate=true
 * `isPrivate` filters both statuses (LIVE: verified for PRERELEASE and RELEASE).
 */
type ListTab = "draft" | "public" | "private"

const TABS: readonly ListTab[] = ["draft", "public", "private"]

const QUERY_BY_TAB: Record<
  ListTab,
  { status: "PRERELEASE" | "RELEASE"; isPrivate?: boolean }
> = {
  draft: { status: "PRERELEASE" },
  public: { status: "RELEASE", isPrivate: false },
  private: { status: "RELEASE", isPrivate: true },
}

const LABEL_BY_TAB: Record<ListTab, string> = {
  draft: "作成中",
  public: "公開中",
  private: "非公開",
}

function isListTab(value: string | null): value is ListTab {
  return value !== null && (TABS as readonly string[]).includes(value)
}

function badgeLabel(plot: CreatorPlot): string {
  if (plot.status !== "RELEASE") return "作成中"
  return plot.isPrivate ? "非公開" : "公開中"
}

export function CreatePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get("tab")
  const tab: ListTab = isListTab(requested) ? requested : "draft"

  const [items, setItems] = useState<CreatorPlot[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [creating, setCreating] = useState(false)
  // Bumped on every tab change so that a late page from the previous tab is ignored.
  const generationRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setItems([])
    setCursor(null)
    listCreatorPlots(QUERY_BY_TAB[tab])
      .then((page) => {
        if (cancelled) return
        setItems(page.plots)
        setCursor(page.nextCursor ?? null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, attempt])

  const loadMore = useCallback(async () => {
    if (!cursor) return
    const generation = generationRef.current
    setLoading(true)
    try {
      const page = await listCreatorPlots({ ...QUERY_BY_TAB[tab], cursor })
      if (generation !== generationRef.current) return
      setItems((prev) => [...prev, ...page.plots])
      setCursor(page.nextCursor ?? null)
    } catch (e: unknown) {
      toast.error(`読み込みに失敗しました: ${errorMessage(e)}`)
    } finally {
      setLoading(false)
    }
  }, [cursor, tab])

  function selectTab(next: string) {
    if (!isListTab(next) || next === tab) return
    generationRef.current += 1
    setSearchParams(next === "draft" ? {} : { tab: next }, { replace: true })
  }

  async function createNew() {
    setCreating(true)
    try {
      const plot = await createCreatorPlot()
      navigate(`/create/plots/${plot.id}`)
    } catch (e: unknown) {
      toast.error(`作成できませんでした: ${errorMessage(e)}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 pt-6 pb-6 md:max-w-2xl md:px-6 md:pt-10 md:pb-12">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold md:text-2xl">
          <PenLine className="size-5 text-primary" aria-hidden="true" />
          作成
        </h1>
        <Button
          type="button"
          className="min-h-11 cursor-pointer"
          disabled={creating}
          onClick={() => void createNew()}
        >
          <Plus aria-hidden="true" />
          {creating ? "作成しています…" : "新規作成"}
        </Button>
      </header>

      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList className="grid w-full grid-cols-3 group-data-horizontal/tabs:h-auto">
          <TabsTrigger value="draft" className="min-h-11 cursor-pointer px-1 text-xs sm:text-sm">
            作成中
          </TabsTrigger>
          <TabsTrigger value="public" className="min-h-11 cursor-pointer px-1 text-xs sm:text-sm">
            公開中
          </TabsTrigger>
          <TabsTrigger value="private" className="min-h-11 cursor-pointer px-1 text-xs sm:text-sm">
            非公開
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <div role="alert" className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm text-destructive">読み込みに失敗しました（{error}）</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 cursor-pointer"
            onClick={() => setAttempt((n) => n + 1)}
          >
            再読み込み
          </Button>
        </div>
      )}

      {loading && items.length === 0 && (
        <div
          className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0"
          aria-busy="true"
          aria-live="polite"
        >
          {/* Same size and shape as a card (64 px image + 12 px padding + 1 px border on each side).
              Two placeholders on mobile; from md the list is a two-column grid, so four fit a full row pair. */}
          <Skeleton className="h-[90px] w-full rounded-xl" />
          <Skeleton className="h-[90px] w-full rounded-xl" />
          <Skeleton className="hidden h-[90px] w-full rounded-xl md:block" />
          <Skeleton className="hidden h-[90px] w-full rounded-xl md:block" />
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-6 text-center md:p-8">
          <p className="text-sm text-muted-foreground">
            {`${LABEL_BY_TAB[tab]}のプロットはありません。`}
          </p>
          {tab === "draft" && (
            <Button
              type="button"
              className="min-h-11 cursor-pointer"
              onClick={() => void createNew()}
              disabled={creating}
            >
              新規作成
            </Button>
          )}
        </div>
      )}

      {items.length > 0 && (
        <ul
          className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0"
          role="list"
          aria-label={`${LABEL_BY_TAB[tab]}のプロット`}
        >
          {items.map((plot) => {
            const draftName = typeof plot.draft?.name === "string" ? plot.draft.name : ""
            const name = (plot.name ?? draftName).trim()
            return (
              <li key={plot.id} className="min-w-0">
                <Link
                  to={`/create/plots/${plot.id}`}
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted md:h-full"
                >
                  <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {plot.imageUrl && (
                      <img
                        src={plot.imageUrl}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium">{name || "（無題）"}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={plot.status === "RELEASE" ? "default" : "secondary"}>
                        {badgeLabel(plot)}
                      </Badge>
                      {plot.reviewState === "REVIEWING" && <Badge variant="outline">審査中</Badge>}
                      {plot.reviewState === "REJECTED" && (
                        <Badge variant="destructive">審査却下</Badge>
                      )}
                      {plot.status === "RELEASE" && plot.hasUnpublishedChanges === true && (
                        <span>未公開の変更があります</span>
                      )}
                      {typeof plot.updatedAt === "string" && plot.updatedAt && (
                        <span className="tabular-nums">{formatDateTime(plot.updatedAt)}</span>
                      )}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {cursor && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full cursor-pointer md:w-auto md:min-w-48"
            disabled={loading}
            onClick={() => void loadMore()}
          >
            {loading ? "読み込み中…" : "もっと見る"}
          </Button>
        </div>
      )}
    </div>
  )
}
