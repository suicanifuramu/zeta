import { useEffect, useRef, useState } from "react"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { getLorebookDetail, getLorebookRecommendations } from "@/lib/api"
import type { LorebookListItem } from "@/lib/types"
import { usePlotEditor } from "@/components/creator/plot-editor-context"
import { FieldMessage } from "@/components/creator/creator-ui"
import { errorMessage } from "@/lib/creator-util"
import { LIMIT_TEXT } from "@/lib/plot-limits"

export function LorebookSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="設定集を連動"
      desktopClassName="max-h-[90dvh] max-w-xl overflow-y-auto p-0 sm:max-w-xl"
      mobileClassName="max-h-[90dvh] overflow-y-auto p-0"
    >
      <LorebookSheetBody />
    </ResponsiveDialog>
  )
}

function LorebookSheetBody() {
  const { ctrl } = usePlotEditor()
  const selectedIds = ctrl.draft.lorebookIds
  const [items, setItems] = useState<LorebookListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolved, setResolved] = useState<Record<string, string>>({})
  const [capMessage, setCapMessage] = useState<string | null>(null)
  const requestedRef = useRef<Set<string>>(new Set())
  const full = selectedIds.length >= ctrl.limits.lorebooks

  useEffect(() => {
    let cancelled = false
    getLorebookRecommendations({ limit: 20 })
      .then((page) => {
        if (cancelled) return
        setItems(page.lorebooks)
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
  }, [])

  // Titles for selected lorebooks that are not in the loaded list.
  useEffect(() => {
    const known = new Set(items.map((i) => i.lorebook.id))
    for (const id of selectedIds) {
      if (known.has(id) || requestedRef.current.has(id)) continue
      requestedRef.current.add(id)
      getLorebookDetail(id)
        .then((detail) =>
          setResolved((prev) => ({ ...prev, [id]: detail.title }))
        )
        .catch(() =>
          setResolved((prev) => ({
            ...prev,
            [id]: "（タイトルを取得できません）",
          }))
        )
    }
  }, [items, selectedIds])

  function titleOf(id: string): string {
    const listed = items.find((i) => i.lorebook.id === id)
    return listed?.lorebook.title ?? resolved[id] ?? "読み込み中…"
  }

  function toggle(id: string) {
    const isSelected = selectedIds.includes(id)
    if (!isSelected && full) {
      // Input limit: the 6th lorebook is refused here; saving never gets that far.
      setCapMessage(LIMIT_TEXT.lorebooks(ctrl.limits.lorebooks))
      return
    }
    setCapMessage(null)
    ctrl.edit("lorebooks", (d) => ({
      ...d,
      lorebookIds: d.lorebookIds.includes(id)
        ? d.lorebookIds.filter((x) => x !== id)
        : [...d.lorebookIds, id],
    }))
  }

  async function loadMore() {
    if (!cursor) return
    setLoading(true)
    try {
      const page = await getLorebookRecommendations({ limit: 20, cursor })
      setItems((prev) => [...prev, ...page.lorebooks])
      setCursor(page.nextCursor ?? null)
    } catch (e: unknown) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-5">
      <p className="text-xs leading-relaxed text-muted-foreground">
        プロットを連動するとキーワードが言及されるたびに、設定集の世界観がAIに伝達されます。
        1つのプロットに最大{ctrl.limits.lorebooks}つまで連動できます。
      </p>
      {capMessage && <FieldMessage>{capMessage}</FieldMessage>}

      <section aria-labelledby="lb-selected" className="space-y-2">
        <h3 id="lb-selected" className="text-sm font-semibold">
          連動中（{selectedIds.length}件）
        </h3>
        {selectedIds.length === 0 && (
          <p className="text-sm text-muted-foreground">
            連動している設定集はありません。
          </p>
        )}
        <ul className="space-y-2" role="list">
          {selectedIds.map((id) => (
            <li
              key={id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <span className="min-w-0 truncate text-sm">{titleOf(id)}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 shrink-0 cursor-pointer"
                onClick={() => toggle(id)}
                aria-label={`${titleOf(id)} の連動を解除`}
              >
                解除
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="lb-list" className="space-y-2">
        <h3 id="lb-list" className="text-sm font-semibold">
          おすすめの設定集
        </h3>
        {error && (
          <FieldMessage>{`読み込みに失敗しました（${error}）`}</FieldMessage>
        )}
        {loading && items.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" /> 読み込み中…
          </p>
        )}
        <ul className="space-y-2" role="list">
          {items.map((item) => {
            const id = item.lorebook.id
            const checked = selectedIds.includes(id)
            return (
              <li key={id}>
                <label
                  htmlFor={`lb-${id}`}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted"
                >
                  <input
                    id={`lb-${id}`}
                    type="checkbox"
                    checked={checked}
                    disabled={!ctrl.editable || (!checked && full)}
                    onChange={() => toggle(id)}
                    className="mt-1 size-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {item.lorebook.title}
                    </span>
                    {item.lorebook.description && (
                      <span className="line-clamp-2 block text-xs text-muted-foreground">
                        {item.lorebook.description}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {cursor && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full cursor-pointer"
            disabled={loading}
            onClick={() => void loadMore()}
          >
            {loading ? "読み込み中…" : "もっと見る"}
          </Button>
        )}
      </section>
    </div>
  )
}
