import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePlotDraft, type PlotDraftController } from "@/hooks/use-plot-draft"
import { deletePlotVerified } from "@/lib/plot-delete"
import type { CreatorPlot, PlotDraft } from "@/lib/types"
import { publishIssues, type LimitIssue } from "@/lib/plot-draft"
import { errorMessage } from "@/lib/creator-util"
import { PlotEditorContext, tabForTarget, type PlotEditorTab } from "@/components/creator/plot-editor-context"
import { BasicSection } from "@/components/creator/basic-section"
import { CharactersSection } from "@/components/creator/characters-section"
import { ChatProfilesSection } from "@/components/creator/chat-profiles-section"
import { PublicitySection } from "@/components/creator/publicity-section"
import { IntroSection } from "@/components/creator/intro-section"
import { ExampleChatSection } from "@/components/creator/example-chat-section"
import { StyleSection } from "@/components/creator/style-section"
import { PluginsSection } from "@/components/creator/plugins-section"
import { PublishDialog } from "@/components/creator/publish-dialog"
import { ConfirmDialog, FieldMessage } from "@/components/creator/creator-ui"

const TABS: readonly PlotEditorTab[] = ["info", "content", "intro", "style", "plugin"]

function isTabKey(value: string | null): value is PlotEditorTab {
  return value !== null && (TABS as readonly string[]).includes(value)
}

const TIME_FORMAT = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" })
const NO_ERRORS: Record<string, string> = {}
/** Frames (about 2 s) to wait for a focus target to mount after a tab switch or a dialog close. */
const FOCUS_RETRY_FRAMES = 120
/** Space kept between the sticky header and a focused element. */
const SCROLL_GAP_PX = 16

function isNativelyFocusable(el: HTMLElement): boolean {
  return el.matches("button, input, select, textarea, a[href]")
}

/** Scrolls an element to the top of the viewport, just below the sticky header (scroll-margin-top). */
function scrollBelowHeader(el: HTMLElement, headerHeight: number) {
  el.style.scrollMarginTop = `${headerHeight + SCROLL_GAP_PX}px`
  el.scrollIntoView({ block: "start" })
}

/** Focuses an element (making a non-control focusable with tabindex -1) and scrolls it below the header. */
function focusBelowHeader(el: HTMLElement, headerHeight: number) {
  if (!el.hasAttribute("tabindex") && !isNativelyFocusable(el)) el.setAttribute("tabindex", "-1")
  scrollBelowHeader(el, headerHeight)
  el.focus({ preventScroll: true })
}

/** Editor for one plot. Mounted only after the plot is loaded (see pages/plot-editor.tsx). */
export function PlotEditor({ plot }: { plot: CreatorPlot }) {
  const ctrl: PlotDraftController = usePlotDraft(plot)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [publishOpen, setPublishOpen] = useState(false)
  // Bumped on every opening of the publish dialog: the dialog is remounted, so it starts at the confirmation.
  const [publishSession, setPublishSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // Publish errors belong to the draft they were found in: any later edit (a new draft object) hides them.
  const [publishErrors, setPublishErrors] = useState<{
    draft: PlotDraft
    map: Record<string, string>
  } | null>(null)
  const errors = publishErrors && publishErrors.draft === ctrl.draft ? publishErrors.map : NO_ERRORS
  // After a publish was tried, the publish rules are checked live too: a message clears as soon as its problem is fixed.
  const [publishTried, setPublishTried] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | null>(null)
  const headerRef = useRef<HTMLElement>(null)

  const requested = searchParams.get("tab")
  const tab: PlotEditorTab = isTabKey(requested) ? requested : "info"
  const locked = !ctrl.editable || publishOpen || deleting
  const plotId = plot.id
  const title = ctrl.draft.name?.trim() ? ctrl.draft.name : "（無題）"

  // Live problems: the limits always, the publish rules once a publish was tried. Recomputed from the
  // draft on every render, so each message disappears when its problem is fixed.
  const liveIssues = useMemo(
    () => (publishTried ? publishIssues(ctrl.draft, ctrl.limits) : ctrl.issues),
    [publishTried, ctrl.draft, ctrl.limits, ctrl.issues]
  )
  const messageFor = (target: string): string | null =>
    errors[target] ?? liveIssues.find((i) => i.target === target)?.message ?? null
  const issuesFor = (prefix: string): LimitIssue[] => liveIssues.filter((i) => i.target.startsWith(prefix))

  const contextValue = { plotId, ctrl, locked, errors, messageFor, issuesFor }

  useEffect(() => {
    document.title = `${title} | 作成`
  }, [title])

  // Move focus to the first problem after its tab is shown and any dialog has closed. The target may
  // mount a frame or two later (and the dialog's focus return runs on close), so retry per frame.
  useEffect(() => {
    if (!focusRequest) return
    let frames = 0
    let frame = 0
    let cancelled = false
    const attempt = () => {
      if (cancelled) return
      frames += 1
      const el = document.getElementById(focusRequest.id)
      const dialogOpen =
        publishOpen || document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
      const reachable =
        el !== null && el.closest("fieldset:disabled") === null && !(el as HTMLButtonElement).disabled
      if (el && !dialogOpen) {
        const headerHeight = headerRef.current?.offsetHeight ?? 0
        // A disabled control cannot take focus: show it and stop, so the message next to it is visible.
        if (reachable) focusBelowHeader(el as HTMLElement, headerHeight)
        else scrollBelowHeader(el as HTMLElement, headerHeight)
        setFocusRequest(null)
        return
      }
      if (frames < FOCUS_RETRY_FRAMES) frame = window.requestAnimationFrame(attempt)
      else setFocusRequest(null)
    }
    frame = window.requestAnimationFrame(attempt)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [focusRequest, tab, publishOpen])

  // Warn before the tab closes while changes are not yet saved.
  useEffect(() => {
    if (!ctrl.dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [ctrl.dirty])

  function selectTab(next: string) {
    if (!isTabKey(next)) return
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        params.set("tab", next)
        return params
      },
      { replace: true }
    )
  }

  /** Receives field issues from publishing: shows them and moves to the first one. */
  function reveal(issues: LimitIssue[], draft: PlotDraft) {
    if (issues.length === 0) return
    const next: Record<string, string> = {}
    for (const issue of issues) next[issue.target] = issue.message
    setPublishErrors({ draft, map: next })
    setPublishTried(true)
    const first = issues[0]
    const wanted = tabForTarget(first.target)
    if (wanted !== tab) selectTab(wanted)
    setFocusRequest({ id: first.target, nonce: Date.now() })
  }

  function handleBack() {
    if (ctrl.dirty) setLeaveOpen(true)
    else navigate("/create")
  }

  async function saveAndLeave() {
    setLeaving(true)
    try {
      await ctrl.flush()
      setLeaveOpen(false)
      navigate("/create")
    } catch (error) {
      toast.error(`保存できませんでした: ${errorMessage(error)}`)
    } finally {
      setLeaving(false)
    }
  }

  /**
   * Deletes the plot and verifies it is gone (plot-delete.ts). The success message and the move to
   * the list happen only after that. On failure the user stays here and unsent edits are kept.
   * The list page fetches again on mount, so the deleted plot is not shown.
   */
  function deletePlot() {
    setDeleting(true)
    deletePlotVerified(plotId)
      .then(() => {
        toast.success("永久削除されました")
        navigate("/create")
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error))
      })
      .finally(() => {
        setDeleting(false)
      })
  }

  function openPublish() {
    setPublishSession((n) => n + 1)
    setPublishOpen(true)
  }

  const statusLabel = ctrl.isReleased
    ? ctrl.meta.isPrivate
      ? "非公開"
      : "公開中"
    : "作成中"

  return (
    <PlotEditorContext.Provider value={contextValue}>
      <div className="flex min-h-dvh flex-col">
        <header ref={headerRef} className="glass sticky top-0 z-40 border-b border-border">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 cursor-pointer"
              aria-label="作成一覧へ戻る"
              onClick={handleBack}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{statusLabel}</span>
                {ctrl.meta.reviewState === "REVIEWING" && <span>審査中</span>}
                {ctrl.meta.reviewState === "REJECTED" && <span className="text-destructive">審査却下</span>}
                {ctrl.isReleased && ctrl.meta.hasUnpublishedChanges && <span>未公開の変更があります</span>}
              </p>
              <SaveStatus ctrl={ctrl} />
            </div>
            {ctrl.editable && (
              <Button type="button" className="min-h-11 shrink-0 cursor-pointer" onClick={openPublish}>
                {ctrl.isReleased ? "変更を公開…" : "公開する…"}
              </Button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-4">
          {!ctrl.hasDraft && (
            <p role="note" className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              下書きの情報を読み込めないため、この画面では編集できません。
            </p>
          )}
          {ctrl.meta.reviewState === "REJECTED" && (
            <p role="alert" className="mb-4 rounded-lg border border-destructive/40 px-4 py-3 text-sm text-destructive">
              審査で却下されました。内容を確認して修正してください。
            </p>
          )}

          <Tabs value={tab} onValueChange={selectTab}>
            {/* The list is as tall as its 44 px triggers (the shadcn default h-8 would clip them). */}
            <TabsList className="grid w-full grid-cols-5 group-data-horizontal/tabs:h-auto">
              <TabsTrigger value="info" className="min-h-11 cursor-pointer px-1 text-xs sm:text-sm">
                情報
              </TabsTrigger>
              <TabsTrigger value="content" className="min-h-11 cursor-pointer px-1 text-xs sm:text-sm">
                内容
              </TabsTrigger>
              <TabsTrigger value="intro" className="min-h-11 cursor-pointer px-1 text-xs sm:text-sm">
                イントロ・状況例
              </TabsTrigger>
              <TabsTrigger value="style" className="min-h-11 cursor-pointer px-1 text-xs sm:text-sm">
                演出
              </TabsTrigger>
              <TabsTrigger value="plugin" className="min-h-11 cursor-pointer px-1 text-xs sm:text-sm">
                プラグイン
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-6 focus-visible:outline-none">
              <fieldset disabled={locked} className="min-w-0 space-y-10 border-0 p-0">
                <BasicSection />
                <CharactersSection />
                <ChatProfilesSection />
              </fieldset>
              {ctrl.isReleased || ctrl.meta.status === "PRERELEASE" ? (
                <section
                  aria-labelledby="plot-delete-heading"
                  className="mt-12 space-y-3 border-t border-border pt-6"
                >
                  <h2 id="plot-delete-heading" className="text-base font-semibold">
                    プロットの削除
                  </h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    削除されたプロットは復元することができません。
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    className="min-h-11 cursor-pointer"
                    disabled={publishOpen || deleting}
                    onClick={() => setDeleteOpen(true)}
                  >
                    プロットを削除…
                  </Button>
                  {deleting && (
                    <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
                      削除を確認しています…（完了するまでこのままお待ちください）
                    </p>
                  )}
                </section>
              ) : null}
            </TabsContent>

            <TabsContent value="content" className="mt-6 focus-visible:outline-none">
              <fieldset disabled={locked} className="min-w-0 border-0 p-0">
                <PublicitySection />
              </fieldset>
            </TabsContent>

            <TabsContent value="intro" className="mt-6 focus-visible:outline-none">
              <fieldset disabled={locked} className="min-w-0 space-y-10 border-0 p-0">
                <IntroSection />
                <ExampleChatSection />
              </fieldset>
            </TabsContent>

            <TabsContent value="style" className="mt-6 focus-visible:outline-none">
              <fieldset disabled={locked} className="min-w-0 border-0 p-0">
                <StyleSection />
              </fieldset>
            </TabsContent>

            <TabsContent value="plugin" className="mt-6 focus-visible:outline-none">
              <fieldset disabled={locked} className="min-w-0 border-0 p-0">
                <PluginsSection />
              </fieldset>
            </TabsContent>
          </Tabs>

          {(Object.keys(errors).length > 0 || (publishTried && liveIssues.length > 0)) && (
            <div className="mt-6">
              <FieldMessage role="alert">
                公開できない項目があります。赤いメッセージの項目を修正してください。
              </FieldMessage>
            </div>
          )}
        </main>

        <PublishDialog
          key={publishSession}
          open={publishOpen}
          onOpenChange={setPublishOpen}
          onFieldIssues={(issues, draft) => {
            setPublishOpen(false)
            reveal(issues, draft)
          }}
          onPublished={() => {
            setPublishErrors(null)
            setPublishTried(false)
          }}
        />

        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="プロットを削除しますか？"
          description="削除されたプロットは復元することができません"
          confirmLabel="削除"
          onConfirm={deletePlot}
        />

        <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>保存してから閉じますか？</DialogTitle>
              <DialogDescription>未保存の変更があります。保存が完了してから閉じると安全です。</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11 cursor-pointer" onClick={() => setLeaveOpen(false)}>
                キャンセル
              </Button>
              <Button type="button" className="min-h-11 cursor-pointer" disabled={leaving} onClick={() => void saveAndLeave()}>
                保存して閉じる
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PlotEditorContext.Provider>
  )
}

function SaveStatus({ ctrl }: { ctrl: PlotDraftController }) {
  const { save } = ctrl
  let text: string
  let tone: "error" | "warning" | "hint" = "hint"
  switch (save.phase) {
    case "pending":
      text = "未保存の変更があります"
      break
    case "saving":
      text = "保存中…"
      break
    case "saved":
      text = save.savedAt ? `保存しました（${TIME_FORMAT.format(new Date(save.savedAt))}）` : "保存しました"
      break
    case "error":
      text = save.message ?? "保存できませんでした。入力内容は保持されています。"
      tone = "error"
      break
    case "invalid":
      text = `${save.message ?? "入力内容を修正してください"}。修正すると自動で保存されます。`
      tone = "warning"
      break
    default:
      text = ctrl.editable ? "変更は自動で保存されます" : "閲覧のみ"
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div aria-live="polite" className="min-w-0 flex-1">
        <FieldMessage tone={tone}>{text}</FieldMessage>
      </div>
      {save.phase === "error" && (
        <Button type="button" variant="outline" size="sm" className="min-h-9 shrink-0 cursor-pointer" onClick={ctrl.retry}>
          再試行
        </Button>
      )}
    </div>
  )
}
