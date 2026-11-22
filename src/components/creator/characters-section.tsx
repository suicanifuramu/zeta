import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ImageCropDialog } from "@/components/image-crop-dialog"
import {
  addCharacterImage,
  checkPlotName,
  cropCharacterImage,
  deleteCharacterImage,
  listCharacterGallery,
  uploadCharacterImage,
} from "@/lib/api"
import { countChars, newCharacterPlaceholder } from "@/lib/plot-draft"
import { LIMIT_TEXT } from "@/lib/plot-limits"
import type { PreparedImage } from "@/lib/image-upload"
import { UserError } from "@/lib/user-error"
import type { DraftCharacter, GalleryImage, ProfileImageResult } from "@/lib/types"
import { usePlotEditor } from "@/components/creator/plot-editor-context"
import {
  ConfirmDialog,
  Counter,
  FieldMessage,
  IssueMessage,
  SectionHeading,
} from "@/components/creator/creator-ui"
import { useKeywordCheck } from "@/hooks/use-keyword-check"
import { ProfileImageSheet } from "@/components/creator/profile-image-sheet"
import { ImageGalleryDialog } from "@/components/creator/image-gallery-dialog"
import { Trash2, ImagePlus, Images } from "lucide-react"

interface CropTarget {
  characterId: string
  sourceUrl: string
}

export function CharactersSection() {
  const { plotId, ctrl, messageFor } = usePlotEditor()
  const characters = ctrl.draft.characters
  const saving = ctrl.save.phase === "saving"
  const atLimit = characters.length >= ctrl.limits.characters
  const [sheetFor, setSheetFor] = useState<string | null>(null)
  const [galleryFor, setGalleryFor] = useState<string | null>(null)
  const [crop, setCrop] = useState<CropTarget | null>(null)
  const [removeIndex, setRemoveIndex] = useState<number | null>(null)

  const loadGallery = useCallback(
    () => (galleryFor ? listCharacterGallery(plotId, galleryFor) : Promise.resolve<GalleryImage[]>([])),
    [galleryFor, plotId]
  )

  /** The character must exist on the server before its gallery can be used. */
  async function ensureSaved() {
    await ctrl.flush()
  }

  async function uploadToGallery(characterId: string, image: PreparedImage) {
    await ensureSaved()
    await uploadCharacterImage(plotId, characterId, image)
  }

  /** Gallery item → main image: the item is already on the server, so crop it directly. */
  function cropFromGallery(characterId: string, item: GalleryImage) {
    setCrop({ characterId, sourceUrl: item.imageUrl })
  }

  /** Sets one character's image in the draft (autosaved). */
  function setCharacterImage(characterId: string, url: string) {
    ctrl.edit("characters", (d) => ({
      ...d,
      characters: d.characters.map((c) =>
        c.id === characterId ? { ...c, imageUrl: url } : c
      ),
    }))
  }

  async function pickCharacterImage(
    characterId: string,
    candidate: ProfileImageResult
  ) {
    // The character must exist on the server before images can be attached.
    await ctrl.flush()
    const results = await addCharacterImage(
      plotId,
      characterId,
      candidate.imageUrl
    )
    const sourceUrl = results.find(
      (r) => r.type === "Success" && r.imageUrl
    )?.imageUrl
    if (!sourceUrl) throw new UserError("キャラクター画像を登録できませんでした")
    setCrop({ characterId, sourceUrl })
  }

  function addCharacter() {
    if (atLimit) return
    ctrl.edit("characters", (d) => ({
      ...d,
      characters: [...d.characters, newCharacterPlaceholder()],
    }))
  }

  function removeCharacter(index: number) {
    const target = characters[index]
    const removedId = target?.id
    ctrl.edit("characters", (d) => ({
      ...d,
      characters: d.characters.filter((_, i) => i !== index),
    }))
    if (removedId) {
      // Intro lines spoken by the removed character go with it.
      ctrl.edit("intros", (d) => ({
        ...d,
        intros: d.intros.map((intro) => ({
          ...intro,
          conversation: {
            ...intro.conversation,
            messages: intro.conversation.messages.filter(
              (m) =>
                !(
                  m.type === "text" &&
                  (m as { senderId?: unknown }).senderId === removedId
                )
            ),
          },
        })),
      }))
    }
    // The published "about" mirror of the character list is refreshed on the same save.
    ctrl.edit("publicity", (d) => d)
  }

  return (
    <section aria-labelledby="characters-heading" className="space-y-4">
      <SectionHeading
        id="characters-heading"
        title="キャラクター"
        description="名前と説明、画像を設定します。キャラクター画像は正方形に切り抜きます。"
        aside={
          <Counter value={characters.length} max={ctrl.limits.characters} />
        }
      />

      {characters.length === 0 && (
        <p className="text-sm text-muted-foreground">
          キャラクターがまだありません。
        </p>
      )}

      <ul className="space-y-4" role="list">
        {characters.map((character, index) => (
          <CharacterCard
            // Index key: a placeholder's id changes after save, and a remount would drop focus.
            key={index}
            index={index}
            character={character}
            saving={saving}
            onName={(name) => {
              ctrl.edit("characters", (d) => ({
                ...d,
                characters: d.characters.map((c, i) =>
                  i === index ? { ...c, name } : c
                ),
              }))
              ctrl.edit("publicity", (d) => d)
            }}
            onDescription={(description) => {
              ctrl.edit("characters", (d) => ({
                ...d,
                characters: d.characters.map((c, i) =>
                  i === index ? { ...c, description } : c
                ),
              }))
              ctrl.edit("publicity", (d) => d)
            }}
            onPickImage={() => setSheetFor(character.id ?? null)}
            onOpenGallery={() => setGalleryFor(character.id ?? null)}
            onRemove={() => setRemoveIndex(index)}
          />
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          id="char-add"
          type="button"
          variant="outline"
          className="min-h-11 cursor-pointer"
          onClick={addCharacter}
          aria-describedby={messageFor("char-add") ? "char-add-msg" : undefined}
          disabled={atLimit || saving}
        >
          キャラクターを追加
        </Button>
        {atLimit && (
          <FieldMessage>{LIMIT_TEXT.characters(ctrl.limits.characters)}</FieldMessage>
        )}
        {saving && (
          <FieldMessage tone="hint">
            保存が終わるまで追加・削除はできません。
          </FieldMessage>
        )}
        <IssueMessage id="char-add-msg" message={messageFor("char-add")} />
      </div>

      <ProfileImageSheet
        open={sheetFor !== null}
        onOpenChange={(open) => {
          if (!open) setSheetFor(null)
        }}
        plotId={plotId}
        title="キャラクター画像を設定"
        onPick={async (candidate) => {
          if (!sheetFor) throw new UserError("キャラクターが選ばれていません")
          await pickCharacterImage(sheetFor, candidate)
        }}
      />

      <ImageGalleryDialog
        open={galleryFor !== null}
        onOpenChange={(open) => {
          if (!open) setGalleryFor(null)
        }}
        title="キャラクターの画像"
        load={loadGallery}
        upload={async (image) => {
          if (!galleryFor) throw new UserError("キャラクターが選ばれていません")
          await uploadToGallery(galleryFor, image)
        }}
        remove={async (sequence) => {
          if (!galleryFor) throw new UserError("キャラクターが選ばれていません")
          await ensureSaved()
          await deleteCharacterImage(plotId, galleryFor, sequence)
        }}
        onMain={(item) => {
          if (galleryFor) cropFromGallery(galleryFor, item)
        }}
      />

      {crop && (
        <ImageCropDialog
          open
          onOpenChange={(open) => {
            if (!open) setCrop(null)
          }}
          imageUrl={crop.sourceUrl}
          cropShape="rect"
          title="キャラクター画像をトリミング"
          confirmLabel="設定する"
          skipLabel="トリミングせずに設定"
          onCropConfirm={async (coords) => {
            const url = await cropCharacterImage(
              plotId,
              crop.characterId,
              crop.sourceUrl,
              coords
            )
            setCharacterImage(crop.characterId, url)
          }}
          onSkipCrop={() => {
            setCharacterImage(crop.characterId, crop.sourceUrl)
          }}
        />
      )}

      <ConfirmDialog
        open={removeIndex !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveIndex(null)
        }}
        title="キャラクターを削除しますか？"
        description="該当キャラを使用したイントロ・紹介文も削除されます"
        confirmLabel="削除する"
        onConfirm={() => {
          if (removeIndex !== null) removeCharacter(removeIndex)
          setRemoveIndex(null)
        }}
      />
    </section>
  )
}

function CharacterCard({
  index,
  character,
  saving,
  onName,
  onDescription,
  onPickImage,
  onOpenGallery,
  onRemove,
}: {
  index: number
  character: DraftCharacter
  saving: boolean
  onName: (name: string | null) => void
  onDescription: (description: string | null) => void
  onPickImage: () => void
  onOpenGallery: () => void
  onRemove: () => void
}) {
  const { ctrl, messageFor } = usePlotEditor()
  const nameCheck = useKeywordCheck()
  const descriptionCheck = useKeywordCheck()
  const [nameWarning, setNameWarning] = useState<string | null>(null)
  const nameLength = countChars(character.name)
  const nameMessage = messageFor(`char-name-${index}`)
  const descriptionMessage = messageFor(`char-desc-${index}`)
  const hasId = Boolean(character.id)
  // Problems of this character's image (publish rule: characters[0] only) and its disabled-state hint.
  const imageMessage = messageFor(`char-image-${index}`)
  const imageDescribedBy =
    [!hasId ? `char-image-hint-${index}` : null, imageMessage ? `char-image-msg-${index}` : null]
      .filter(Boolean)
      .join(" ") || undefined
  const label = character.name?.trim()
    ? character.name
    : `キャラクター ${index + 1}`

  async function checkNameOnBlur() {
    const name = character.name ?? ""
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

  return (
    <li className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex gap-4">
        <div className="size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {character.imageUrl ? (
            <img
              src={character.imageUrl}
              alt={`${label}の画像`}
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
            <label
              htmlFor={`char-name-${index}`}
              className="text-sm font-medium"
            >
              キャラ名
            </label>
            <Counter value={nameLength} max={ctrl.limits.characterName} />
          </div>
          <Input
            id={`char-name-${index}`}
            value={character.name ?? ""}
            onChange={(e) => {
              const v = e.target.value
              onName(v.length > 0 ? v : null)
            }}
            onBlur={() => {
              void nameCheck.check("ABUSING_PLOT_PROMPT", character.name)
              void checkNameOnBlur()
            }}
            aria-invalid={nameMessage ? true : undefined}
            aria-describedby={`char-name-msg-${index}`}
            autoComplete="off"
          />
          <div id={`char-name-msg-${index}`} className="space-y-1">
            {nameMessage && <FieldMessage>{nameMessage}</FieldMessage>}
            {nameWarning && (
              <FieldMessage tone="warning">{nameWarning}</FieldMessage>
            )}
            {nameCheck.warning && (
              <FieldMessage tone="warning">{nameCheck.warning}</FieldMessage>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`char-desc-${index}`} className="text-sm font-medium">
          キャラクター説明
        </label>
        <Textarea
          id={`char-desc-${index}`}
          value={character.description ?? ""}
          onChange={(e) => {
            const v = e.target.value
            onDescription(v.length > 0 ? v : null)
          }}
          onBlur={() =>
            void descriptionCheck.check(
              "ABUSING_PLOT_PROMPT",
              character.description
            )
          }
          rows={3}
          placeholder="キャラクターの外見的特徴、性格、趣味などを記入…"
          aria-describedby={`char-desc-msg-${index}`}
        />
        <div id={`char-desc-msg-${index}`} className="space-y-1">
          {descriptionMessage && <FieldMessage>{descriptionMessage}</FieldMessage>}
          {descriptionCheck.warning && (
            <FieldMessage tone="warning">
              {descriptionCheck.warning}
            </FieldMessage>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          id={`char-image-${index}`}
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 cursor-pointer"
          disabled={!hasId || saving || !ctrl.editable}
          onClick={onPickImage}
          aria-describedby={imageDescribedBy}
        >
          <ImagePlus aria-hidden="true" />
          画像を生成…
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 cursor-pointer"
          disabled={!hasId || saving || !ctrl.editable}
          onClick={onOpenGallery}
        >
          <Images aria-hidden="true" />
          画像を選ぶ…
        </Button>
        {!hasId && (
          <span
            id={`char-image-hint-${index}`}
            className="text-xs text-muted-foreground"
          >
            保存が終わると設定できます
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto min-h-11 cursor-pointer text-destructive hover:text-destructive"
          disabled={saving}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
          <span>{`${label}を削除…`}</span>
        </Button>
      </div>
      <IssueMessage id={`char-image-msg-${index}`} message={imageMessage} />
    </li>
  )
}
