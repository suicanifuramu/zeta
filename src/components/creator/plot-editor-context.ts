import { createContext, useContext } from "react"
import type { PlotDraftController } from "@/hooks/use-plot-draft"
import type { LimitIssue } from "@/lib/plot-draft"

export type PlotEditorTab = "info" | "content" | "intro" | "style" | "plugin"

/** Which tab a DOM target belongs to (used to reveal the first error). */
export function tabForTarget(target: string): PlotEditorTab {
  if (target.startsWith("plugin")) return "plugin"
  if (target.startsWith("pub-") || target === "lb-open") return "content"
  if (target.startsWith("intro") || target.startsWith("ex-") || target === "cyoa-enabled") return "intro"
  if (target.startsWith("style")) return "style"
  return "info"
}

export interface PlotEditorContextValue {
  plotId: string
  ctrl: PlotDraftController
  /** True when the form must not accept input (no draft, or publishing in progress). */
  locked: boolean
  /** Errors from the last publish attempt, keyed by field target. */
  errors: Record<string, string>
  /** Message to show under a field: a publish error first, then the live limit issue. */
  messageFor: (target: string) => string | null
  /** Live issues whose target is `target`. */
  issuesFor: (prefix: string) => LimitIssue[]
}

export const PlotEditorContext = createContext<PlotEditorContextValue | null>(null)

export function usePlotEditor(): PlotEditorContextValue {
  const value = useContext(PlotEditorContext)
  if (!value) throw new Error("usePlotEditor must be used inside <PlotEditor>")
  return value
}
