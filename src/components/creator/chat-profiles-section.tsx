import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { setChatProfileImage, uploadChatProfileImage } from "@/lib/api"
import { countChars, newChatProfile } from "@/lib/plot-draft"
import { LIMIT_TEXT } from "@/lib/plot-limits"
import {
  ACCEPTED_IMAGE_ATTR,
  prepareImageForUpload,
} from "@/lib/image-upload"
import type { DraftChatProfile, ProfileImageResult } from "@/lib/types"
import { errorMessage } from "@/lib/creator-util"
import { UserError } from "@/lib/user-error"
import { usePlotEditor } from "@/components/creator/plot-editor-context"
import {
  ConfirmDialog,
  Counter,
  FieldMessage,
  IssueMessage,
  SectionHeading,
  ToggleRow,
} from "@/components/creator/creator-ui"
import { useKeywordCheck } from "@/hooks/use-keyword-check"
import { ProfileImageSheet } from "@/components/creator/profile-image-sheet"
import { ImagePlus, Images, Trash2 } from "lucide-react"

export function ChatProfilesSection() {
  const { plotId, ctrl, messageFor } = usePlotEditor()
  const profiles = ctrl.draft.chatProfiles
  const saving = ctrl.save.phase === "saving"
  const atLimit = profiles.length >= ctrl.limits.chatProfiles
  const [sheetFor, setSheetFor] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)

  function update(id: string, patch: Partial<DraftChatProfile>) {
    ctrl.edit("chatProfiles", (d) => ({
      ...d,
      chatProfiles: d.chatProfiles.map((cp) =>
        cp.id === id ? { ...cp, ...patch } : cp
      ),
    }))
  }

  async function pickImage(id: string, candidate: ProfileImageResult) {
    // The chat profile must be saved before its image can be set.
    await ctrl.flush()
    const url = await setChatProfileImage(
      plotId,
      id,
      candidate.imageUrl,
      candidate.id ?? null
    )
    update(id, { imageUrl: url })
  }

  /** Local file: the server stores it directly (no coins; LIVE D9). */
  async function uploadFile(id: string, file: File) {
    await ctrl.flush()
    const prepared = await prepareImageForUpload(file)
    const url = await uploadChatProfileImage(plotId, id, prepared)
    update(id, { imageUrl: url })
  }

  return (
    <section aria-labelledby="chat-profiles-heading" className="space-y-4">
      <SectionHeading
        id="chat-profiles-heading"
        title="トークプロフィール"
        description="ユーザーが使用するプロフィールの候補です。プレイ開始時に選べます。"
        aside={
          <Counter value={profiles.length} max={ctrl.limits.chatProfiles} />
        }
      />

      {profiles.length === 0 && (
        <p className="text-sm text-muted-foreground">
          トークプロフィールはまだありません。
        </p>
      )}

      <ul className="space-y-4" role="list">
        {profiles.map((cp, index) => (
          <ChatProfileCard
            key={cp.id}
            index={index}
            profile={cp}
            saving={saving}
            onChange={(patch) => update(cp.id, patch)}
            onPickImage={() => setSheetFor(cp.id)}
            onFile={(file) => {
              uploadFile(cp.id, file).catch((error: unknown) => {
                toast.error(`画像を設定できませんでした: ${errorMessage(error)}`)
              })
            }}
            onRemove={() => setRemoveId(cp.id)}
          />
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          id="cp-add"
          type="button"
          variant="outline"
          className="min-h-11 cursor-pointer"
          disabled={atLimit || saving || !ctrl.editable}
          onClick={() => {
            if (atLimit) return
            ctrl.edit("chatProfiles", (d) => ({
              ...d,
              chatProfiles: [...d.chatProfiles, newChatProfile()],
            }))
          }}
        >
          トークプロフィールを追加
        </Button>
        {atLimit && (
          <FieldMessage>
            {LIMIT_TEXT.chatProfiles(ctrl.limits.chatProfiles)}
          </FieldMessage>
        )}
        {messageFor("cp-add") && <FieldMessage>{messageFor("cp-add")}</FieldMessage>}
      </div>

      <ProfileImageSheet
        open={sheetFor !== null}
        onOpenChange={(open) => {
          if (!open) setSheetFor(null)
        }}
        plotId={plotId}
        title="トークプロフィール画像を設定"
        onPick={async (candidate) => {
          if (!sheetFor) throw new UserError("トークプロフィールが選ばれていません")
          await pickImage(sheetFor, candidate)
        }}
      />

      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null)
        }}
        title="トークプロフィールを削除しますか？"
        confirmLabel="削除する"
        onConfirm={() => {
          if (removeId) {
            const id = removeId
            ctrl.edit("chatProfiles", (d) => ({
              ...d,
              chatProfiles: d.chatProfiles.filter((cp) => cp.id !== id),
            }))
          }
          setRemoveId(null)
        }}
      />
    </section>
  )
}

function ChatProfileCard({
  index,
  profile,
  saving,
  onChange,
  onPickImage,
  onFile,
  onRemove,
}: {
  index: number
  profile: DraftChatProfile
  saving: boolean
  onChange: (patch: Partial<DraftChatProfile>) => void
  onPickImage: () => void
  onFile: (file: File) => void
  onRemove: () => void
}) {
  const { ctrl, messageFor } = usePlotEditor()
  const descriptionCheck = useKeywordCheck()
  const fileRef = useRef<HTMLInputElement>(null)
  const useDefault = profile.isUsingDefaultName === true
  const nameMessage = messageFor(`cp-name-${index}`)
  const imageMessage = messageFor(`cp-image-${index}`)
  const summaryMessage = messageFor(`cp-summary-${index}`)
  const descriptionMessage = messageFor(`cp-desc-${index}`)

  return (
    <li className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {profile.imageUrl ? (
            <img
              src={profile.imageUrl}
              alt={`トークプロフィール ${index + 1} の画像`}
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-center text-xs text-muted-foreground">
              画像未設定
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-end justify-between gap-2">
            <label htmlFor={`cp-name-${index}`} className="text-sm font-medium">
              名前
            </label>
            <Counter
              value={countChars(profile.name)}
              max={ctrl.limits.chatProfileName}
            />
          </div>
          <Input
            id={`cp-name-${index}`}
            value={profile.name ?? ""}
            disabled={useDefault}
            onChange={(e) => {
              const v = e.target.value
              onChange({ name: v.length > 0 ? v : null })
            }}
            placeholder={
              useDefault ? "デフォルト名を使用します" : "例) 転校生…"
            }
            autoComplete="off"
            aria-invalid={nameMessage ? true : undefined}
            aria-describedby={`cp-name-msg-${index}`}
          />
          <div id={`cp-name-msg-${index}`}>
            {nameMessage && <FieldMessage>{nameMessage}</FieldMessage>}
          </div>
          <ToggleRow
            id={`cp-default-${index}`}
            label="デフォルト名を使う"
            checked={useDefault}
            disabled={!ctrl.editable}
            onChange={(checked) => onChange({ isUsingDefaultName: checked })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-end justify-between gap-2">
          <label htmlFor={`cp-summary-${index}`} className="text-sm font-medium">
            概要
          </label>
          <Counter
            value={countChars(profile.summary)}
            max={ctrl.limits.chatProfileSummary}
          />
        </div>
        <Input
          id={`cp-summary-${index}`}
          value={profile.summary ?? ""}
          onChange={(e) => {
            const v = e.target.value
            onChange({ summary: v.length > 0 ? v : null })
          }}
          autoComplete="off"
          aria-invalid={summaryMessage ? true : undefined}
          aria-describedby={`cp-summary-msg-${index}`}
        />
        <div id={`cp-summary-msg-${index}`}>
          {summaryMessage && <FieldMessage>{summaryMessage}</FieldMessage>}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-end justify-between gap-2">
          <label htmlFor={`cp-desc-${index}`} className="text-sm font-medium">
            説明
          </label>
          <Counter
            value={countChars(profile.description)}
            max={ctrl.limits.chatProfileDescription}
          />
        </div>
        <Textarea
          id={`cp-desc-${index}`}
          value={profile.description ?? ""}
          onChange={(e) => {
            const v = e.target.value
            onChange({ description: v.length > 0 ? v : null })
          }}
          onBlur={() =>
            void descriptionCheck.check(
              "ABUSING_PLOT_PROMPT",
              profile.description
            )
          }
          rows={3}
          aria-invalid={descriptionMessage ? true : undefined}
          aria-describedby={`cp-desc-msg-${index}`}
        />
        <div id={`cp-desc-msg-${index}`} className="space-y-1">
          {descriptionMessage && <FieldMessage>{descriptionMessage}</FieldMessage>}
          {descriptionCheck.warning && (
            <FieldMessage tone="warning">
              {descriptionCheck.warning}
            </FieldMessage>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_ATTR}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 cursor-pointer"
          disabled={saving || !ctrl.editable}
          id={`cp-image-${index}`}
          aria-describedby={imageMessage ? `cp-image-msg-${index}` : undefined}
          onClick={() => fileRef.current?.click()}
        >
          <Images aria-hidden="true" />
          画像を選ぶ…
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 cursor-pointer"
          disabled={saving || !ctrl.editable}
          onClick={onPickImage}
        >
          <ImagePlus aria-hidden="true" />
          画像を生成…
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto min-h-11 cursor-pointer text-destructive hover:text-destructive"
          disabled={saving || !ctrl.editable}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
          <span>{`トークプロフィール ${index + 1} を削除…`}</span>
        </Button>
      </div>
      <IssueMessage id={`cp-image-msg-${index}`} message={imageMessage} />
    </li>
  )
}
