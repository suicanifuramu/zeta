import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DraftStylePreset } from "@/lib/types"
import { usePlotEditor } from "@/components/creator/plot-editor-context"
import { FieldMessage, SectionHeading } from "@/components/creator/creator-ui"

type ScalarKey =
  | "difficulty"
  | "pacing"
  | "pov"
  | "tense"
  | "responseLength"
  | "developmentStyle"

interface Option {
  value: string
  label: string
}

/** Enum values seen in the official app, with its Japanese labels. */
const SCALAR_GROUPS: { key: ScalarKey; label: string; options: Option[] }[] = [
  {
    key: "difficulty",
    label: "難易度",
    options: [
      { value: "EASY", label: "簡単" },
      { value: "NORMAL", label: "普通" },
      { value: "HARD", label: "難しい" },
      { value: "NIGHTMARE", label: "極限" },
    ],
  },
  {
    key: "pacing",
    label: "展開の速さ",
    options: [
      { value: "SLOW", label: "遅い" },
      { value: "NATURAL", label: "自然" },
      { value: "FAST", label: "速い" },
    ],
  },
  {
    key: "pov",
    label: "視点",
    options: [
      { value: "FIRST_PERSON", label: "一人称" },
      { value: "SECOND_PERSON", label: "二人称" },
      { value: "THIRD_PERSON", label: "三人称" },
    ],
  },
  {
    key: "tense",
    label: "時制",
    options: [
      { value: "PAST", label: "過去形" },
      { value: "PRESENT", label: "現在形" },
    ],
  },
  {
    key: "responseLength",
    label: "返答の長さ",
    options: [
      { value: "SHORT", label: "短い" },
      { value: "LONG", label: "長い" },
      { value: "DYNAMIC", label: "自動" },
    ],
  },
  {
    key: "developmentStyle",
    label: "ストーリー展開",
    options: [
      { value: "DEFAULT", label: "基本" },
      { value: "DIALOGUE_FOCUSED", label: "会話多め" },
      { value: "ACTION_FOCUSED", label: "行動多め" },
    ],
  },
]

const MOOD_OPTIONS: Option[] = [
  { value: "ROMANCE", label: "ロマンス" },
  { value: "HEALING", label: "癒し" },
  { value: "ANGST", label: "シリアス" },
  { value: "YANDERE", label: "ヤンデレ" },
  { value: "FANTASY", label: "ファンタジー" },
  { value: "ACTION", label: "アクション" },
  { value: "MYSTERY", label: "ミステリー" },
  { value: "HORROR", label: "ホラー" },
]

/** Values observed in the official app's requests. The complete list is not confirmed. */
const STORYTELLING_OPTIONS: Option[] = [
  { value: "JANE_AUSTEN", label: "恋愛心理小説" },
  { value: "DON_WINSLOW", label: "ハードボイルド" },
  { value: "HENRY_MILLER", label: "夜想文学" },
  { value: "LOUISA_MAY_ALCOTT", label: "温かな青春物語" },
  { value: "QUENTIN_TARANTINO", label: "アクション" },
  { value: "NISIO_ISIN", label: "ライトノベル" },
  { value: "STEPHEN_KING", label: "心理ホラー" },
]

export function StyleSection() {
  const { ctrl } = usePlotEditor()
  const preset: DraftStylePreset | null = ctrl.draft.stylePreset

  function patch(
    next: Partial<DraftStylePreset>,
    remove: (keyof DraftStylePreset)[] = []
  ) {
    ctrl.edit("settings", (d) => {
      const base: Record<string, unknown> = { ...(d.stylePreset ?? {}) }
      for (const key of remove) delete base[key]
      return { ...d, stylePreset: { ...base, ...next } as DraftStylePreset }
    })
  }

  function setScalar(key: ScalarKey, value: string | null) {
    if (value === null) patch({}, [key])
    else patch({ [key]: value } as Partial<DraftStylePreset>)
  }

  function toggleMood(value: string) {
    const current = preset?.moods ?? []
    const next = current.includes(value)
      ? current.filter((m) => m !== value)
      : [...current, value]
    patch({ moods: next })
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        id="style-heading"
        title="ストーリー演出"
        description="文章の書き方や展開の傾向を設定します。未設定の項目はAIが決めます。"
        aside={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 cursor-pointer"
            disabled={preset === null}
            onClick={() =>
              ctrl.edit("settings", (d) => ({ ...d, stylePreset: null }))
            }
          >
            設定しない
          </Button>
        }
      />
      {preset === null && (
        <FieldMessage tone="hint">演出は設定されていません。</FieldMessage>
      )}

      {SCALAR_GROUPS.map((group) => (
        <fieldset key={group.key} className="space-y-2">
          <legend className="text-sm font-medium">{group.label}</legend>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const active = preset?.[group.key] === option.value
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  className={cn("min-h-11 cursor-pointer")}
                  onClick={() =>
                    setScalar(group.key, active ? null : option.value)
                  }
                >
                  {option.label}
                </Button>
              )
            })}
          </div>
        </fieldset>
      ))}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">雰囲気（複数選択）</legend>
        <div className="flex flex-wrap gap-2">
          {MOOD_OPTIONS.map((option) => {
            const active = (preset?.moods ?? []).includes(option.value)
            return (
              <Button
                key={option.value}
                type="button"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                className="min-h-11 cursor-pointer"
                onClick={() => toggleMood(option.value)}
              >
                {option.label}
              </Button>
            )
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="style-storytelling" className="text-sm font-medium">
          文章スタイル
        </label>
        <select
          id="style-storytelling"
          value={preset?.storytellingStyle ?? ""}
          onChange={(e) => {
            const v = e.target.value
            if (v === "") patch({ storytellingStyle: null })
            else patch({ storytellingStyle: v })
          }}
          className="h-11 w-full max-w-sm rounded-lg border border-input bg-background px-3 text-base text-foreground"
        >
          <option value="">設定しない</option>
          {STORYTELLING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
