import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { useProfileImageGenerator } from "@/hooks/use-profile-image-generator"
import type { ProfileImageResult } from "@/lib/types"
import { cn } from "@/lib/utils"
import { FieldMessage } from "@/components/creator/creator-ui"
import { errorMessage, formatDateTime } from "@/lib/creator-util"

interface ProfileImageSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plotId: string
  title: string
  /** Applies the chosen image. Resolve to close the sheet; reject to keep it open. */
  onPick: (candidate: ProfileImageResult) => Promise<void>
}

export function ProfileImageSheet({
  open,
  onOpenChange,
  plotId,
  title,
  onPick,
}: ProfileImageSheetProps) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      desktopClassName="max-h-[90dvh] max-w-2xl overflow-y-auto p-0 sm:max-w-2xl"
      mobileClassName="max-h-[90dvh] overflow-y-auto p-0"
    >
      <ProfileImageSheetBody
        plotId={plotId}
        title={title}
        onPick={onPick}
        onClose={() => onOpenChange(false)}
      />
    </ResponsiveDialog>
  )
}

function ProfileImageSheetBody({
  plotId,
  title,
  onPick,
  onClose,
}: {
  plotId: string
  title: string
  onPick: (candidate: ProfileImageResult) => Promise<void>
  onClose: () => void
}) {
  const gen = useProfileImageGenerator(plotId)
  const [styleId, setStyleId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [defaultPrompt, setDefaultPrompt] = useState("")
  const [negativePrompt, setNegativePrompt] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [source, setSource] = useState<"history" | "saved">("history")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [applying, setApplying] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const styles = gen.styles
  const selectedStyle = useMemo(
    () => styles?.find((s) => s.id === styleId) ?? null,
    [styles, styleId]
  )

  useEffect(() => {
    if (styleId === null && styles && styles.length > 0) {
      const first = styles.find((s) => s.enabled !== false) ?? styles[0]
      setStyleId(first.id)
    }
  }, [styles, styleId])

  const { loadSaved, saved, savedCursor } = gen
  useEffect(() => {
    if (source === "saved" && saved.length === 0 && savedCursor === null) {
      void loadSaved(true)
    }
  }, [source, saved.length, savedCursor, loadSaved])

  const candidates = source === "history" ? gen.history : gen.saved
  const candidateCursor =
    source === "history" ? gen.historyCursor : gen.savedCursor
  const selected = candidates.find((r) => r.id === selectedId) ?? null

  async function handleGenerate() {
    if (!styleId) {
      setFormError("スタイルを選択してください")
      return
    }
    if (!prompt.trim()) {
      setFormError("プロンプトを入力してください")
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      await gen.generate({
        prompt: prompt.trim(),
        quantity,
        styleId,
        defaultPrompt,
        negativePrompt,
      })
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePick() {
    if (!selected) return
    setApplying(true)
    try {
      await onPick(selected)
      onClose()
    } catch (error) {
      toast.error(`設定に失敗しました: ${errorMessage(error)}`)
    } finally {
      setApplying(false)
    }
  }

  const runningCount = gen.runningCount
  const failedJobs = gen.jobs.filter((j) => j.state === "failed")

  return (
    <div className="flex flex-col gap-6 p-5">
      <h2 className="sr-only">{title}</h2>

      <section aria-labelledby="pi-style" className="space-y-3">
        <h3 id="pi-style" className="text-sm font-semibold">
          スタイル
        </h3>
        {gen.stylesError && (
          <FieldMessage>{`スタイルを読み込めませんでした（${gen.stylesError}）`}</FieldMessage>
        )}
        {!styles && !gen.stylesError && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" /> 読み込み中…
          </p>
        )}
        {styles && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="list">
            {styles.map((style) => {
              const active = style.id === styleId
              return (
                <li key={style.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    disabled={style.enabled === false}
                    onClick={() => setStyleId(style.id)}
                    className={cn(
                      "flex w-full min-w-0 cursor-pointer flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted",
                      style.enabled === false && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <img
                      src={style.thumbnail}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full rounded-md object-cover"
                    />
                    <span className="truncate text-xs font-medium">
                      {style.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {style.price > 0 ? `${style.price}ピース` : "無料"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {selectedStyle && selectedStyle.isZetaModel === false && (
          <FieldMessage tone="hint">
            PixAIと表示されたスタイルはPixAIにより提供されたものであり、イメージに関する内容はAPIに転送されます。
          </FieldMessage>
        )}
      </section>

      <section aria-labelledby="pi-form" className="space-y-3">
        <h3 id="pi-form" className="text-sm font-semibold">
          生成内容
        </h3>
        <div className="space-y-1.5">
          <label htmlFor="pi-prompt" className="text-sm">
            プロンプト
          </label>
          <Textarea
            id="pi-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例) 銀髪の少女、夕暮れの教室…"
            rows={3}
            aria-invalid={
              formError === "プロンプトを入力してください" || undefined
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="pi-default" className="text-sm">
              スタイル用プロンプト（任意）
            </label>
            <Input
              id="pi-default"
              value={defaultPrompt}
              onChange={(e) => setDefaultPrompt(e.target.value)}
              placeholder="例) soft lighting…"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pi-negative" className="text-sm">
              ネガティブプロンプト（任意）
            </label>
            <Input
              id="pi-negative"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="例) 手の崩れ…"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="pi-quantity" className="text-sm">
              枚数
            </label>
            <select
              id="pi-quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="h-11 min-w-24 rounded-lg border border-input bg-background px-3 text-base text-foreground"
            >
              <option value={1}>1枚</option>
              <option value={2}>2枚</option>
              <option value={4}>4枚</option>
            </select>
          </div>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={submitting}
            className="min-h-11 cursor-pointer"
          >
            {submitting && <Spinner className="size-4" />}
            {submitting ? "生成を開始しています…" : "生成する"}
          </Button>
        </div>
        {formError && <FieldMessage>{formError}</FieldMessage>}
        <div aria-live="polite" className="space-y-1">
          {runningCount > 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" /> 生成中 {runningCount}件…
            </p>
          )}
          {failedJobs.map((job) => (
            <FieldMessage key={job.jobId}>
              {job.message ?? "生成に失敗しました"}
            </FieldMessage>
          ))}
        </div>
        <FieldMessage tone="hint">
          暴力・性的な内容は生成できません。生成に失敗した場合、ピースは返還されます。
        </FieldMessage>
      </section>

      <section aria-labelledby="pi-results" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 id="pi-results" className="text-sm font-semibold">
            候補
          </h3>
          <div role="group" aria-label="候補の種類" className="flex gap-1">
            {(["history", "saved"] as const).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={source === key ? "default" : "outline"}
                aria-pressed={source === key}
                className="min-h-9 cursor-pointer"
                onClick={() => {
                  setSource(key)
                  setSelectedId(null)
                }}
              >
                {key === "history" ? "生成履歴" : "保存済み"}
              </Button>
            ))}
          </div>
        </div>

        {gen.listError && (
          <FieldMessage>{`読み込みに失敗しました（${gen.listError}）`}</FieldMessage>
        )}
        {candidates.length === 0 && !gen.loadingList && (
          <p className="text-sm text-muted-foreground">
            {source === "history"
              ? "まだ生成した画像がありません。"
              : "保存済みの画像がありません。"}
          </p>
        )}
        {candidates.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="list">
            {candidates.map((result) => {
              const active = result.id === selectedId
              return (
                <li key={result.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={`${result.style?.name ?? "生成画像"} ${formatDateTime(result.createdAt)}`}
                    onClick={() => setSelectedId(result.id)}
                    className={cn(
                      "w-full cursor-pointer rounded-lg border p-1 transition-colors",
                      active
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <img
                      src={result.imageUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full rounded-md object-cover"
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {candidateCursor && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 w-full cursor-pointer"
            disabled={gen.loadingList}
            onClick={() =>
              void (source === "history"
                ? gen.loadHistory(false)
                : gen.loadSaved(false))
            }
          >
            {gen.loadingList ? "読み込み中…" : "もっと見る"}
          </Button>
        )}
      </section>

      <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-3 border-t border-border bg-background px-5 py-3">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {selected
            ? "選択中の画像を設定します"
            : "候補から画像を選んでください"}
        </p>
        <Button
          type="button"
          className="min-h-11 shrink-0 cursor-pointer"
          disabled={!selected || applying}
          onClick={handlePick}
        >
          {applying && <Spinner className="size-4" />}
          {applying ? "設定しています…" : "この画像を設定"}
        </Button>
      </div>
    </div>
  )
}
