import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  createRoom,
  getCreatorPlot,
  publishCreatorPlot,
  putCreatorPlot,
  testKeywords,
} from "@/lib/api"
import {
  buildPublishBody,
  publishIssues,
  publishKeywordTargets,
  type LimitIssue,
} from "@/lib/plot-draft"
import { ABUSE_TEXT, mapPublishError } from "@/lib/publish-errors"
import { errorMessage } from "@/lib/creator-util"
import { UserError } from "@/lib/user-error"
import type { PlotDraft } from "@/lib/types"
import { usePlotEditor } from "@/components/creator/plot-editor-context"

type Phase = "confirm" | "publishing" | "done" | "error"

/** True when a keyword check flags any of the texts of the draft. */
async function hasFlaggedKeyword(draft: PlotDraft): Promise<boolean> {
  const targets = publishKeywordTargets(draft)
  const flags = await Promise.all(targets.map((t) => testKeywords(t.type, t.text)))
  return flags.some(Boolean)
}

/**
 * Publishing dialog. The parent gives it a new `key` every time it opens, so each opening starts
 * at the confirmation step (UI-TEST 4).
 *
 * Flow: confirm → flush autosave → client checks → PUT (full body) → keyword check →
 * PATCH status RELEASE → GET creator → optional chat start. Re-publishing a released plot is the
 * same without the chat start. Failures go to the field they belong to (the editor reveals it),
 * or to a message here. "もう一度試す" reruns the whole flow.
 */
export function PublishDialog({
  open,
  onOpenChange,
  onFieldIssues,
  onPublished,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Field issues and the draft they were found in; the editor closes this dialog and reveals the first one. */
  onFieldIssues: (issues: LimitIssue[], draft: PlotDraft) => void
  onPublished: () => void
}) {
  const { plotId, ctrl } = usePlotEditor()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>("confirm")
  const [step, setStep] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [wasReleased, setWasReleased] = useState(false)
  const isPrivate = ctrl.meta.isPrivate
  const released = ctrl.isReleased
  // Set when the failure moves focus to a field: the dialog must not hand focus back to the trigger on close.
  const keepFocusOnClose = useRef(false)

  function reportFields(issues: LimitIssue[], draft: PlotDraft) {
    keepFocusOnClose.current = true
    onFieldIssues(issues, draft)
  }

  function reset() {
    setPhase("confirm")
    setStep("")
    setError(null)
  }

  async function publish() {
    setPhase("publishing")
    setError(null)
    setWasReleased(released)
    // The draft this attempt works on; field issues are reported against it.
    let working: PlotDraft = ctrl.draft
    try {
      setStep("未保存の変更を保存しています…")
      try {
        working = await ctrl.flush()
      } catch (flushError) {
        // A blocked section is reported as field issues; any other save failure is a message.
        const blocked = publishIssues(ctrl.draft, ctrl.limits)
        if (blocked.length > 0) {
          reportFields(blocked, ctrl.draft)
          setPhase("confirm")
          return
        }
        throw flushError
      }

      const pre = publishIssues(working, ctrl.limits)
      if (pre.length > 0) {
        reportFields(pre, working)
        setPhase("confirm")
        return
      }

      setStep("公開内容を送信しています…")
      await putCreatorPlot(plotId, buildPublishBody(plotId, working))

      setStep("キーワードを確認しています…")
      // Stops before the status change: the plot stays unpublished and can be fixed and retried.
      if (await hasFlaggedKeyword(working)) throw new UserError(ABUSE_TEXT)

      setStep("公開しています…")
      await publishCreatorPlot(plotId)
      setStep("最新の内容を読み込んでいます…")
      const fresh = await getCreatorPlot(plotId)
      ctrl.applyPlot(fresh)
      onPublished()
      setPhase("done")
    } catch (e) {
      console.warn("[creator] publish failed", e)
      const failure = mapPublishError(e, working, ctrl.limits)
      if (failure.kind === "fields") {
        reportFields(failure.issues, working)
        setPhase("confirm")
        return
      }
      setError(failure.message)
      setPhase("error")
    }
  }

  async function startChat() {
    setStarting(true)
    try {
      const room = await createRoom(plotId, "AUTO")
      onOpenChange(false)
      navigate(`/chat/${room.id}`)
    } catch (e) {
      toast.error(`チャットを開始できませんでした: ${errorMessage(e)}`)
    } finally {
      setStarting(false)
    }
  }

  const title = released
    ? "変更を公開しますか？"
    : isPrivate
      ? "プロットを公開しますか？"
      : "他のユーザーにプロットを公開する"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing is blocked while the publish request is running.
        if (phase === "publishing") return
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent
        showCloseButton={phase !== "publishing"}
        className="min-w-0 grid-cols-[minmax(0,1fr)] sm:max-w-md"
        onCloseAutoFocus={(event) => {
          if (keepFocusOnClose.current) {
            event.preventDefault()
            keepFocusOnClose.current = false
          }
        }}
      >
        {phase === "confirm" && (
          <>
            <DialogHeader className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription asChild>
                <div className="min-w-0 space-y-2 text-sm leading-relaxed">
                  {released && <p>公開中のプロットに加えた変更が反映されます。</p>}
                  {!released && isPrivate && <p>非公開のまま公開されます。</p>}
                  {!released && !isPrivate && (
                    <>
                      <p>誰でもトーク可能になります。</p>
                      <p className="font-medium text-foreground">
                        一度公開すると非公開に変更できません。
                      </p>
                    </>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-wrap">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 cursor-pointer"
                onClick={() => onOpenChange(false)}
              >
                キャンセル
              </Button>
              <Button type="button" className="min-h-11 cursor-pointer" onClick={() => void publish()}>
                {released ? "変更を公開する" : "公開する"}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "publishing" && (
          <>
            <DialogHeader className="min-w-0">
              <DialogTitle>公開しています</DialogTitle>
              <DialogDescription>このままお待ちください。</DialogDescription>
            </DialogHeader>
            <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" /> {step}
            </p>
          </>
        )}

        {phase === "done" && (
          <>
            <DialogHeader className="min-w-0">
              <DialogTitle>{wasReleased ? "変更を公開しました" : "プロットを公開しました"}</DialogTitle>
              <DialogDescription>
                {wasReleased ? "公開中の内容が更新されました。" : "このプロットでチャットを始められます。"}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-wrap">
              {!wasReleased && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 cursor-pointer"
                  onClick={() => {
                    onOpenChange(false)
                    navigate("/create")
                  }}
                >
                  作成一覧へ戻る
                </Button>
              )}
              {wasReleased ? (
                <Button type="button" className="min-h-11 cursor-pointer" onClick={() => onOpenChange(false)}>
                  閉じる
                </Button>
              ) : (
                <Button
                  type="button"
                  className="min-h-11 cursor-pointer"
                  disabled={starting}
                  onClick={() => void startChat()}
                >
                  {starting && <Spinner className="size-4" />}
                  チャットを始める
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {phase === "error" && (
          <>
            <DialogHeader className="min-w-0">
              <DialogTitle>公開できませんでした</DialogTitle>
              <DialogDescription asChild>
                <div
                  role="alert"
                  className="min-w-0 text-sm break-words text-destructive [overflow-wrap:anywhere]"
                >
                  {error}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-wrap">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 cursor-pointer"
                onClick={() => onOpenChange(false)}
              >
                閉じる
              </Button>
              <Button type="button" className="min-h-11 cursor-pointer" onClick={() => void publish()}>
                もう一度試す
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
