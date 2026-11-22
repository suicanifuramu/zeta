import { useCallback, useSyncExternalStore } from "react"

/**
 * Whether the media query matches. Read synchronously on the first render, so a desktop layout
 * does not start as mobile for a frame (no SSR here; the server snapshot is only a fallback).
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const result = window.matchMedia(query)
      result.addEventListener("change", onChange)
      return () => result.removeEventListener("change", onChange)
    },
    [query]
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}
