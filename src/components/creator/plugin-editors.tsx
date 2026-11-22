import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2 } from "lucide-react"
import { Counter, FieldMessage } from "@/components/creator/creator-ui"
import { countChars } from "@/lib/plot-draft"
import type { PlotLimits } from "@/lib/plot-limits"
import type { DiceTheme, WallpaperPreset } from "@/lib/types"
import { asObj, hasPhoneWallpaper } from "@/lib/plugin-rules"

/**
 * Editors for the plugin values that this screen supports (ds-max PHASE3 §1.3).
 * Every editor copies the value with a spread, so keys it does not edit survive.
 * Limits come from the per-language table (ctx.limits); nothing is hard-coded here.
 */

export type Obj = Record<string, unknown>

export interface EditorContext {
  /** Prefix for DOM ids; unique per plugin. */
  idPrefix: string
  characters: { id: string; name: string }[]
  /** In draft order: the index is the `seq` used by rank-chart members. */
  chatProfiles: { id: string; name: string }[]
  limits: PlotLimits
  diceThemes: DiceTheme[]
  wallpapers: WallpaperPreset[]
}

export interface EditorProps {
  value: Obj
  onChange: (next: Obj) => void
  ctx: EditorContext
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : ""
}

const SELECT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground md:max-w-sm"

function TextField({
  id,
  label,
  value,
  max,
  onChange,
  placeholder,
  multiline = false,
}: {
  id: string
  label: string
  value: string
  max?: number
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {max !== undefined && <Counter value={countChars(value)} max={max} />}
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={3}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

function CheckRow({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 text-sm disabled:cursor-not-allowed"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
      />
      <span>{label}</span>
    </label>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="min-h-11 shrink-0 cursor-pointer text-destructive hover:text-destructive"
      aria-label={label}
      onClick={onClick}
    >
      <Trash2 aria-hidden="true" />
    </Button>
  )
}

function AddButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 cursor-pointer"
      disabled={disabled}
      onClick={onClick}
    >
      <Plus aria-hidden="true" />
      {label}
    </Button>
  )
}

/** Dice: when the dice roll happens, and which theme. */
export function DiceEditor({ value, onChange, ctx }: EditorProps) {
  const p = ctx.idPrefix
  const frequency = value.frequency === "ALWAYS" ? "ALWAYS" : "DECISIVE"
  const themeId = asStr(value.themeId) || "default"
  // A theme id the server listed no longer for is still shown (and kept) so nothing changes silently.
  const themes: DiceTheme[] = ctx.diceThemes.some((t) => t.id === themeId)
    ? ctx.diceThemes
    : [{ id: themeId, name: themeId }, ...ctx.diceThemes]
  const frequencies = [
    { key: "DECISIVE", label: "重要な場面のみ" },
    { key: "ALWAYS", label: "毎回" },
  ] as const

  return (
    <div className="space-y-4">
      <fieldset className="space-y-1">
        <legend className="mb-1 text-sm font-medium">振る頻度</legend>
        {frequencies.map((f) => (
          <label
            key={f.key}
            className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
          >
            <input
              type="radio"
              name={`${p}-frequency`}
              value={f.key}
              checked={frequency === f.key}
              onChange={() => onChange({ ...value, frequency: f.key })}
              className="size-4 accent-primary"
            />
            {f.label}
          </label>
        ))}
      </fieldset>
      <div className="space-y-1.5">
        <label htmlFor={`${p}-theme`} className="text-sm font-medium">
          テーマ
        </label>
        <select
          id={`${p}-theme`}
          value={themeId}
          onChange={(e) => onChange({ ...value, themeId: e.target.value })}
          className={SELECT_CLASS}
        >
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/** Message: the characters that can start a conversation (at least one). */
export function MessageEditor({ value, onChange, ctx }: EditorProps) {
  const selected = new Set(asArr(value.initialContactCharacterIds).map(asStr))
  const options = ctx.characters.filter((c) => c.id)
  return (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-sm font-medium">基本の連絡先</legend>
      {options.length === 0 && (
        <p className="text-sm text-muted-foreground">
          キャラクターを追加すると選べます。
        </p>
      )}
      {options.map((c) => (
        <CheckRow
          key={c.id}
          id={`${ctx.idPrefix}-contact-${c.id}`}
          label={c.name || "（名前未設定）"}
          checked={selected.has(c.id)}
          onChange={(on) => {
            const next = on
              ? [...selected, c.id]
              : [...selected].filter((id) => id !== c.id)
            onChange({ ...value, initialContactCharacterIds: next })
          }}
        />
      ))}
    </fieldset>
  )
}

interface RankMember {
  type: string
  name?: string
  seq?: number
}

/** Rank chart: a title and 2–5 tiers, each with members (characters or chat profiles). */
export function RankChartEditor({ value, onChange, ctx }: EditorProps) {
  const p = ctx.idPrefix
  const ranks = asArr(value.ranks).map(asObj)
  const title = asStr(value.title)
  const setRanks = (next: Obj[]) => onChange({ ...value, ranks: next })

  function setRank(index: number, patch: Obj) {
    setRanks(ranks.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function toggleMember(index: number, member: RankMember, on: boolean) {
    const current = asArr(ranks[index]?.members).map(asObj)
    const same = (m: Obj) =>
      m.type === member.type &&
      (member.type === "CHARACTER" ? m.name === member.name : m.seq === member.seq)
    const next = on ? [...current.filter((m) => !same(m)), { ...member }] : current.filter((m) => !same(m))
    setRank(index, { members: next })
  }

  return (
    <div className="space-y-5">
      <TextField
        id={`${p}-title`}
        label="リスト名"
        value={title}
        max={ctx.limits.rankTitle}
        onChange={(v) => onChange({ ...value, title: v })}
      />
      {ranks.map((rank, index) => {
        const rankName = asStr(rank.name)
        const members = asArr(rank.members).map(asObj)
        return (
          <section
            key={index}
            aria-label={`ティア ${index + 1}`}
            className="space-y-3 rounded-lg border border-border p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold">ティア {index + 1}</h4>
              <RemoveButton
                label={`ティア ${index + 1} を削除`}
                onClick={() => setRanks(ranks.filter((_, i) => i !== index))}
              />
            </div>
            <TextField
              id={`${p}-rank-name-${index}`}
              label="ティア名"
              value={rankName}
              max={ctx.limits.rankName}
              onChange={(v) => setRank(index, { name: v })}
            />
            <TextField
              id={`${p}-rank-desc-${index}`}
              label="説明"
              value={asStr(rank.description)}
              max={ctx.limits.rankDescription}
              multiline
              onChange={(v) => setRank(index, { description: v })}
            />
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-medium">メンバー</legend>
              {ctx.characters.map((c) => {
                const checked = members.some((m) => m.type === "CHARACTER" && m.name === c.name)
                return (
                  <CheckRow
                    key={`c-${c.id}`}
                    id={`${p}-rank-${index}-c-${c.id}`}
                    label={`キャラクター: ${c.name || "（名前未設定）"}`}
                    checked={checked}
                    onChange={(on) =>
                      toggleMember(index, { type: "CHARACTER", name: c.name }, on)
                    }
                  />
                )
              })}
              {ctx.chatProfiles.map((cp, seq) => {
                const checked = members.some((m) => m.type === "PLOT_PROFILE" && m.seq === seq)
                return (
                  <CheckRow
                    key={`p-${cp.id}`}
                    id={`${p}-rank-${index}-p-${cp.id}`}
                    label={`トークプロフィール: ${cp.name || `${seq + 1}番目`}`}
                    checked={checked}
                    onChange={(on) =>
                      toggleMember(index, { type: "PLOT_PROFILE", seq }, on)
                    }
                  />
                )
              })}
            </fieldset>
          </section>
        )
      })}
      <AddButton
        label="ティアを追加"
        disabled={ranks.length >= ctx.limits.rankCount}
        onClick={() =>
          setRanks([...ranks, { name: "", description: "", members: [] }])
        }
      />
      {ranks.length <= ctx.limits.rankMinCount && (
        <FieldMessage tone="hint">ティアは{ctx.limits.rankMinCount}〜{ctx.limits.rankCount}個まで作成できます。</FieldMessage>
      )}
    </div>
  )
}

/** Live chat: the messages shown at the start. The donation amount, if any, is kept as is. */
export function LiveChatEditor({ value, onChange, ctx }: EditorProps) {
  const p = ctx.idPrefix
  const entries = asArr(value.entries).map(asObj)
  const setEntries = (next: Obj[]) => onChange({ ...value, entries: next })
  const hasViewers = typeof value.viewers === "number"

  return (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <section
          key={index}
          aria-label={`チャット ${index + 1}`}
          className="space-y-3 rounded-lg border border-border p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold">チャット {index + 1}</h4>
            <RemoveButton
              label={`チャット ${index + 1} を削除`}
              onClick={() => setEntries(entries.filter((_, i) => i !== index))}
            />
          </div>
          <TextField
            id={`${p}-entry-name-${index}`}
            label="ニックネーム"
            value={asStr(entry.name)}
            max={ctx.limits.liveChatName}
            onChange={(v) =>
              setEntries(entries.map((e, i) => (i === index ? { ...e, name: v } : e)))
            }
          />
          <TextField
            id={`${p}-entry-text-${index}`}
            label="チャットの内容"
            value={asStr(entry.text)}
            max={ctx.limits.liveChatText}
            multiline
            onChange={(v) =>
              setEntries(entries.map((e, i) => (i === index ? { ...e, text: v } : e)))
            }
          />
        </section>
      ))}
      <AddButton
        label="チャットを追加"
        disabled={entries.length >= ctx.limits.liveChatEntries}
        onClick={() => setEntries([...entries, { name: "", text: "" }])}
      />
      <CheckRow
        id={`${p}-viewers-on`}
        label="視聴者数を表示する"
        checked={hasViewers}
        onChange={(on) => {
          const next = { ...value }
          if (on) next.viewers = 0
          else delete next.viewers
          onChange(next)
        }}
      />
      {hasViewers && (
        <div className="space-y-1.5">
          <label htmlFor={`${p}-viewers`} className="text-sm font-medium">
            視聴者数
          </label>
          <Input
            id={`${p}-viewers`}
            type="number"
            inputMode="numeric"
            min={0}
            value={String(value.viewers as number)}
            onChange={(e) => {
              const n = Math.trunc(Number(e.target.value))
              onChange({ ...value, viewers: Number.isFinite(n) ? n : 0 })
            }}
            className="text-base"
          />
        </div>
      )}
    </div>
  )
}

/** Clock: which parts to show, and the start date and time. */
export function ClockEditor({ value, onChange, ctx }: EditorProps) {
  const p = ctx.idPrefix
  const flags: { key: "showYear" | "showMonthDay" | "showWeekday" | "showTime"; label: string }[] = [
    { key: "showYear", label: "年" },
    { key: "showMonthDay", label: "月日" },
    { key: "showWeekday", label: "曜日" },
    { key: "showTime", label: "時刻" },
  ]
  return (
    <div className="space-y-4">
      <fieldset className="space-y-1">
        <legend className="mb-1 text-sm font-medium">表示する項目</legend>
        {flags.map((f) => (
          <CheckRow
            key={f.key}
            id={`${p}-${f.key}`}
            label={f.label}
            checked={value[f.key] === true}
            onChange={(on) => onChange({ ...value, [f.key]: on })}
          />
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${p}-date`} className="text-sm font-medium">
            初期日付
          </label>
          <Input
            id={`${p}-date`}
            type="date"
            value={asStr(value.initialDate)}
            onChange={(e) => onChange({ ...value, initialDate: e.target.value })}
            className="text-base"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${p}-time`} className="text-sm font-medium">
            初期時刻
          </label>
          <Input
            id={`${p}-time`}
            type="time"
            value={asStr(value.initialTime)}
            onChange={(e) => onChange({ ...value, initialTime: e.target.value })}
            className="text-base"
          />
        </div>
      </div>
    </div>
  )
}

/** Quest: initial goals. Each title starts with one emoji (the server checks this on publish). */
export function QuestEditor({ value, onChange, ctx }: EditorProps) {
  const p = ctx.idPrefix
  const quests = asArr(value.initialQuests).map(asObj)
  const setQuests = (next: Obj[]) => onChange({ ...value, initialQuests: next })
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        各目標の先頭に絵文字を1つ付けてください。
      </p>
      {quests.map((q, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TextField
              id={`${p}-quest-${index}`}
              label={`目標 ${index + 1}`}
              value={asStr(q.title)}
              max={ctx.limits.questTitle}
              onChange={(v) =>
                setQuests(quests.map((x, i) => (i === index ? { ...x, title: v } : x)))
              }
            />
          </div>
          <RemoveButton
            label={`目標 ${index + 1} を削除`}
            onClick={() => setQuests(quests.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <AddButton
        label="目標を追加"
        disabled={quests.length >= ctx.limits.questCount}
        onClick={() => setQuests([...quests, { title: "" }])}
      />
    </div>
  )
}

export function AnonymousBoardEditor({ value, onChange, ctx }: EditorProps) {
  return (
    <TextField
      id={`${ctx.idPrefix}-board-name`}
      label="掲示板の名前"
      value={asStr(value.boardName)}
      max={ctx.limits.anonymousBoardName}
      onChange={(v) => onChange({ ...value, boardName: v })}
    />
  )
}

/** Phone peek: who can be looked at (up to 10, profiles included) and an optional preset wallpaper. */
export function PhonePeekEditor({ value, onChange, ctx }: EditorProps) {
  const p = ctx.idPrefix
  const targets = asArr(value.targetCharacterIds).map(asStr)
  const wallpapers = asObj(value.wallpaperByCharacterId)
  const options = [
    ...ctx.characters.filter((c) => c.id).map((c) => ({ id: c.id, label: c.name || "（名前未設定）" })),
    ...ctx.chatProfiles
      .filter((cp) => cp.id)
      .map((cp) => ({ id: cp.id, label: `トークプロフィール: ${cp.name || "（名前未設定）"}` })),
  ]
  const full = targets.length >= ctx.limits.phoneTargets

  function setTarget(id: string, on: boolean) {
    if (on) {
      // Every target needs a wallpaper (LIVE B2): preselect a preset from the manifest that no other target uses yet.
      const nextWallpapers: Obj = { ...wallpapers }
      if (!hasPhoneWallpaper(nextWallpapers[id])) {
        const usedPresets = new Set(
          Object.values(nextWallpapers).map((w) => asStr(asObj(w).presetId))
        )
        const preset =
          ctx.wallpapers.find((w) => !usedPresets.has(w.id)) ?? ctx.wallpapers[0]
        if (preset) nextWallpapers[id] = { type: "PRESET", presetId: preset.id }
      }
      onChange({
        ...value,
        targetCharacterIds: [...targets, id],
        wallpaperByCharacterId: nextWallpapers,
      })
      return
    }
    const nextWallpapers = { ...wallpapers }
    delete nextWallpapers[id]
    onChange({
      ...value,
      targetCharacterIds: targets.filter((t) => t !== id),
      wallpaperByCharacterId: nextWallpapers,
    })
  }

  function setWallpaper(id: string, presetId: string) {
    const next = { ...wallpapers }
    if (presetId) next[id] = { type: "PRESET", presetId }
    else delete next[id]
    onChange({ ...value, wallpaperByCharacterId: next })
  }

  return (
    <div className="space-y-5">
      <fieldset className="space-y-1">
        <legend className="mb-1 text-sm font-medium">
          のぞく相手（最大{ctx.limits.phoneTargets}人）
        </legend>
        {options.length === 0 && (
          <p className="text-sm text-muted-foreground">
            キャラクターを追加すると選べます。
          </p>
        )}
        {options.map((o) => {
          const checked = targets.includes(o.id)
          return (
            <CheckRow
              key={o.id}
              id={`${p}-target-${o.id}`}
              label={o.label}
              checked={checked}
              disabled={!checked && full}
              onChange={(on) => setTarget(o.id, on)}
            />
          )
        })}
      </fieldset>
      {targets.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium">壁紙</legend>
          {targets.map((id) => {
            const current = asObj(wallpapers[id])
            const isUpload = current.type === "UPLOAD"
            const label = options.find((o) => o.id === id)?.label ?? id
            return (
              <div key={id} className="space-y-1.5">
                <label htmlFor={`${p}-wall-${id}`} className="text-sm">
                  {label} の壁紙
                </label>
                {isUpload ? (
                  <p className="text-xs text-muted-foreground">
                    端末の画像が設定されています（この画面では変更できません）
                  </p>
                ) : (
                  <select
                    id={`${p}-wall-${id}`}
                    value={asStr(current.presetId)}
                    onChange={(e) => setWallpaper(id, e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="" disabled>
                      選んでください
                    </option>
                    {ctx.wallpapers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name ?? w.id}
                      </option>
                    ))}
                    {/* A stored preset the manifest no longer lists is kept visible, not swapped silently. */}
                    {asStr(current.presetId) !== "" &&
                      !ctx.wallpapers.some((w) => w.id === asStr(current.presetId)) && (
                        <option value={asStr(current.presetId)}>{asStr(current.presetId)}</option>
                      )}
                  </select>
                )}
              </div>
            )
          })}
        </fieldset>
      )}
    </div>
  )
}

/** Sudden event: situations that can trigger an event (up to 5, each within the limit). */
export function SuddenEventEditor({ value, onChange, ctx }: EditorProps) {
  const p = ctx.idPrefix
  const list = asArr(value.triggerSituations).map(asStr)
  const setList = (next: string[]) => onChange({ ...value, triggerSituations: next })
  return (
    <div className="space-y-3">
      {list.map((text, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TextField
              id={`${p}-situation-${index}`}
              label={`状況 ${index + 1}`}
              value={text}
              max={ctx.limits.suddenEventChars}
              multiline
              onChange={(v) => setList(list.map((x, i) => (i === index ? v : x)))}
            />
          </div>
          <RemoveButton
            label={`状況 ${index + 1} を削除`}
            onClick={() => setList(list.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <AddButton
        label="状況を追加"
        disabled={list.length >= ctx.limits.suddenEventCount}
        onClick={() => setList([...list, ""])}
      />
    </div>
  )
}

/**
 * A stored value that the editor's list does not offer stays visible as its own option, so
 * loading never changes it silently. The server does not whitelist relationship values (LIVE B5).
 */
function keepUnknown(current: string, known: readonly { key: string }[]) {
  if (current === "" || known.some((k) => k.key === current)) return null
  return (
    <option key={`unknown-${current}`} value={current}>
      {current}（一覧にない値）
    </option>
  )
}

/** Relationship chart: pairs of names with a relation. "user" is the reader's own character. */
export function RelationshipEditor({ value, onChange, ctx }: EditorProps) {
  const p = ctx.idPrefix
  const rows = asArr(value.relationships).map(asObj)
  const setRows = (next: Obj[]) => onChange({ ...value, relationships: next })
  const names = [
    { key: "user", label: "ユーザー" },
    ...ctx.characters.filter((c) => c.name.trim()).map((c) => ({ key: c.name, label: c.name })),
  ]
  const relations = [
    { key: "LOVERS", label: "両思い" },
    { key: "UNREQUITED_LOVE", label: "片思い" },
  ] as const

  function setRow(index: number, patch: Obj) {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-4">
      {rows.map((row, index) => {
        const relation = asStr(row.relationship)
        const oneWay = relation === "UNREQUITED_LOVE"
        return (
          <section
            key={index}
            aria-label={`ラブライン ${index + 1}`}
            className="space-y-3 rounded-lg border border-border p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold">ラブライン {index + 1}</h4>
              <RemoveButton
                label={`ラブライン ${index + 1} を削除`}
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor={`${p}-from-${index}`} className="text-sm font-medium">
                  相手A
                </label>
                <select
                  id={`${p}-from-${index}`}
                  value={asStr(row.from)}
                  onChange={(e) => setRow(index, { from: e.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">選択してください</option>
                  {names.map((n) => (
                    <option key={n.key} value={n.key}>
                      {n.label}
                    </option>
                  ))}
                  {keepUnknown(asStr(row.from), names)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${p}-to-${index}`} className="text-sm font-medium">
                  相手B
                </label>
                <select
                  id={`${p}-to-${index}`}
                  value={asStr(row.to)}
                  onChange={(e) => setRow(index, { to: e.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">選択してください</option>
                  {names.map((n) => (
                    <option key={n.key} value={n.key}>
                      {n.label}
                    </option>
                  ))}
                  {keepUnknown(asStr(row.to), names)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${p}-relation-${index}`} className="text-sm font-medium">
                関係
              </label>
              <select
                id={`${p}-relation-${index}`}
                value={relation}
                onChange={(e) =>
                  setRow(index, {
                    relationship: e.target.value,
                    ...(e.target.value === "UNREQUITED_LOVE" ? { bidirectional: false } : {}),
                  })
                }
                className={SELECT_CLASS}
              >
                <option value="">選択してください</option>
                {relations.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
                {keepUnknown(relation, relations)}
              </select>
            </div>
            <CheckRow
              id={`${p}-bidir-${index}`}
              label="両方向に表示する"
              checked={row.bidirectional === true}
              disabled={oneWay}
              onChange={(on) => setRow(index, { bidirectional: on })}
            />
          </section>
        )
      })}
      <AddButton
        label="ラブラインを追加"
        disabled={rows.length >= ctx.limits.relationships}
        onClick={() => setRows([...rows, { from: "", to: "", relationship: "", bidirectional: false }])}
      />
    </div>
  )
}
