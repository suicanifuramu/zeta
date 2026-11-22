import { useCallback, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  addPlotCoverImage,
  checkPlotName,
  deleteCoverImage,
  listCoverGallery,
  uploadCoverImage,
} from "@/lib/api"
import { countChars } from "@/lib/plot-draft"
import type { GalleryImage, ProfileImageResult } from "@/lib/types"
import { usePlotEditor } from "@/components/creator/plot-editor-context"
import {
  ConfirmDialog,
  Counter,
  FieldMessage,
  SectionHeading,
  ToggleRow,
} from "@/components/creator/creator-ui"
import { useKeywordCheck } from "@/hooks/use-keyword-check"
import { errorMessage } from "@/lib/creator-util"
import { ProfileImageSheet } from "@/components/creator/profile-image-sheet"
import { ImageGalleryDialog } from "@/components/creator/image-gallery-dialog"
import type { PreparedImage } from "@/lib/image-upload"
import { UserError } from "@/lib/user-error"

export function BasicSection() {
  const { plotId, ctrl, messageFor } = usePlotEditor()
  const d = ctrl.draft
  const [coverOpen, setCoverOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [publicConfirm, setPublicConfirm] = useState(false)
  const [nameWarning, setNameWarning] = useState<string | null>(null)
  const descriptionCheck = useKeywordCheck()
  const narratorCheck = useKeywordCheck()

  const nameLength = countChars(d.name)

  async function checkNameOnBlur() {
    const name = d.name ?? ""
    if (!name.trim()) {
      setNameWarning(null)
      return
    }
    try {
      const words = await checkPlotName(name)
      setNameWarning(
        words.length > 0 ? `[警告ワード: ${words.join("、")}]` : null
      )
    } catch {
      setNameWarning("名前の確認に失敗しました")
    }
  }

  /** Sets the cover from one image URL (generated candidate or a gallery item). */
  async function setCoverFrom(url: string) {
    const results = await addPlotCoverImage(plotId, url)
    const imageUrl = results.find(
      (r) => r.type === "Success" && r.imageUrl
    )?.imageUrl
    if (!imageUrl) throw new UserError("表紙を登録できませんでした")
    // The server stores the cover on the draft; it is not part of any autosave section.
    ctrl.setLocal((x) => ({ ...x, imageUrl }))
  }

  async function pickGenerated(candidate: ProfileImageResult) {
    await setCoverFrom(candidate.imageUrl)
  }

  const loadGallery = useCallback(() => listCoverGallery(plotId), [plotId])

  async function uploadToGallery(image: PreparedImage) {
    await uploadCoverImage(plotId, image)
  }

  function setCoverFromGallery(item: GalleryImage) {
    setCoverFrom(item.imageUrl).catch((error: unknown) => {
      toast.error(`表紙を設定できませんでした: ${errorMessage(error)}`)
    })
  }

  /** Public → private is impossible after release; private → public asks first. */
  function onPrivateChange(value: boolean) {
    if (!ctrl.isReleased) {
      ctrl.setPrivate(value).catch((error: unknown) => {
        toast.error(`公開範囲を変更できませんでした: ${errorMessage(error)}`)
      })
      return
    }
    if (value === false && ctrl.meta.isPrivate) setPublicConfirm(true)
  }

  function makePublic() {
    setPublicConfirm(false)
    ctrl.setPrivate(false).catch((error: unknown) => {
      toast.error(`公開範囲を変更できませんでした: ${errorMessage(error)}`)
    })
  }

  const visibilityDescription = ctrl.isReleased
    ? ctrl.meta.isPrivate
      ? "非公開のプロットを公開に変更できます。一度公開すると非公開には戻せません。"
      : "公開中のプロットは非公開に変更できません。"
    : "非公開プロットは1つまで作成できます。公開する前なら、いつでも切り替えられます。"

  return (
    <div className="space-y-8">
      <section aria-labelledby="basic-title" className="space-y-4">
        <SectionHeading id="basic-title" title="基本情報" />

        <div className="space-y-1.5">
          <div className="flex items-end justify-between gap-2">
            <label htmlFor="plot-name" className="text-sm font-medium">
              タイトル
            </label>
            <Counter value={nameLength} max={ctrl.limits.name} />
          </div>
          <Input
            id="plot-name"
            value={d.name ?? ""}
            onChange={(e) => {
              const v = e.target.value
              ctrl.edit("basic", (x) => ({
                ...x,
                name: v.length > 0 ? v : null,
              }))
            }}
            onBlur={() => void checkNameOnBlur()}
            aria-invalid={messageFor("plot-name") ? true : undefined}
            aria-describedby="plot-name-msg"
            placeholder="例) 放課後の図書室…"
            autoComplete="off"
          />
          <div id="plot-name-msg" className="space-y-1">
            {messageFor("plot-name") && (
              <FieldMessage>{messageFor("plot-name")}</FieldMessage>
            )}
            {nameWarning && (
              <FieldMessage tone="warning">{nameWarning}</FieldMessage>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-end justify-between gap-2">
            <label htmlFor="plot-description" className="text-sm font-medium">
              説明
            </label>
            <Counter
              value={countChars(d.longDescription)}
              max={ctrl.limits.longDescription}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            状況、関係性、世界観等を説明してください。
          </p>
          <Textarea
            id="plot-description"
            value={d.longDescription ?? ""}
            onChange={(e) => {
              const v = e.target.value
              ctrl.edit("basic", (x) => ({
                ...x,
                longDescription: v.length > 0 ? v : null,
              }))
            }}
            onBlur={() =>
              void descriptionCheck.check(
                "ABUSING_PLOT_PROMPT",
                d.longDescription
              )
            }
            rows={5}
            aria-invalid={messageFor("plot-description") ? true : undefined}
            aria-describedby="plot-description-msg"
          />
          <div id="plot-description-msg" className="space-y-1">
            {messageFor("plot-description") && (
              <FieldMessage>{messageFor("plot-description")}</FieldMessage>
            )}
            {descriptionCheck.warning && (
              <FieldMessage tone="warning">
                {descriptionCheck.warning}
              </FieldMessage>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-end justify-between gap-2">
            <label htmlFor="plot-narrator" className="text-sm font-medium">
              ナレーター
            </label>
            <Counter
              value={countChars(d.narrator)}
              max={ctrl.limits.longDescription}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            ナレーターの説明は他のユーザーには公開されません。
          </p>
          <Input
            id="plot-narrator"
            value={d.narrator ?? ""}
            onChange={(e) => {
              const v = e.target.value
              ctrl.edit("basic", (x) => ({
                ...x,
                narrator: v.length > 0 ? v : null,
              }))
            }}
            onBlur={() =>
              void narratorCheck.check("ABUSING_PLOT_PROMPT", d.narrator)
            }
            placeholder="例) 物語の語り手…"
            autoComplete="off"
            aria-invalid={messageFor("plot-narrator") ? true : undefined}
            aria-describedby="plot-narrator-msg"
          />
          <div id="plot-narrator-msg" className="space-y-1">
            {messageFor("plot-narrator") && (
              <FieldMessage>{messageFor("plot-narrator")}</FieldMessage>
            )}
            {narratorCheck.warning && (
              <FieldMessage tone="warning">
                {narratorCheck.warning}
              </FieldMessage>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="basic-cover" className="space-y-3">
        <SectionHeading
          id="basic-cover"
          title="表紙"
          description="プロットの一覧やカードに表示される画像です。"
        />
        <div className="flex items-center gap-4">
          <div className="size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {d.imageUrl ? (
              <img
                src={d.imageUrl}
                alt="現在の表紙"
                className="size-full object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
                未設定
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 cursor-pointer"
              onClick={() => setCoverOpen(true)}
            >
              表紙を生成…
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 cursor-pointer"
              onClick={() => setGalleryOpen(true)}
            >
              画像を選ぶ…
            </Button>
          </div>
        </div>
        <ProfileImageSheet
          open={coverOpen}
          onOpenChange={setCoverOpen}
          plotId={plotId}
          title="表紙を設定"
          onPick={pickGenerated}
        />
        <ImageGalleryDialog
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          title="表紙の画像"
          load={loadGallery}
          upload={uploadToGallery}
          remove={(sequence) => deleteCoverImage(plotId, sequence)}
          onMain={setCoverFromGallery}
        />
      </section>

      <section aria-labelledby="basic-visibility" className="space-y-2">
        <SectionHeading id="basic-visibility" title="公開範囲" />
        <ToggleRow
          id="plot-private"
          label="非公開にする"
          description={visibilityDescription}
          checked={ctrl.meta.isPrivate}
          disabled={!ctrl.editable || (ctrl.isReleased && !ctrl.meta.isPrivate)}
          onChange={onPrivateChange}
        />
        <ConfirmDialog
          open={publicConfirm}
          onOpenChange={setPublicConfirm}
          title="プロットを公開しますか？"
          description="一度公開したプロットは後で非公開に変更することはできません。"
          confirmLabel="公開する"
          onConfirm={makePublic}
        />
      </section>
    </div>
  )
}
