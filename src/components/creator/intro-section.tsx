import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  CHARACTER_ITEM_LABELS,
  SCENE_LABELS,
  introTotalChars,
  newIntro,
  newTempId,
} from "@/lib/plot-draft"
import { LIMIT_TEXT } from "@/lib/plot-limits"
import type {
  DraftInfoBoxItem,
  DraftInfoBoxScene,
  DraftIntro,
  DraftIntroTextMessage,
} from "@/lib/types"
import { usePlotEditor } from "@/components/creator/plot-editor-context"
import {
  Counter,
  FieldMessage,
  IssueMessage,
  SectionHeading,
  ToggleRow,
} from "@/components/creator/creator-ui"
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react"

const NARRATOR_ID = "_NARRATOR_"

const DEFAULT_SCENES: DraftInfoBoxScene[] = [
  { type: "DATE", enabled: true, format: "DATE" },
  { type: "TIME", enabled: true },
  { type: "LOCATION", enabled: true },
  { type: "SITUATION", enabled: true },
  { type: "WEATHER", enabled: true },
]

const DEFAULT_CHARACTER_ITEMS: DraftInfoBoxItem[] = Object.keys(
  CHARACTER_ITEM_LABELS
).map((type) => ({
  type,
  enabled: true,
}))

export function IntroSection() {
  const { ctrl, messageFor } = usePlotEditor()
  const intro: DraftIntro | null = ctrl.draft.intros[0] ?? null
  const messages = intro?.conversation.messages ?? []
  const atMessageLimit = messages.length >= ctrl.limits.introMessages
  const introChars = introTotalChars(ctrl.draft)
  const characters = ctrl.draft.characters.filter((c) => c.id)
  const choiceCount = intro?.conversation.cyoaChoices?.choices.length ?? 0
  const cyoa = ctrl.draft.cyoaSetting
  const infoBox = ctrl.draft.infoBoxSetting

  /** Edits the first intro. Only the text messages of the intro are changed by this UI. */
  function updateIntro(fn: (intro: DraftIntro) => DraftIntro) {
    ctrl.edit("intros", (d) => {
      const base = d.intros[0] ?? newIntro()
      return { ...d, intros: [fn(base), ...d.intros.slice(1)] }
    })
  }

  function updateMessages(
    fn: (
      list: DraftIntro["conversation"]["messages"]
    ) => DraftIntro["conversation"]["messages"]
  ) {
    updateIntro((i) => ({
      ...i,
      conversation: {
        ...i.conversation,
        messages: fn(i.conversation.messages),
      },
    }))
  }

  function addText() {
    const message: DraftIntroTextMessage = {
      type: "text",
      content: "",
      senderType: "BOT",
      senderId: NARRATOR_ID,
      tempId: newTempId(),
    }
    updateMessages((list) => [...list, message])
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="intro-messages" className="space-y-4">
        <SectionHeading
          id="intro-messages"
          title="イントロ"
          description="プレイ開始時に表示される最初の文章です。インフォボックスや画像などの項目は、この画面では編集せず、内容をそのまま保持します。"
          aside={<Counter value={introChars} max={ctrl.limits.introTotal} />}
        />
        {messageFor("intro-total") && (
          <FieldMessage id="intro-total">{messageFor("intro-total")}</FieldMessage>
        )}

        {!intro && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 cursor-pointer"
            id="intro-create"
            aria-describedby={messageFor("intro-create") ? "intro-create-msg" : undefined}
            onClick={() =>
              ctrl.edit("intros", (d) => ({ ...d, intros: [newIntro()] }))
            }
          >
            イントロを作成
          </Button>
        )}
        {!intro && <IssueMessage id="intro-create-msg" message={messageFor("intro-create")} />}

        {intro && (
          <>
            <ol className="space-y-3" aria-label="イントロの項目">
              {messages.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  項目はまだありません。
                </li>
              )}
              {messages.map((message, index) => (
                <IntroMessageRow
                  // Index key: the server rewrites tempIds on every save, so they are not stable keys (LIVE B5).
                  key={index}
                  index={index}
                  total={messages.length}
                  message={message}
                  characters={characters}
                  onChange={(next) =>
                    updateMessages((list) =>
                      list.map((m, i) => (i === index ? next : m))
                    )
                  }
                  onRemove={() =>
                    updateMessages((list) => list.filter((_, i) => i !== index))
                  }
                  onMove={(delta) =>
                    updateMessages((list) => {
                      const target = index + delta
                      if (target < 0 || target >= list.length) return list
                      const copy = [...list]
                      ;[copy[index], copy[target]] = [copy[target], copy[index]]
                      return copy
                    })
                  }
                />
              ))}
            </ol>
            <Button
              id="intro-add"
              type="button"
              variant="outline"
              className="min-h-11 cursor-pointer"
              disabled={atMessageLimit}
              aria-describedby={messageFor("intro-add") ? "intro-add-msg" : undefined}
              onClick={addText}
            >
              テキストを追加
            </Button>
            {atMessageLimit && (
              <FieldMessage>{LIMIT_TEXT.introMessages(ctrl.limits.introMessages)}</FieldMessage>
            )}
            {!atMessageLimit && <IssueMessage id="intro-add-msg" message={messageFor("intro-add")} />}
          </>
        )}
      </section>

      <section aria-labelledby="intro-cyoa" className="space-y-2">
        <SectionHeading id="intro-cyoa" title="ユーザーターンの選択肢" />
        <ToggleRow
          id="cyoa-enabled"
          label="ユーザーターンに選択肢を提供"
          checked={cyoa?.enabled === true}
          onChange={(checked) =>
            ctrl.edit("settings", (d) => ({
              ...d,
              cyoaSetting: {
                ...(d.cyoaSetting ?? { type: "DIALOGUE" }),
                enabled: checked,
              },
            }))
          }
        />
        {choiceCount > 0 && (
          <FieldMessage tone="hint">
            イントロの選択肢（{choiceCount}
            件）はこの画面では編集できません。内容は保持されます。
          </FieldMessage>
        )}
        {messageFor("intro-cyoa") && <FieldMessage id="intro-cyoa-msg">{messageFor("intro-cyoa")}</FieldMessage>}
      </section>

      <section aria-labelledby="intro-infobox" className="space-y-3">
        <SectionHeading
          id="intro-infobox"
          title="インフォボックス"
          description="状況や気分などを画面の情報欄に表示します。"
        />
        <ToggleRow
          id="infobox-enabled"
          label="インフォボックスを使う"
          checked={infoBox !== null}
          onChange={(checked) =>
            ctrl.edit("settings", (d) => ({
              ...d,
              infoBoxSetting: checked
                ? {
                    scenes: DEFAULT_SCENES.map((s) => ({ ...s })),
                    characters: DEFAULT_CHARACTER_ITEMS.map((c) => ({ ...c })),
                  }
                : null,
            }))
          }
        />
        {infoBox && (
          <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
            <fieldset className="min-w-0 space-y-1">
              <legend className="mb-1 text-sm font-medium">情報（場面）</legend>
              {infoBox.scenes.map((scene, index) => (
                <div key={scene.type} className="space-y-1">
                  <ToggleRow
                    id={`scene-${scene.type}`}
                    label={SCENE_LABELS[scene.type] ?? scene.type}
                    checked={scene.enabled === true}
                    onChange={(checked) =>
                      setInfoBoxScene(ctrl, index, { enabled: checked })
                    }
                  />
                  {scene.type === "DATE" && scene.enabled === true && (
                    <div className="pl-7">
                      <label htmlFor="scene-date-format" className="sr-only">
                        日付の表示形式
                      </label>
                      <select
                        id="scene-date-format"
                        value={scene.format ?? "DATE"}
                        onChange={(e) =>
                          setInfoBoxScene(ctrl, index, {
                            format: e.target.value,
                          })
                        }
                        className="h-11 rounded-lg border border-input bg-background px-3 text-base text-foreground"
                      >
                        <option value="DATE">日付</option>
                        <option value="DAY_COUNT">時間経過</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </fieldset>
            <fieldset className="min-w-0 space-y-1">
              <legend className="mb-1 text-sm font-medium">
                キャラクターの情報
              </legend>
              {infoBox.characters.map((item, index) => (
                <ToggleRow
                  key={item.type}
                  id={`char-item-${item.type}`}
                  label={CHARACTER_ITEM_LABELS[item.type] ?? item.type}
                  checked={item.enabled === true}
                  onChange={(checked) =>
                    setInfoBoxCharacterItem(ctrl, index, checked)
                  }
                />
              ))}
            </fieldset>
          </div>
        )}
      </section>
    </div>
  )
}

function setInfoBoxScene(
  ctrl: ReturnType<typeof usePlotEditor>["ctrl"],
  index: number,
  patch: Partial<DraftInfoBoxScene>
) {
  ctrl.edit("settings", (d) => {
    if (!d.infoBoxSetting) return d
    const scenes = d.infoBoxSetting.scenes.map((s, i) =>
      i === index ? { ...s, ...patch } : s
    )
    return { ...d, infoBoxSetting: { ...d.infoBoxSetting, scenes } }
  })
}

function setInfoBoxCharacterItem(
  ctrl: ReturnType<typeof usePlotEditor>["ctrl"],
  index: number,
  enabled: boolean
) {
  ctrl.edit("settings", (d) => {
    if (!d.infoBoxSetting) return d
    const characters = d.infoBoxSetting.characters.map((c, i) =>
      i === index ? { ...c, enabled } : c
    )
    return { ...d, infoBoxSetting: { ...d.infoBoxSetting, characters } }
  })
}

function IntroMessageRow({
  index,
  total,
  message,
  characters,
  onChange,
  onRemove,
  onMove,
}: {
  index: number
  total: number
  message: DraftIntro["conversation"]["messages"][number]
  characters: { id?: string; name?: string | null }[]
  onChange: (next: DraftIntro["conversation"]["messages"][number]) => void
  onRemove: () => void
  onMove: (delta: number) => void
}) {
  const isText = message.type === "text"
  const text = message as DraftIntroTextMessage

  const toolbar = (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 cursor-pointer"
        aria-label={`項目 ${index + 1} を上へ移動`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 cursor-pointer"
        aria-label={`項目 ${index + 1} を下へ移動`}
        disabled={index === total - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 cursor-pointer text-destructive hover:text-destructive"
        aria-label={`項目 ${index + 1} を削除`}
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  )

  if (!isText) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3">
        <span className="text-sm text-muted-foreground">
          {message.type === "infoBox" ? "インフォボックス" : "画像などの項目"}
          （この画面では編集できません。内容は保持されます）
        </span>
        {toolbar}
      </li>
    )
  }

  const senderValue =
    text.senderId === NARRATOR_ID
      ? "narrator"
      : text.senderType === "USER" || text.senderId === null
        ? "user"
        : `char:${text.senderId}`
  const knownCharacter = characters.some((c) => `char:${c.id}` === senderValue)

  return (
    <li className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`intro-sender-${index}`} className="text-sm">
          話者
        </label>
        <select
          id={`intro-sender-${index}`}
          value={senderValue}
          onChange={(e) => {
            const v = e.target.value
            if (v === "narrator")
              onChange({ ...text, senderType: "BOT", senderId: NARRATOR_ID })
            else if (v === "user")
              onChange({ ...text, senderType: "USER", senderId: null })
            else
              onChange({
                ...text,
                senderType: "BOT",
                senderId: v.slice("char:".length),
              })
          }}
          className="h-11 max-w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground"
        >
          <option value="narrator">ナレーター</option>
          <option value="user">ユーザー</option>
          {characters.map((c) => (
            <option key={c.id} value={`char:${c.id}`}>
              {c.name?.trim() ? c.name : "（名前未設定）"}
            </option>
          ))}
          {!knownCharacter && senderValue.startsWith("char:") && (
            <option value={senderValue}>（削除済みのキャラクター）</option>
          )}
        </select>
        <div className="ml-auto">{toolbar}</div>
      </div>
      <label htmlFor={`intro-text-${index}`} className="sr-only">
        イントロの文章 {index + 1}
      </label>
      <Textarea
        id={`intro-text-${index}`}
        value={text.content ?? ""}
        rows={3}
        onChange={(e) => onChange({ ...text, content: e.target.value })}
      />
    </li>
  )
}
