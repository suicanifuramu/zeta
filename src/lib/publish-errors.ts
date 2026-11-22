import { ApiRequestError } from "@/lib/api"
import { collectLimitIssues, type LimitIssue } from "@/lib/plot-draft"
import type { PlotLimits } from "@/lib/plot-limits"
import type { PlotDraft } from "@/lib/types"
import { UserError } from "@/lib/user-error"

/**
 * Maps a publish failure (PUT / PATCH status / keyword check) to the field that must change,
 * or to a message when no field is known. Follows PHASE5 §3 (CONSTRAINT_VIOLATION_FIELD_MAP,
 * ABUSED_CODES, plugin rejection) and the live checks in PHASE5-LIVE.
 *
 * Length texts are used only when the client itself sees the value over its limit; otherwise
 * the server's rule is described (LIVE: PLOT_INTRO_CONSTRAINT_VIOLATION is not a length rule).
 * Raw server text never reaches the caller's message.
 */

export const PUBLISH_FALLBACK_TEXT = "公開できませんでした。通信状態を確認して、もう一度お試しください。"
export const ABUSE_TEXT = "入力内容に不適切な表現が含まれています"
export const PLUGIN_PUBLISH_TEXT = "現在の状態ではプラグイン設定を公開できません。設定をもう一度ご確認ください"

export type PublishFailure =
  | { kind: "fields"; issues: LimitIssue[] }
  | { kind: "message"; message: string }

/** Abuse codes (PHASE5 §3.2): PlotAbused* plus PlotAboutImageAbused. No field is reported for them. */
const ABUSE_CODE = /^PlotAbused|^PlotAboutImageAbused$/

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Index of the first name that repeats an earlier one (compared trimmed and case-insensitively). */
function duplicateIndex(names: readonly (string | null | undefined)[]): number {
  const seen = new Set<string>()
  for (let i = 0; i < names.length; i++) {
    const key = (names[i] ?? "").trim().toLowerCase()
    if (key === "") continue
    if (seen.has(key)) return i
    seen.add(key)
  }
  return 0
}

/** Plugin failure: the plugin named in the server text, when there is one, otherwise the section. */
function pluginIssue(error: ApiRequestError, draft: PlotDraft): LimitIssue {
  const text = error.serverMessage ?? ""
  const named = (draft.plugins ?? [])
    .map((p) => p.pluginId)
    .find((id) => new RegExp(`(^|[^a-z0-9-])${escapeRegExp(id.toLowerCase())}($|[^a-z0-9-])`).test(text.toLowerCase()))
  return {
    section: "plugins",
    target: named ? `plugin-${named}` : "plugins",
    message: PLUGIN_PUBLISH_TEXT,
  }
}

/** Maps one server code to a field, or null when the code has no field (fallback message). */
function issueForCode(error: ApiRequestError, draft: PlotDraft, limits: PlotLimits): LimitIssue | null {
  const code = error.code ?? ""
  const live = collectLimitIssues(draft, limits)
  // The editor's own over-limit message for a target, if the client sees one.
  const overAt = (...targets: string[]): string | null =>
    live.find((i) => targets.includes(i.target))?.message ?? null

  if (code.startsWith("PLUGIN_")) return pluginIssue(error, draft)

  switch (code) {
    case "PLOT_NAME_CONSTRAINT_VIOLATION":
      return { section: "basic", target: "plot-name", message: overAt("plot-name") ?? "タイトルを確認してください" }
    case "PLOT_CONTENT_CONSTRAINT_VIOLATION":
      return {
        section: "basic",
        target: "plot-description",
        message: overAt("plot-description") ?? "説明を確認してください",
      }
    case "PLOT_CHARACTER_CONSTRAINT_VIOLATION":
      return {
        section: "characters",
        target: "char-add",
        message: overAt("char-add") ?? "キャラクターの設定を確認してください",
      }
    case "PLOT_CHARACTER_NAME_DUPLICATE_CONSTRAINT_VIOLATION":
      return {
        section: "characters",
        target: `char-name-${duplicateIndex(draft.characters.map((c) => c.name))}`,
        message: "同じ名前のキャラクターが存在します",
      }
    case "PLOT_CHARACTER_IMAGE_CONSTRAINT_VIOLATION":
      // The server checks characters[0] only (LIVE).
      return { section: "characters", target: "char-image-0", message: "プロフィール画像を設定してください" }
    case "PLOT_CHAT_PROFILE_CONSTRAINT_VIOLATION": {
      const profiles = draft.chatProfiles
      const noImage = profiles.findIndex((cp) => !cp.imageUrl)
      if (noImage >= 0) {
        return { section: "chatProfiles", target: `cp-image-${noImage}`, message: "プロフィール画像を設定してください" }
      }
      const noSummary = profiles.findIndex((cp) => !(cp.summary ?? "").trim())
      if (noSummary >= 0) {
        return {
          section: "chatProfiles",
          target: `cp-summary-${noSummary}`,
          message: "トークプロフィール紹介を入力してください",
        }
      }
      const noName = profiles.findIndex((cp) => !cp.isUsingDefaultName && !(cp.name ?? "").trim())
      if (noName >= 0) {
        return { section: "chatProfiles", target: `cp-name-${noName}`, message: "トークプロフィール名を入力してください" }
      }
      return {
        section: "chatProfiles",
        target: "cp-add",
        message: overAt("cp-add") ?? "トークプロフィールの設定を確認してください",
      }
    }
    case "PLOT_CHAT_PROFILE_NAME_DUPLICATE_CONSTRAINT_VIOLATION":
      return {
        section: "chatProfiles",
        target: `cp-name-${duplicateIndex(draft.chatProfiles.map((cp) => cp.name))}`,
        message: "同じ名前のトークプロフィールが存在します",
      }
    case "PLOT_EXAMPLE_CONVERSATION_CONSTRAINT_VIOLATION":
      return { section: "examples", target: "ex-section", message: overAt("ex-total") ?? "状況例を確認してください" }
    case "PLOT_INTRO_CONSTRAINT_VIOLATION":
      // Not a length rule unless the client sees the intro over its limit (PHASE5 §3.5, LIVE §4).
      return {
        section: "intros",
        target: draft.intros.length === 0 ? "intro-create" : "intro-add",
        message:
          overAt("intro-total", "intro-add") ?? "イントロには1つ以上のメッセージが必要です",
      }
    case "PLOT_INTRO_IMAGE_CAPTION_LENGTH_EXCEEDED":
      return { section: "intros", target: "intro-total", message: overAt("intro-total") ?? "イントロの文字数を確認してください" }
    case "PLOT_SHORT_DESCRIPTION_CONSTRAINT_VIOLATION":
      return {
        section: "publicity",
        target: "pub-short-input",
        message: overAt("pub-short-input") ?? "簡単な説明文を確認してください",
      }
    case "PLOT_CREATOR_COMMENT_CONSTRAINT_VIOLATION":
      return {
        section: "publicity",
        target: "pub-comment-input",
        message: overAt("pub-comment-input") ?? "クリエイターコメントを確認してください",
      }
    case "PLOT_ABOUT_CONSTRAINT_VIOLATION":
      // Not in PHASE5 §3.1 (the official app shows a generic toast). Mapped to the 紹介文 field here.
      return {
        section: "publicity",
        target: "pub-about-input",
        message: overAt("pub-about-input") ?? "紹介文を確認してください",
      }
    default:
      return null
  }
}

/** Turns a publish failure into field issues (the editor reveals them) or a message for the dialog. */
export function mapPublishError(error: unknown, draft: PlotDraft, limits: PlotLimits): PublishFailure {
  if (error instanceof UserError) return { kind: "message", message: error.message }
  if (!(error instanceof ApiRequestError)) return { kind: "message", message: PUBLISH_FALLBACK_TEXT }
  if (ABUSE_CODE.test(error.code ?? "")) return { kind: "message", message: ABUSE_TEXT }
  const issue = issueForCode(error, draft, limits)
  if (issue) return { kind: "fields", issues: [issue] }
  return { kind: "message", message: PUBLISH_FALLBACK_TEXT }
}
