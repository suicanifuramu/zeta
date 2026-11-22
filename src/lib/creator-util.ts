import { UserError } from "@/lib/user-error"

export const KEYWORD_WARNING_TEXT =
  "[警告] 規約違反の可能性があるキーワードが含まれています"

export function formatDateTime(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "") return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

/** Shown for every failure that has no user-safe text of its own. */
export const GENERIC_ERROR_TEXT = "通信でエラーが発生しました。時間をおいて、もう一度お試しください。"

/**
 * Text for the UI. Only UserError messages (written in Japanese by us) are shown as they are.
 * Anything else (HTTP paths, JSON bodies, zod messages) is logged and replaced with the generic text.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof UserError) return error.message
  console.warn("[creator] request failed", error)
  return GENERIC_ERROR_TEXT
}
