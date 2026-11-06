import { useEffect, useRef, useState } from "react"
import { getSearchSuggestions, type SearchSuggestion } from "@/lib/api"

const DEBOUNCE_MS = 200

/**
 * Debounced hashtag suggestions for the search input.
 * Only fetches while the input is focused, and drops stale responses.
 */
export function useSearchSuggestions(
  query: string,
  enabled: boolean
): SearchSuggestion[] {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const requestIdRef = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (!enabled || q.length === 0) {
      requestIdRef.current += 1
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      const requestId = ++requestIdRef.current
      try {
        const list = await getSearchSuggestions(q)
        if (requestId === requestIdRef.current) setSuggestions(list)
      } catch {
        // Suggestion failures are silent — the results list is the source of truth.
        if (requestId === requestIdRef.current) setSuggestions([])
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query, enabled])

  return suggestions
}
