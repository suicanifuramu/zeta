import type { CyoaChoice, RuntimeMessage } from "./types"

/**
 * Returns the CYOA choices the user can still act on.
 *
 * Newer Zeta API builds attach `cyoa.choices` to individual BOT messages
 * (including the last intro message). Choices are only live while they belong
 * to the newest turn, so anything older than the last USER message is stale.
 */
export function getActiveCyoaChoices(messages: RuntimeMessage[]): CyoaChoice[] {
  if (!Array.isArray(messages) || messages.length === 0) return []

  let lastUserIndex = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.sender?.type === "USER") {
      lastUserIndex = i
      break
    }
  }

  for (let i = messages.length - 1; i > lastUserIndex; i -= 1) {
    const choices = messages[i]?.cyoa?.choices
    if (!Array.isArray(choices) || choices.length === 0) continue

    return choices
      .filter((choice): choice is CyoaChoice => Boolean(choice))
      .map((choice) => ({
        title: choice.title ?? null,
        text: typeof choice.text === "string" ? choice.text.trim() : "",
      }))
      .filter((choice) => choice.text.length > 0)
  }

  return []
}

/** Stable signature so callers can reset paging when the choice set changes. */
export function getCyoaSignature(choices: CyoaChoice[]): string {
  return choices.map((choice) => choice.text).join("\u0000")
}
