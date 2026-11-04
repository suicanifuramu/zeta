import { ChevronLeft, ChevronRight } from "lucide-react"
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
  // Always expose one recommendation page so page 2 exists while page 1 holds
  // the choices. Nothing is generated until the user actually opens page 2.
  const recPageCount = Math.max(1, Math.ceil(recItems.length / REC_PER_PAGE))
  const totalPages = cyoaPageCount + recPageCount
  const page = Math.min(Math.max(recPage, 0), totalPages - 1)
  const firstRecPage = cyoaPageCount
  const isCyoaPage = hasCyoa && page === 0
  const recIndex = page - cyoaPageCount
  const pageItems =
    recIndex >= 0
      ? recItems.slice(recIndex * REC_PER_PAGE, recIndex * REC_PER_PAGE + REC_PER_PAGE)
      : []

  /** Navigate and lazily fetch/generate recommendations when the rec page opens. */
  const goToPage = (next: number) => {
    const target = Math.min(Math.max(next, 0), totalPages - 1)
    onPageChange(target)
    if (
      hasCyoa &&
      target === firstRecPage &&
      recItems.length === 0 &&
      !recLoading
    ) {
      onLoadRecommendations()
    }
  }

  return (
    <div className="border-t border-border bg-card/80 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium">推薦文</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {recQuota
            ? `${recQuota.remainCount ?? recQuota.remainingCount ?? "-"}/${recQuota.totalCount ?? "-"}`
            : ""}
        </span>
      </div>

      <div className="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto overscroll-contain">
        {isCyoaPage &&
          cyoaChoices.map((choice, i) => (
            <RecommendCard
              key={`${i}-${choice.text.slice(0, 24)}`}
              text={choice.text}
              onClick={() => onSelectItem(choice.text)}
            />
          ))}

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
          onClick={() => goToPage(page - 1)}
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
              goToPage(page + 1)
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
