import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { RecommendCard } from "./recommend-card"
import type { CyoaChoice, RecommendQuotaResponse } from "@/lib/types"

const REC_PER_PAGE = 3

interface RecommendPanelProps {
  recVisible: boolean
  recItems: Array<{ text?: string; content?: string; message?: string }>
  recPage: number
  recLoading: boolean
  recQuota: RecommendQuotaResponse | null
  /** Per-message CYOA choices (newest turn only). Rendered as page 1. */
  cyoaChoices: CyoaChoice[]
  onPageChange: (page: number) => void
  onLoadRecommendations: (refresh?: boolean) => void
  onSelectItem: (text: string) => void
}

function getRecText(item: { text?: string; content?: string; message?: string }) {
  return item?.text || item?.content || item?.message || ""
}

export function RecommendPanel({
  recVisible,
  recItems,
  recPage,
  recLoading,
  recQuota,
  cyoaChoices,
  onPageChange,
  onLoadRecommendations,
  onSelectItem,
}: RecommendPanelProps) {
  if (!recVisible) return null

  const hasCyoa = cyoaChoices.length > 0
  // Page 1 belongs to the CYOA choices when present; recommendations follow.
  const cyoaPageCount = hasCyoa ? 1 : 0
  const recPageCount = Math.ceil(recItems.length / REC_PER_PAGE)
  const totalPages = Math.max(1, cyoaPageCount + recPageCount)
  const page = Math.min(Math.max(recPage, 0), totalPages - 1)
  const isCyoaPage = hasCyoa && page === 0
  const recIndex = page - cyoaPageCount
  const pageItems =
    recIndex >= 0
      ? recItems.slice(recIndex * REC_PER_PAGE, recIndex * REC_PER_PAGE + REC_PER_PAGE)
      : []

  return (
    <div className="border-t border-border bg-card/80 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
          推薦文
          {hasCyoa && (
            <button
              type="button"
              onClick={() => onPageChange(0)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-400/40 bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-300 transition-colors hover:bg-blue-500/25"
              aria-label={`選択肢${cyoaChoices.length}件を1ページ目に表示`}
            >
              <span aria-hidden className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-70 motion-reduce:hidden" />
                <span className="relative inline-flex size-1.5 rounded-full bg-blue-400" />
              </span>
              選択肢 {cyoaChoices.length}
            </button>
          )}
          <span role="status" className="sr-only">
            {hasCyoa ? `選択肢が${cyoaChoices.length}件あります` : ""}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {recQuota
            ? `${recQuota.remainCount ?? recQuota.remainingCount ?? "-"}/${recQuota.totalCount ?? "-"}`
            : ""}
        </span>
      </div>

      <div className="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto overscroll-contain">
        {isCyoaPage && (
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1 text-[10px] font-medium text-blue-300">
              <ListChecks className="size-3" aria-hidden />
              物語の選択肢
            </span>
            {cyoaChoices.map((choice, i) => (
              <button
                key={`${i}-${choice.text.slice(0, 24)}`}
                type="button"
                onClick={() => onSelectItem(choice.text)}
                className="flex w-full items-start gap-2 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2.5 text-left text-xs leading-relaxed text-foreground transition-colors hover:border-blue-400/60 hover:bg-blue-500/20"
              >
                <span
                  aria-hidden
                  className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                  {choice.title ? (
                    <span className="mb-0.5 block text-[10px] font-medium text-blue-300">
                      {choice.title}
                    </span>
                  ) : null}
                  {choice.text}
                </span>
              </button>
            ))}
          </div>
        )}

        {recLoading ? (
          <div className="flex items-center justify-center py-3">
            <Spinner className="size-4" />
            <span className="ml-2 text-xs text-muted-foreground">取得中…</span>
          </div>
        ) : pageItems.length === 0 ? (
          isCyoaPage ? null : (
            <p className="text-xs text-muted-foreground">推薦文がありません</p>
          )
        ) : (
          pageItems.map((item, i) => (
            <RecommendCard
              key={`${page}-${i}`}
              text={getRecText(item)}
              onClick={() => onSelectItem(getRecText(item))}
            />
          ))
        )}
      </div>

      <div className="mt-2 flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={page <= 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          aria-label="前の推薦文"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-8 text-center text-xs text-muted-foreground tabular-nums">
          {`${page + 1}/${totalPages}`}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={recLoading}
          onClick={() => {
            if (page >= totalPages - 1) {
              onLoadRecommendations(true)
              onPageChange(totalPages)
            } else {
              onPageChange(page + 1)
            }
          }}
          aria-label="次の推薦文"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
