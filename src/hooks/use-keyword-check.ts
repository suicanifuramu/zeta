import { useCallback, useState } from "react"
import { testKeywords } from "@/lib/api"
import { KEYWORD_WARNING_TEXT } from "@/lib/creator-util"
import type { KeywordTestType } from "@/lib/types"

/**
 * Keyword check that runs on blur. Network failures do not block editing; they
 * only show a hint.
 */
export function useKeywordCheck() {
  const [warning, setWarning] = useState<string | null>(null)
  const check = useCallback(
    async (type: KeywordTestType, text: string | null | undefined) => {
      if (!text || !text.trim()) {
        setWarning(null)
        return
      }
      try {
        const flagged = await testKeywords(type, text)
        setWarning(flagged ? KEYWORD_WARNING_TEXT : null)
      } catch {
        setWarning("キーワードの確認に失敗しました")
      }
    },
    []
  )
  return { warning, check }
}
