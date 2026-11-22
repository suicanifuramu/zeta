import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  getCreatorPlot,
  patchCreatorPlot,
  setCreatorPlotPrivate,
} from "@/lib/api"
import {
  ALL_SECTIONS,
  adoptCharacterIds,
  buildSectionsBody,
  collectLimitIssues,
  normalizeDraft,
  replaceSectionFromServer,
  SECTION_FIELDS,
  type LimitIssue,
  type SectionKey,
} from "@/lib/plot-draft"
import { getPlotLimits, type PlotLimits } from "@/lib/plot-limits"
import type { CreatorPlot, PlotDraft } from "@/lib/types"
import { UserError } from "@/lib/user-error"

const DEBOUNCE_MS = 700
export const SAVE_ERROR_TEXT = "保存できませんでした。入力内容は保持されています。"

export type SavePhase = "idle" | "pending" | "saving" | "saved" | "error" | "invalid"

export interface SaveState {
  phase: SavePhase
  message: string | null
  savedAt: number | null
}

/** Publication state from the server. */
export interface PlotMeta {
  status: string
  isPrivate: boolean
  hasUnpublishedChanges: boolean
  reviewState: string
  releasedAt: string | null
}

export interface PlotDraftController {
  draft: PlotDraft
  limits: PlotLimits
  meta: PlotMeta
  /** PRERELEASE or RELEASE with a draft: the form accepts input. */
  editable: boolean
  isReleased: boolean
  hasDraft: boolean
  save: SaveState
  /** Unsaved, saving, failed or blocked: navigation should be guarded. */
  dirty: boolean
  issues: LimitIssue[]
  edit: (section: SectionKey, mutate: (draft: PlotDraft) => PlotDraft) => void
  /** Local-only change (for example a cover image set by its own endpoint). Not autosaved. */
  setLocal: (mutate: (draft: PlotDraft) => PlotDraft) => void
  /** Saves every pending section and resolves with the latest draft. Rejects on failure or limit. */
  flush: () => Promise<PlotDraft>
  retry: () => void
  /** Re-reads the given fields from the server, skipping any field whose section has unsent edits. */
  refreshFields: (fields: (keyof PlotDraft & string)[]) => Promise<void>
  setPrivate: (value: boolean) => Promise<void>
  /** Replaces the whole state from a fresh plot (after publishing). Clears pending work. */
  applyPlot: (plot: CreatorPlot) => void
}

function zeroVersions(): Record<SectionKey, number> {
  return {
    basic: 0,
    characters: 0,
    chatProfiles: 0,
    examples: 0,
    lorebooks: 0,
    intros: 0,
    settings: 0,
    publicity: 0,
    plugins: 0,
  }
}

function sectionOf(field: string): SectionKey | null {
  for (const section of ALL_SECTIONS) {
    if ((SECTION_FIELDS[section] as readonly string[]).includes(field)) return section
  }
  return null
}

function metaOf(plot: CreatorPlot): PlotMeta {
  return {
    status: plot.status,
    isPrivate: plot.isPrivate === true,
    hasUnpublishedChanges: plot.hasUnpublishedChanges === true,
    reviewState: typeof plot.reviewState === "string" ? plot.reviewState : "NONE",
    releasedAt: typeof plot.releasedAt === "string" ? plot.releasedAt : null,
  }
}


const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/**
 * Autosave state machine for one plot draft.
 *
 * - Edits mark a section dirty and start a pump. The pump sends one PATCH at a time
 *   (serialized) with all dirty sections, after a debounce.
 * - A section the user did not touch again is replaced from the server's `draft` in the
 *   response. A section edited while the request was in flight keeps the local value and
 *   is sent again. Server-assigned character ids are adopted either way.
 * - A failed request keeps the local value and marks the sections pending again. Nothing
 *   is rolled back, so typed text is never lost.
 * - A section over an input limit is not sent (phase "invalid").
 */
export function usePlotDraft(initial: CreatorPlot): PlotDraftController {
  const plotId = initial.id
  const limits = useMemo(() => getPlotLimits(initial.language), [initial.language])
  const [draft, setDraftState] = useState<PlotDraft>(
    () => normalizeDraft(initial.draft) ?? (normalizeDraft({}) as PlotDraft)
  )
  const [meta, setMeta] = useState<PlotMeta>(() => metaOf(initial))
  const [hasDraft, setHasDraft] = useState<boolean>(initial.draft != null)
  const [save, setSave] = useState<SaveState>({ phase: "idle", message: null, savedAt: null })

  const draftRef = useRef(draft)
  const limitsRef = useRef(limits)
  const editableRef = useRef(false)
  const isPrivateRef = useRef(meta.isPrivate)
  const versionRef = useRef<Record<SectionKey, number>>(zeroVersions())
  const pendingRef = useRef<Set<SectionKey>>(new Set())
  const inflightRef = useRef<Set<SectionKey>>(new Set())
  const lastEditRef = useRef(0)
  const forceRef = useRef(false)
  const blockedRef = useRef<string | null>(null)
  const errorRef = useRef<string | null>(null)
  const pumpRef = useRef<Promise<void> | null>(null)

  const editable = (meta.status === "PRERELEASE" || meta.status === "RELEASE") && hasDraft
  const isReleased = meta.status === "RELEASE"
  useEffect(() => {
    editableRef.current = editable
  }, [editable])

  const issues = useMemo(() => collectLimitIssues(draft, limits), [draft, limits])

  const commit = useCallback((next: PlotDraft) => {
    draftRef.current = next
    setDraftState(next)
  }, [])

  const applyResponse = useCallback(
    (
      plot: CreatorPlot,
      sections: SectionKey[],
      sentVersions: Partial<Record<SectionKey, number>>,
      sentIds: (string | null)[]
    ) => {
      setMeta((prev) => ({ ...prev, ...metaOf(plot) }))
      isPrivateRef.current = plot.isPrivate === true
      const server = normalizeDraft(plot.draft)
      if (!server) return
      let next = draftRef.current
      for (const section of sections) {
        if (versionRef.current[section] === sentVersions[section]) {
          next = replaceSectionFromServer(next, server, section)
        } else if (section === "characters") {
          next = adoptCharacterIds(next, server, sentIds)
        }
      }
      commit(next)
    },
    [commit]
  )

  const runPump = useCallback(async () => {
    // Yield once so that the caller has stored the promise in pumpRef before the loop runs.
    await null
    try {
      for (;;) {
        if (errorRef.current || pendingRef.current.size === 0) break
        if (!forceRef.current) {
          const wait = DEBOUNCE_MS - (Date.now() - lastEditRef.current)
          if (wait > 0) {
            await sleep(wait)
            continue
          }
        }
        const current = draftRef.current
        const pending = [...pendingRef.current]
        const currentIssues = collectLimitIssues(current, limitsRef.current)
        const blocked = pending.filter((s) => currentIssues.some((i) => i.section === s))
        const sendable = pending.filter((s) => !blocked.includes(s))
        for (const s of sendable) pendingRef.current.delete(s)
        if (blocked.length > 0) {
          const message =
            currentIssues.find((i) => blocked.includes(i.section))?.message ?? "入力内容を修正してください"
          blockedRef.current = message
          setSave({ phase: "invalid", message, savedAt: null })
        }
        if (sendable.length === 0) break
        blockedRef.current = null

        const sentVersions: Partial<Record<SectionKey, number>> = {}
        for (const s of sendable) sentVersions[s] = versionRef.current[s]
        const sentIds = current.characters.map((c) => c.id ?? null)
        const body = buildSectionsBody(current, sendable)
        for (const s of sendable) inflightRef.current.add(s)

        setSave((prev) => ({ phase: "saving", message: null, savedAt: prev.savedAt }))
        try {
          const plot = await patchCreatorPlot(plotId, body)
          applyResponse(plot, sendable, sentVersions, sentIds)
          if (sendable.includes("characters")) {
            // A placeholder sent as `{}` must come back with an id. Re-sending it without one
            // would create another character, so stop instead.
            const stillMissing = draftRef.current.characters
              .slice(0, sentIds.length)
              .some((c, i) => sentIds[i] == null && !c.id)
            if (stillMissing) throw new UserError("キャラクターのIDを取得できませんでした")
          }
          setSave({
            phase: pendingRef.current.size > 0 ? "pending" : "saved",
            message: null,
            savedAt: Date.now(),
          })
        } catch (error) {
          for (const s of sendable) pendingRef.current.add(s)
          // The raw error stays in the console; the editor shows the fixed text only.
          console.warn("[creator] autosave failed", error)
          errorRef.current = SAVE_ERROR_TEXT
          setSave({ phase: "error", message: SAVE_ERROR_TEXT, savedAt: null })
          break
        } finally {
          for (const s of sendable) inflightRef.current.delete(s)
        }
      }
    } finally {
      // Cleared synchronously when the loop ends, so a later edit can start a new pump.
      pumpRef.current = null
    }
  }, [applyResponse, plotId])

  const schedulePump = useCallback((): Promise<void> => {
    if (!pumpRef.current) pumpRef.current = runPump()
    return pumpRef.current
  }, [runPump])

  const edit = useCallback(
    (section: SectionKey, mutate: (d: PlotDraft) => PlotDraft) => {
      if (!editableRef.current) return
      commit(mutate(draftRef.current))
      versionRef.current = { ...versionRef.current, [section]: versionRef.current[section] + 1 }
      pendingRef.current.add(section)
      lastEditRef.current = Date.now()
      errorRef.current = null
      blockedRef.current = null
      setSave((prev) => ({ ...prev, phase: "pending", message: null }))
      void schedulePump()
    },
    [commit, schedulePump]
  )

  const setLocal = useCallback(
    (mutate: (d: PlotDraft) => PlotDraft) => {
      commit(mutate(draftRef.current))
    },
    [commit]
  )

  const flush = useCallback(async (): Promise<PlotDraft> => {
    forceRef.current = true
    try {
      errorRef.current = null
      for (;;) {
        await schedulePump()
        if (errorRef.current) throw new UserError(errorRef.current)
        if (blockedRef.current) throw new UserError(blockedRef.current)
        if (pendingRef.current.size === 0) return draftRef.current
      }
    } finally {
      forceRef.current = false
    }
  }, [schedulePump])

  const retry = useCallback(() => {
    void flush().catch(() => undefined)
  }, [flush])

  const refreshFields = useCallback(
    async (fields: (keyof PlotDraft & string)[]) => {
      const fresh = await getCreatorPlot(plotId)
      const server = normalizeDraft(fresh.draft)
      if (!server) return
      let next = draftRef.current
      const copy: Record<string, unknown> = { ...next }
      for (const field of fields) {
        const section = sectionOf(field)
        // Never overwrite a field whose section has unsent or in-flight edits.
        if (section && (pendingRef.current.has(section) || inflightRef.current.has(section))) continue
        const value = (server as Record<string, unknown>)[field]
        if (value !== undefined) copy[field] = value
      }
      next = copy as PlotDraft
      commit(next)
    },
    [commit, plotId]
  )

  const setPrivate = useCallback(
    async (value: boolean) => {
      const previous = isPrivateRef.current
      isPrivateRef.current = value
      setMeta((prev) => ({ ...prev, isPrivate: value }))
      try {
        const plot = await setCreatorPlotPrivate(plotId, value)
        isPrivateRef.current = plot.isPrivate === true
        setMeta((prev) => ({ ...prev, isPrivate: plot.isPrivate === true }))
      } catch (error) {
        isPrivateRef.current = previous
        setMeta((prev) => ({ ...prev, isPrivate: previous }))
        throw error
      }
    },
    [plotId]
  )

  const applyPlot = useCallback(
    (plot: CreatorPlot) => {
      const next = normalizeDraft(plot.draft)
      if (next) commit(next)
      setMeta(metaOf(plot))
      isPrivateRef.current = plot.isPrivate === true
      setHasDraft(plot.draft != null)
      editableRef.current = (plot.status === "PRERELEASE" || plot.status === "RELEASE") && plot.draft != null
      pendingRef.current.clear()
      errorRef.current = null
      blockedRef.current = null
      setSave({ phase: "idle", message: null, savedAt: null })
    },
    [commit]
  )

  // Flush whatever is still pending when the editor unmounts. Requests are not aborted.
  useEffect(() => {
    // The Set and the force flag are never reassigned, so capturing them here is safe.
    const pending = pendingRef.current
    const force = forceRef
    return () => {
      if (pending.size > 0) {
        force.current = true
        void schedulePump()
      }
    }
  }, [schedulePump])

  const dirty = save.phase === "pending" || save.phase === "saving" || save.phase === "error" || save.phase === "invalid"

  return {
    draft,
    limits,
    meta,
    editable,
    isReleased,
    hasDraft,
    save,
    dirty,
    issues,
    edit,
    setLocal,
    flush,
    retry,
    refreshFields,
    setPrivate,
    applyPlot,
  }
}
