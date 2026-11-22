import { countChars, type PlotLimits } from "@/lib/plot-limits"

/**
 * Client-side mirror of the plugin value rules (APK constants, ds-max PHASE3 §1.3).
 * The server validates again at publish time (PLUGIN_VALUE_INVALID). Autosave PATCH
 * does not validate, so these checks run on input.
 */

/** Plugins with a dedicated endpoint: PUT /v1/plots/:id/plugins {pluginId, value}. */
export const DEDICATED_PLUGIN_IDS: readonly string[] = ["bgm", "event-cut"]

/** Plugins whose value is always `{}` (toggle only). */
export const NO_CONFIG_PLUGIN_IDS: readonly string[] = [
  "character-diary",
  "ending",
  "zetagram",
  "cartoonify",
  "dream",
]

/** Plugins with no editor in this build (ds-max): toggle only, value preserved. */
export const NO_EDITOR_PLUGIN_IDS: readonly string[] = ["ghost-chat", "dating-show"]

/** HUD slots each plugin uses (top of screen, capacity 4; ds-max PHASE3 §1.2). */
export const HUD_SLOTS: Readonly<Record<string, number>> = {
  clock: 1,
  quest: 2,
  "idol-survival": 4,
  "dating-show": 1,
}
export const HUD_CAPACITY = 4
export const HUD_FULL_MESSAGE =
  "画面上部の枠は最大4つです。ほかのプラグインをオフにするとオンにできます。"

/** BGM limits (ds-max PHASE3 §1.3: maxTrackCount 12, usageInstruction 120 chars; LIVE: 1..12 tracks). */
export const BGM_MAX_TRACKS = 12
export const BGM_USAGE_MAX = 120

/**
 * Checks a BGM value. `enabled: false` is always valid. With `enabled: true` the server
 * requires 1..12 tracks (LIVE B1: 0 tracks → 400 "enabled BGM requires 1..12 tracks").
 * `requireIntro` is for publishing only: an intro track is needed then (isBgmIntroValid).
 */
export function validateBgmValue(value: unknown, requireIntro: boolean): string | null {
  if (!isObject(value) || value.enabled !== true) return null
  return validateBgmTracks(value.tracks, requireIntro)
}

/** Checks the tracks of a BGM value that is about to be saved (or was saved). */
export function validateBgmTracks(tracks: unknown, requireIntro: boolean): string | null {
  if (!Array.isArray(tracks)) return "設定が正しくありません"
  if (tracks.length < 1) return "曲を1曲以上選んでください"
  if (tracks.length > BGM_MAX_TRACKS) return `BGMは最大${BGM_MAX_TRACKS}曲までです`
  for (const raw of tracks) {
    if (!isObject(raw) || typeof raw.assetId !== "string" || raw.assetId.length === 0) {
      return "曲の設定が正しくありません"
    }
    const usage = typeof raw.usageInstruction === "string" ? raw.usageInstruction : ""
    if (countChars(usage) > BGM_USAGE_MAX) {
      return `再生指示は${BGM_USAGE_MAX}文字以内で入力してください`
    }
  }
  if (requireIntro && !tracks.some((t) => isObject(t) && t.isStarting === true)) {
    return "イントロBGMを指定してください。"
  }
  return null
}

/** A phone-peek wallpaper entry is usable when it names a preset or an uploaded asset. */
export function hasPhoneWallpaper(raw: unknown): boolean {
  if (!isObject(raw)) return false
  if (raw.type === "PRESET") return typeof raw.presetId === "string" && raw.presetId.length > 0
  if (raw.type === "UPLOAD") return typeof raw.assetId === "string" && raw.assetId.length > 0
  return false
}

/** Reads an object-shaped value; anything else is treated as empty. Keys are read, never removed. */
export function asObj(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export const FORBIDDEN_NAME_CHARS = /["<>]/
export const FORBIDDEN_NAME_MESSAGE = "ダブルクォーテーションと不等号(\", <, >)は使用できません"

export interface PluginEntry {
  pluginId: string
  value: unknown
}

export interface PluginRuleContext {
  limits: PlotLimits
  characters: { id?: string; name?: string | null }[]
  chatProfileIds: string[]
}

export const RELATIONSHIP_VALUES = ["LOVERS", "UNREQUITED_LOVE"] as const

const EMOJI_LEAD = /^\p{Extended_Pictographic}️?/u
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value)
}

function isRealDate(text: string): boolean {
  if (!DATE_RE.test(text)) return false
  const [y, m, d] = text.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** Default value used when a plugin is switched on. Undefined for dedicated plugins. */
export function pluginDefaultValue(pluginId: string): unknown | undefined {
  if (DEDICATED_PLUGIN_IDS.includes(pluginId)) return undefined
  switch (pluginId) {
    case "dice":
      return { frequency: "DECISIVE", themeId: "default" }
    case "message":
      return { initialContactCharacterIds: [] }
    case "rank-chart":
      return {
        title: "",
        ranks: [
          { name: "", description: "", members: [] },
          { name: "", description: "", members: [] },
        ],
      }
    case "live-chat":
      return { entries: [] }
    case "clock":
      return {
        showYear: true,
        showMonthDay: true,
        showWeekday: true,
        showTime: true,
        initialDate: "2026-01-01",
        initialTime: "09:00",
      }
    case "quest":
      return { initialQuests: [] }
    case "anonymous-board":
      return { boardName: "" }
    case "phone-peek":
      return { targetCharacterIds: [], wallpaperByCharacterId: {} }
    case "sudden_event":
      return { triggerSituations: [] }
    case "relationship-chart":
      return { relationships: [] }
    default:
      return {}
  }
}

/** Returns an error message, or null when the value is valid. Unknown plugins are never rejected. */
export function validatePluginValue(pluginId: string, value: unknown, ctx: PluginRuleContext): string | null {
  const L = ctx.limits
  const characterNames = new Set(ctx.characters.map((c) => c.name?.trim()).filter(Boolean) as string[])
  const characterIds = new Set(ctx.characters.map((c) => c.id).filter(Boolean) as string[])
  const profileCount = ctx.chatProfileIds.length

  switch (pluginId) {
    case "dice": {
      if (!isObject(value)) return "設定が正しくありません"
      if (value.frequency !== "ALWAYS" && value.frequency !== "DECISIVE") return "頻度を選択してください"
      return null
    }
    case "message": {
      if (!isObject(value) || !Array.isArray(value.initialContactCharacterIds)) return "設定が正しくありません"
      const ids = value.initialContactCharacterIds as unknown[]
      if (ids.length < 1) return "基本の連絡先を1人以上指定してください"
      if (ids.some((id) => typeof id !== "string" || !characterIds.has(id))) {
        return "存在しないキャラクターが含まれています"
      }
      return null
    }
    case "rank-chart": {
      if (!isObject(value) || !Array.isArray(value.ranks)) return "設定が正しくありません"
      const title = typeof value.title === "string" ? value.title : ""
      if (!title.trim()) return "リスト名を入力してください"
      if (countChars(title) > L.rankTitle) return `リスト名は${L.rankTitle}文字以内で入力してください`
      if (FORBIDDEN_NAME_CHARS.test(title)) return FORBIDDEN_NAME_MESSAGE
      const ranks = value.ranks as unknown[]
      if (ranks.length < L.rankMinCount || ranks.length > L.rankCount) {
        return `ティアは${L.rankMinCount}〜${L.rankCount}個まで作成できます`
      }
      const names = new Set<string>()
      for (const raw of ranks) {
        if (!isObject(raw)) return "ティアの設定が正しくありません"
        const name = typeof raw.name === "string" ? raw.name.trim() : ""
        if (!name) return "ティア名を入力してください"
        if (countChars(name) > L.rankName) return `ティア名は${L.rankName}文字まで入力可能です`
        if (FORBIDDEN_NAME_CHARS.test(name)) return FORBIDDEN_NAME_MESSAGE
        if (names.has(name)) return "同じ名前のティアがあります"
        names.add(name)
        const description = typeof raw.description === "string" ? raw.description : ""
        if (countChars(description) > L.rankDescription) {
          return `ティアの説明は${L.rankDescription}文字以内で入力してください`
        }
        const members = Array.isArray(raw.members) ? (raw.members as unknown[]) : []
        const profiles = members.filter((m) => isObject(m) && m.type === "PLOT_PROFILE")
        if (profiles.length > L.rankMembers) {
          return `1つのティアに入れるトークプロフィールは${L.rankMembers}つまでです`
        }
        for (const m of members) {
          if (!isObject(m)) return "ティアの設定が正しくありません"
          if (m.type === "CHARACTER" && !characterNames.has(String(m.name ?? ""))) {
            return "存在しないキャラクターが含まれています"
          }
          if (m.type === "PLOT_PROFILE" && (!isInt(m.seq) || m.seq < 0 || m.seq >= profileCount)) {
            return "存在しないトークプロフィールが含まれています"
          }
        }
      }
      return null
    }
    case "live-chat": {
      if (!isObject(value) || !Array.isArray(value.entries)) return "設定が正しくありません"
      const entries = value.entries as unknown[]
      if (entries.length > L.liveChatEntries) return `チャットは最大${L.liveChatEntries}件までです`
      for (const raw of entries) {
        if (!isObject(raw)) return "チャットの設定が正しくありません"
        const name = typeof raw.name === "string" ? raw.name.trim() : ""
        const text = typeof raw.text === "string" ? raw.text.trim() : ""
        if (!name) return "ニックネームを入力してください"
        if (countChars(name) > L.liveChatName) return `ニックネームは${L.liveChatName}文字以内で入力してください`
        if (!text) return "チャットの内容を入力してください"
        if (countChars(text) > L.liveChatText) return `チャットの内容は${L.liveChatText}文字以内で入力してください`
        if (raw.amount !== undefined && (!isInt(raw.amount) || raw.amount < 0 || raw.amount > 9999999)) {
          return "ドネーション額は0以上の整数で入力してください"
        }
      }
      if (value.viewers !== undefined && (!isInt(value.viewers) || value.viewers < 0)) {
        return "視聴者数は0以上の整数で入力してください"
      }
      return null
    }
    case "clock": {
      if (!isObject(value)) return "設定が正しくありません"
      const flags = [value.showYear, value.showMonthDay, value.showWeekday, value.showTime]
      if (!flags.some((f) => f === true)) return "表示する項目を1つ以上選んでください"
      if (typeof value.initialDate !== "string" || !isRealDate(value.initialDate)) {
        return "初期日付を2026-01-01の形式で入力してください"
      }
      if (typeof value.initialTime !== "string" || !TIME_RE.test(value.initialTime)) {
        return "初期時刻を24時間制の09:00の形式で入力してください"
      }
      return null
    }
    case "quest": {
      if (!isObject(value) || !Array.isArray(value.initialQuests)) return "設定が正しくありません"
      const quests = value.initialQuests as unknown[]
      if (quests.length > L.questCount) return `初期クエストは最大${L.questCount}件までです`
      const titles = new Set<string>()
      for (const raw of quests) {
        if (!isObject(raw)) return "クエストの設定が正しくありません"
        const title = typeof raw.title === "string" ? raw.title.trim() : ""
        if (!title) return "クエストのタイトルを入力してください"
        if (countChars(title) > L.questTitle) return `クエストのタイトルは${L.questTitle}文字まで入力可能です`
        if (!EMOJI_LEAD.test(title)) return "目標の先頭にふさわしい絵文字を1つ付けてください"
        const body = title.replace(EMOJI_LEAD, "").trim()
        if (!body) return "クエストの本文を入力してください"
        if (titles.has(title)) return "同じ内容のクエストがあります"
        titles.add(title)
      }
      return null
    }
    case "anonymous-board": {
      if (!isObject(value)) return "設定が正しくありません"
      const name = typeof value.boardName === "string" ? value.boardName.trim() : ""
      if (!name) return "掲示板の名前を入力してください"
      if (countChars(name) > L.anonymousBoardName) {
        return `掲示板の名前は${L.anonymousBoardName}文字以内で入力してください`
      }
      return null
    }
    case "phone-peek": {
      if (!isObject(value) || !Array.isArray(value.targetCharacterIds)) return "設定が正しくありません"
      const targets = value.targetCharacterIds as unknown[]
      if (targets.length > L.phoneTargets) return `対象は最大${L.phoneTargets}人までです`
      const known = new Set([...characterIds, ...ctx.chatProfileIds])
      if (targets.some((id) => typeof id !== "string" || !known.has(id))) {
        return "存在しないキャラクターが含まれています"
      }
      // Every target needs a wallpaper: the server rejects PATCH/PUT otherwise (LIVE B2).
      const wallpapers: Record<string, unknown> = isObject(value.wallpaperByCharacterId)
        ? value.wallpaperByCharacterId
        : {}
      if (targets.some((id) => !hasPhoneWallpaper(wallpapers[id as string]))) {
        return "壁紙を設定してください"
      }
      return null
    }
    case "sudden_event": {
      if (!isObject(value) || !Array.isArray(value.triggerSituations)) return "設定が正しくありません"
      const list = value.triggerSituations as unknown[]
      if (list.length > L.suddenEventCount) {
        return `イベントが始まる状況は最大${L.suddenEventCount}つまで入力可能です。`
      }
      for (const raw of list) {
        const text = typeof raw === "string" ? raw.trim() : ""
        if (!text) return "イベントが始まる状況を入力してください。"
        if (countChars(text) > L.suddenEventChars) {
          return `状況は${L.suddenEventChars}文字以内で入力してください`
        }
      }
      return null
    }
    case "relationship-chart": {
      if (!isObject(value) || !Array.isArray(value.relationships)) return "設定が正しくありません"
      const rows = value.relationships as unknown[]
      if (rows.length > L.relationships) return `ラブラインは最大${L.relationships}個までです`
      const participants = new Set<string>()
      for (const raw of rows) {
        if (!isObject(raw)) return "ラブラインの設定が正しくありません"
        const from = typeof raw.from === "string" ? raw.from.trim() : ""
        const to = typeof raw.to === "string" ? raw.to.trim() : ""
        if (!from || !to) return "ラブラインの相手を選んでください"
        if (from === to) return "同じ相手どうしは設定できません"
        if (countChars(from) > L.relationshipNameMax || countChars(to) > L.relationshipNameMax) {
          return `名前は${L.relationshipNameMax}文字以内で入力してください`
        }
        if (typeof raw.relationship !== "string" || !raw.relationship) return "関係を選んでください"
        if (raw.relationship === "UNREQUITED_LOVE" && raw.bidirectional === true) {
          return "片思いは一方向のみ設定できます"
        }
        if (from !== "user") participants.add(from)
        if (to !== "user") participants.add(to)
      }
      if (participants.size > L.relationshipParticipants) {
        return `参加者は最大${L.relationshipParticipants}人までです`
      }
      return null
    }
    default:
      // Unknown and no-config plugins: keep whatever the server holds.
      return null
  }
}

/** HUD slot usage of the enabled plugins. */
export function hudSlotsUsed(entries: readonly PluginEntry[]): number {
  return entries.reduce((sum, e) => sum + (HUD_SLOTS[e.pluginId] ?? 0), 0)
}
