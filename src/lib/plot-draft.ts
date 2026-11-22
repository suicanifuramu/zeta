import type {
  DraftAbout,
  DraftCharacter,
  DraftChatProfile,
  DraftExampleConversation,
  DraftInfoBoxItemType,
  DraftInfoBoxSceneType,
  DraftIntro,
  DraftIntroMessage,
  DraftPluginEntry,
  KeywordTestType,
  PlotDraft,
} from "@/lib/types"
import { LIMIT_TEXT, countChars, type PlotLimits } from "@/lib/plot-limits"
import {
  DEDICATED_PLUGIN_IDS,
  HUD_CAPACITY,
  HUD_FULL_MESSAGE,
  hudSlotsUsed,
  validateBgmValue,
  validatePluginValue,
  type PluginRuleContext,
} from "@/lib/plugin-rules"

export { countChars }

/**
 * Pure helpers for the plot draft. Nothing here performs I/O.
 *
 * Data-safety rules:
 * - A PATCH body contains only the sections it names, built from the latest local
 *   draft (which came from the server).
 * - Nested values are deep-cloned, so unknown nested keys round-trip.
 * - A key the UI does not edit is never replaced by an empty value on the way out.
 */

export type SectionKey =
  | "basic"
  | "characters"
  | "chatProfiles"
  | "examples"
  | "lorebooks"
  | "intros"
  | "settings"
  | "publicity"
  | "plugins"

/** Draft keys owned by each autosave section. */
export const SECTION_FIELDS: Record<SectionKey, readonly (keyof PlotDraft & string)[]> = {
  basic: ["name", "longDescription", "narrator"],
  characters: ["characters"],
  chatProfiles: ["chatProfiles"],
  examples: ["exampleConversations"],
  lorebooks: ["lorebookIds"],
  intros: ["intros"],
  settings: ["stylePreset", "infoBoxSetting", "cyoaSetting"],
  publicity: [
    "shortDescription",
    "hashtags",
    "isCreatorCommentPublic",
    "creatorComment",
    "about",
    "isAboutPublic",
    "isExampleConversationPublic",
  ],
  plugins: ["plugins"],
}

export const ALL_SECTIONS: readonly SectionKey[] = [
  "basic",
  "characters",
  "chatProfiles",
  "examples",
  "lorebooks",
  "intros",
  "settings",
  "publicity",
  "plugins",
]

/** Name characters (ds-max §6 "名前 regex"). Checked when publishing, not while typing. */
export const NAME_CHARS_RE =
  /^[ \-.0-9A-Z_a-zᄀ-ᇿ\u3000。々぀-ヿ㄰-㆏ㇰ-㋿㐀-䶿一-鿿ꥠ-꥿가-퟿豈-﫿０-９ｦ-ﾟ]+$/

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function clone<T>(value: T): T {
  return value === undefined ? value : (structuredClone(value) as T)
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asObject<T>(value: unknown): T | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as T) : null
}

/**
 * Converts a server draft into the editor shape. `exampleConversation` (draft,
 * singular) becomes `exampleConversations` (request, plural). All other keys are kept.
 */
export function normalizeDraft(raw: Record<string, unknown> | null | undefined): PlotDraft | null {
  if (!raw) return null
  const { exampleConversation, ...rest } = raw
  const examples = Array.isArray(exampleConversation)
    ? exampleConversation
    : Array.isArray(rest.exampleConversations)
      ? rest.exampleConversations
      : []
  return {
    ...rest,
    name: asString(rest.name),
    imageUrl: asString(rest.imageUrl),
    shortDescription: asString(rest.shortDescription),
    longDescription: asString(rest.longDescription),
    narrator: asString(rest.narrator),
    characters: asArray<DraftCharacter>(rest.characters),
    chatProfiles: asArray<DraftChatProfile>(rest.chatProfiles),
    exampleConversations: asArray<DraftExampleConversation>(examples),
    intros: asArray<DraftIntro>(rest.intros),
    about: asObject<DraftAbout>(rest.about),
    hashtags: asArray<string>(rest.hashtags),
    lorebookIds: asArray<string>(rest.lorebookIds),
    creatorComment: asString(rest.creatorComment),
    stylePreset: asObject(rest.stylePreset),
    infoBoxSetting: asObject(rest.infoBoxSetting),
    cyoaSetting: asObject(rest.cyoaSetting),
    plugins: Array.isArray(rest.plugins) ? (rest.plugins as DraftPluginEntry[]) : null,
  } as PlotDraft
}

/** Keeps `about.characters` in step with the characters list. Other `about` keys are preserved. */
function buildAbout(d: PlotDraft): DraftAbout {
  const base: DraftAbout = d.about ?? { contents: [], characters: [] }
  const previous = new Map(
    (base.characters ?? [])
      .filter((c) => typeof c.characterId === "string")
      .map((c) => [c.characterId as string, c])
  )
  return {
    ...clone(base),
    contents: clone(base.contents ?? []),
    characters: d.characters
      .filter((c) => c.id)
      .map((c) => ({
        ...clone(previous.get(c.id as string) ?? {}),
        characterId: c.id,
        name: c.name ?? null,
        description: c.description ?? null,
      })),
  }
}

/**
 * Intro messages in the form the official app sends: no `speakerName` key, and a
 * `tempId` on every message that lacks one. Other keys are kept. Request bodies only;
 * local state is not changed.
 */
export function toWireIntros(intros: readonly DraftIntro[]): DraftIntro[] {
  return intros.map((intro) => {
    const copy = clone(intro)
    copy.conversation = {
      ...copy.conversation,
      messages: copy.conversation.messages.map(toWireIntroMessage),
    }
    // The server always returns these two keys (LIVE): null when unset, kept as they are when set.
    copy.backgroundAudioUrl = copy.backgroundAudioUrl ?? null
    copy.backgroundAudioDurationSeconds = copy.backgroundAudioDurationSeconds ?? null
    return copy
  })
}

function toWireIntroMessage(message: DraftIntroMessage): DraftIntroMessage {
  const { speakerName: _dropped, ...rest } = message as Record<string, unknown>
  void _dropped
  const hasTempId = typeof rest.tempId === "string" && rest.tempId.length > 0
  return hasTempId ? (rest as DraftIntroMessage) : { ...rest, tempId: newTempId() }
}

/** Body for a PATCH that saves one section. Contains only the keys that section owns. */
export function buildSectionBody(d: PlotDraft, section: SectionKey): Record<string, unknown> {
  switch (section) {
    case "basic":
      return { name: d.name, longDescription: d.longDescription, narrator: d.narrator }
    case "characters":
      // A character without an id is a placeholder: send `{}` and let the server assign the id.
      return { characters: d.characters.map((c) => (c.id ? clone(c) : {})) }
    case "chatProfiles":
      return { chatProfiles: clone(d.chatProfiles) }
    case "examples":
      return { exampleConversations: clone(d.exampleConversations) }
    case "lorebooks":
      return { lorebookIds: [...d.lorebookIds] }
    case "intros":
      return { intros: toWireIntros(d.intros) }
    case "settings":
      return {
        stylePreset: clone(d.stylePreset),
        infoBoxSetting: clone(d.infoBoxSetting),
        cyoaSetting: clone(d.cyoaSetting),
      }
    case "publicity":
      return {
        shortDescription: d.shortDescription,
        hashtags: [...d.hashtags],
        isCreatorCommentPublic: d.isCreatorCommentPublic,
        creatorComment: d.creatorComment,
        about: buildAbout(d),
        isAboutPublic: d.isAboutPublic,
        isExampleConversationPublic: d.isExampleConversationPublic,
      }
    case "plugins":
      // Dedicated entries (bgm, event-cut) are sent exactly as the server last stored them:
      // local mirrors are replaced from PUT responses (plugins-section), never edited here.
      return { plugins: clone(d.plugins ?? []) }
  }
}

/** Merges several section bodies. Sections own disjoint keys, so the merge is lossless. */
export function buildSectionsBody(d: PlotDraft, sections: readonly SectionKey[]): Record<string, unknown> {
  return Object.assign({}, ...sections.map((s) => buildSectionBody(d, s)))
}

/**
 * Full body for PUT /v1/plots/:id, sent right before publishing. Exactly the official
 * key set (LIVE F2): initialRoomImageUrl, isLongDescriptionPublic and updatedAt are not
 * sent. shortDescription, longDescription and creatorComment must be strings (LIVE F2).
 */
export function buildPublishBody(plotId: string, d: PlotDraft): Record<string, unknown> {
  return {
    plotId,
    name: d.name,
    longDescription: d.longDescription ?? "",
    narrator: d.narrator,
    imageUrl: d.imageUrl,
    shortDescription: d.shortDescription ?? "",
    hashtags: [...d.hashtags],
    isAboutPublic: d.isAboutPublic,
    about: buildAbout(d),
    isCreatorCommentPublic: d.isCreatorCommentPublic,
    creatorComment: d.creatorComment ?? "",
    isExampleConversationPublic: d.isExampleConversationPublic,
    lorebookIds: [...d.lorebookIds],
    stylePreset: clone(d.stylePreset),
    infoBoxSetting: clone(d.infoBoxSetting),
    cyoaSetting: clone(d.cyoaSetting),
    plugins: clone(d.plugins ?? []),
    characters: d.characters.filter((c) => c.id).map((c) => clone(c)),
    intros: toWireIntros(d.intros),
    exampleConversations: clone(d.exampleConversations),
    chatProfiles: clone(d.chatProfiles),
  }
}

export interface LimitIssue {
  section: SectionKey
  /** DOM id of the field to focus (see plot-editor for the tab mapping). */
  target: string
  message: string
}

export function exampleTotalChars(d: PlotDraft): number {
  return d.exampleConversations.reduce(
    (sum, ec) => sum + ec.messages.reduce((s, m) => s + countChars(m.content), 0),
    0
  )
}

export function introTotalChars(d: PlotDraft): number {
  return d.intros.reduce(
    (sum, intro) =>
      sum +
      intro.conversation.messages.reduce(
        (s, m) => s + (m.type === "text" ? countChars(String((m as { content?: unknown }).content ?? "")) : 0),
        0
      ),
    0
  )
}

function pluginContext(d: PlotDraft, limits: PlotLimits): PluginRuleContext {
  return {
    limits,
    characters: d.characters,
    chatProfileIds: d.chatProfiles.map((cp) => cp.id),
  }
}

/**
 * Limits checked on input. A section with an issue is not autosaved until it is fixed.
 * Data is never dropped: the section simply waits (phase "invalid").
 */
export function collectLimitIssues(d: PlotDraft, limits: PlotLimits): LimitIssue[] {
  const issues: LimitIssue[] = []
  const add = (section: SectionKey, target: string, message: string) => issues.push({ section, target, message })

  if (countChars(d.name) > limits.name) add("basic", "plot-name", LIMIT_TEXT.name(limits.name))
  if (countChars(d.longDescription) > limits.longDescription) {
    add("basic", "plot-description", LIMIT_TEXT.longDescription(limits.longDescription))
  }
  if (countChars(d.narrator) > limits.longDescription) {
    add("basic", "plot-narrator", LIMIT_TEXT.longDescription(limits.longDescription))
  }

  if (d.characters.length > limits.characters) {
    add("characters", "char-add", LIMIT_TEXT.characters(limits.characters))
  }
  d.characters.forEach((c, i) => {
    if (countChars(c.name) > limits.characterName) {
      add("characters", `char-name-${i}`, LIMIT_TEXT.characterName(limits.characterName))
    }
  })

  if (d.chatProfiles.length > limits.chatProfiles) {
    add("chatProfiles", "cp-add", LIMIT_TEXT.chatProfiles(limits.chatProfiles))
  }
  d.chatProfiles.forEach((cp, i) => {
    if (countChars(cp.name) > limits.chatProfileName) {
      add("chatProfiles", `cp-name-${i}`, LIMIT_TEXT.chatProfileName(limits.chatProfileName))
    }
    if (countChars(cp.summary) > limits.chatProfileSummary) {
      add("chatProfiles", `cp-summary-${i}`, LIMIT_TEXT.chatProfileSummary(limits.chatProfileSummary))
    }
    if (countChars(cp.description) > limits.chatProfileDescription) {
      add("chatProfiles", `cp-desc-${i}`, LIMIT_TEXT.chatProfileDescription(limits.chatProfileDescription))
    }
  })

  if (exampleTotalChars(d) > limits.exampleTotal) {
    add("examples", "ex-total", LIMIT_TEXT.exampleTotal(limits.exampleTotal))
  }

  if (d.intros.some((i) => i.conversation.messages.length > limits.introMessages)) {
    add("intros", "intro-add", LIMIT_TEXT.introMessages(limits.introMessages))
  }
  if (introTotalChars(d) > limits.introTotal) {
    add("intros", "intro-total", LIMIT_TEXT.introTotal(limits.introTotal))
  }
  for (const intro of d.intros) {
    const choices = intro.conversation.cyoaChoices?.choices ?? []
    if (choices.length > limits.cyoaChoices) add("intros", "intro-cyoa", LIMIT_TEXT.cyoaChoices(limits.cyoaChoices))
    if (choices.some((c) => countChars(c.title) > limits.cyoaTitle)) {
      add("intros", "intro-cyoa", LIMIT_TEXT.cyoaTitle(limits.cyoaTitle))
    }
    if (choices.some((c) => countChars(c.text) > limits.cyoaPreview)) {
      add("intros", "intro-cyoa", LIMIT_TEXT.cyoaPreview(limits.cyoaPreview))
    }
  }

  if (countChars(d.shortDescription) > limits.shortDescription) {
    add("publicity", "pub-short-input", LIMIT_TEXT.shortDescription(limits.shortDescription))
  }
  if (countChars(d.creatorComment) > limits.creatorComment) {
    add("publicity", "pub-comment-input", LIMIT_TEXT.creatorComment(limits.creatorComment))
  }
  const aboutText = d.about?.contents?.map((b) => b.content ?? "").join("") ?? ""
  if (countChars(aboutText) > limits.about) add("publicity", "pub-about-input", LIMIT_TEXT.about(limits.about))
  if (d.hashtags.length > limits.hashtags) add("publicity", "pub-tag-input", LIMIT_TEXT.hashtags(limits.hashtags))
  if (d.hashtags.some((t) => countChars(t) > limits.hashtagLength)) {
    add("publicity", "pub-tag-input", LIMIT_TEXT.hashtagLength(limits.hashtagLength))
  }

  if (d.lorebookIds.length > limits.lorebooks) {
    add("lorebooks", "lb-open", LIMIT_TEXT.lorebooks(limits.lorebooks))
  }

  const ctx = pluginContext(d, limits)
  const entries = d.plugins ?? []
  for (const entry of entries) {
    if (DEDICATED_PLUGIN_IDS.includes(entry.pluginId)) continue
    const error = validatePluginValue(entry.pluginId, entry.value, ctx)
    if (error) add("plugins", `plugin-${entry.pluginId}`, error)
  }
  if (hudSlotsUsed(entries) > HUD_CAPACITY) add("plugins", "plugins-hud", HUD_FULL_MESSAGE)

  return issues
}

/**
 * Checks run before publishing, in the order of the editor's tabs. They mirror the server's
 * publish rules (PHASE5-LIVE §1–§4): the input limits, the name pattern, a non-empty character
 * name, the first character's image only, every chat profile's image and summary (and its name
 * unless it uses the default name), at least one intro with one message, and the plugin gates.
 * Each issue names the element to focus (`target`), which the editor reveals.
 */
export function publishIssues(d: PlotDraft, limits: PlotLimits): LimitIssue[] {
  const issues = collectLimitIssues(d, limits)
  const push = (section: SectionKey, target: string, message: string) =>
    issues.push({ section, target, message })

  if (!d.name || !d.name.trim()) push("basic", "plot-name", "タイトルを入力してください")
  else if (!NAME_CHARS_RE.test(d.name)) push("basic", "plot-name", LIMIT_TEXT.nameChars)

  if (d.characters.length === 0) push("characters", "char-add", "キャラクターを追加してください")
  d.characters.forEach((c, i) => {
    if (!c.name || !c.name.trim()) push("characters", `char-name-${i}`, "キャラクターの名前を入力してください")
    else if (!NAME_CHARS_RE.test(c.name)) push("characters", `char-name-${i}`, LIMIT_TEXT.nameChars)
  })
  // Only characters[0] needs an image on the server (LIVE: a second character without one publishes).
  if (d.characters.length > 0 && !d.characters[0].imageUrl) {
    push("characters", "char-image-0", "プロフィール画像を設定してください")
  }

  d.chatProfiles.forEach((cp, i) => {
    if (!cp.imageUrl) push("chatProfiles", `cp-image-${i}`, "プロフィール画像を設定してください")
    if (!cp.isUsingDefaultName && !(cp.name ?? "").trim()) {
      push("chatProfiles", `cp-name-${i}`, "トークプロフィール名を入力してください")
    }
    if (!(cp.summary ?? "").trim()) push("chatProfiles", `cp-summary-${i}`, "トークプロフィール紹介を入力してください")
  })

  // The server needs an intro with at least one message (PLOT_INTRO_CONSTRAINT_VIOLATION). Not a BGM rule.
  const first = d.intros[0]
  if (!first) push("intros", "intro-create", "イントロを入力してください")
  else if (first.conversation.messages.length === 0) push("intros", "intro-add", "イントロを入力してください")

  // BGM is a dedicated plugin (PUT only), so it never blocks autosave. Publishing needs 1..12 tracks and an intro.
  const bgm = (d.plugins ?? []).find((e) => e.pluginId === "bgm")
  const bgmError = bgm ? validateBgmValue(bgm.value, true) : null
  if (bgmError) push("plugins", "plugin-bgm", bgmError)
  return issues
}

/** Copies one section from a server draft (used when the user has no newer local edit). */
export function replaceSectionFromServer(local: PlotDraft, server: PlotDraft, section: SectionKey): PlotDraft {
  const next: Record<string, unknown> = { ...local }
  for (const field of SECTION_FIELDS[section]) {
    const value = (server as Record<string, unknown>)[field]
    if (value !== undefined) next[field] = clone(value)
  }
  return next as PlotDraft
}

/**
 * After a characters PATCH, fills in server-assigned ids for placeholders that were
 * sent as `{}`. Only applies when the list length did not change meanwhile.
 */
export function adoptCharacterIds(
  local: PlotDraft,
  server: PlotDraft,
  sentIds: readonly (string | null)[]
): PlotDraft {
  if (local.characters.length !== sentIds.length || server.characters.length !== sentIds.length) {
    return local
  }
  const characters = local.characters.map((c, i) => {
    const assigned = server.characters[i]?.id
    return !c.id && sentIds[i] == null && assigned ? { ...c, id: assigned } : c
  })
  return { ...local, characters }
}

export interface KeywordTarget {
  type: KeywordTestType
  text: string
  label: string
}

/** Texts re-checked before publishing (the official app re-checks after PUT). */
export function publishKeywordTargets(d: PlotDraft): KeywordTarget[] {
  const out: KeywordTarget[] = []
  const add = (type: KeywordTestType, text: string | null | undefined, label: string) => {
    if (text && text.trim()) out.push({ type, text, label })
  }
  add("ABUSING_PLOT_PROMPT", d.name, "タイトル")
  add("ABUSING_PLOT_PROMPT", d.shortDescription, "簡単な説明文")
  add("ABUSING_PLOT_PROMPT", d.longDescription, "説明")
  add("ABUSING_PLOT_PROMPT", d.narrator, "ナレーター")
  add("ABUSING_PLOT_PROMPT", d.creatorComment, "クリエイターコメント")
  for (const block of d.about?.contents ?? []) add("ABUSING_PLOT_PROMPT", block.content ?? null, "紹介文")
  for (const c of d.characters) {
    add("ABUSING_PLOT_PROMPT", c.name ?? null, "キャラ名")
    add("ABUSING_PLOT_PROMPT", c.description ?? null, "キャラ説明")
  }
  for (const cp of d.chatProfiles) {
    add("ABUSING_PLOT_PROMPT", cp.name ?? null, "トークプロフィール名")
    add("ABUSING_PLOT_PROMPT", cp.summary ?? null, "トークプロフィールの概要")
    add("ABUSING_PLOT_PROMPT", cp.description ?? null, "トークプロフィールの説明")
  }
  for (const tag of d.hashtags) add("ABUSING_PLOT_HASHTAG", tag, "ハッシュタグ")
  return out
}

/** Adds or replaces (value given) or removes (value undefined) one plugin entry. */
export function withPluginEntry(
  list: readonly DraftPluginEntry[],
  pluginId: string,
  value: unknown | undefined
): DraftPluginEntry[] {
  const rest = list.filter((e) => e.pluginId !== pluginId)
  return value === undefined ? rest : [...rest, { pluginId, value }]
}

/** Info box scene rows, in the official app's order. */
export const INFO_BOX_SCENE_TYPES: readonly DraftInfoBoxSceneType[] = [
  "DATE",
  "TIME",
  "LOCATION",
  "WEATHER",
  "SITUATION",
]

/** Info box character item rows, in the official app's order. */
export const INFO_BOX_CHARACTER_ITEM_TYPES: readonly DraftInfoBoxItemType[] = [
  "MOOD",
  "CONDITION",
  "OUTFIT",
  "POSE",
  "GOAL",
  "RELATIONSHIP",
  "INNER_THOUGHT",
  "INVENTORY",
]

/** Japanese labels for the info box settings (values are the official app's enums). */
export const SCENE_LABELS: Record<DraftInfoBoxSceneType, string> = {
  DATE: "日付",
  TIME: "時間",
  LOCATION: "場所",
  WEATHER: "天気",
  SITUATION: "状況",
}

export const CHARACTER_ITEM_LABELS: Record<DraftInfoBoxItemType, string> = {
  MOOD: "気分",
  CONDITION: "状態",
  OUTFIT: "服装",
  POSE: "ポーズ",
  GOAL: "目標",
  RELATIONSHIP: "関係性",
  INNER_THOUGHT: "本音",
  INVENTORY: "所持品",
}

export function newCharacterPlaceholder(): DraftCharacter {
  return {}
}

export function newChatProfile(): DraftChatProfile {
  return {
    id: newId(),
    name: null,
    imageUrl: null,
    summary: null,
    description: null,
    isUsingDefaultName: false,
  }
}

export function newExampleConversation(): DraftExampleConversation {
  return { messages: [], randomUsername: null }
}

/** Initial intro, shaped like the one the official app creates (same keys as the server's GET). */
export function newIntro(): DraftIntro {
  return {
    conversation: { messages: [] },
    publicConversationMessageCount: 1,
    playerCharacterSelectionIndex: null,
    backgroundAudioUrl: null,
    backgroundAudioDurationSeconds: null,
  }
}

/** Client-generated temp id, same shape as the official app (`<epoch ms>-<random>`). */
export function newTempId(): string {
  return `${Date.now()}-${Math.random()}`
}
