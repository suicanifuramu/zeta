import { useCallback, useEffect, useRef, useState } from "react"
import {
  getProfileImageHistory,
  getProfileImageJob,
  getProfileImageResult,
  getProfileImageStyles,
  getSavedProfileImages,
  registerProfileImageJobs,
} from "@/lib/api"
import type { ProfileImageResult, ProfileImageStyle } from "@/lib/types"
import { errorMessage } from "@/lib/creator-util"

const POLL_INTERVAL_MS = 5000
const POLL_MAX_ATTEMPTS = 120

export interface GenerationJob {
  jobId: string
  state: "running" | "done" | "failed"
  message: string | null
}

export interface GenerateParams {
  prompt: string
  quantity: number
  styleId: string
  defaultPrompt: string
  negativePrompt: string
}

function mergeById(
  current: ProfileImageResult[],
  incoming: ProfileImageResult[]
): ProfileImageResult[] {
  const seen = new Set(current.map((r) => r.id))
  return [...current, ...incoming.filter((r) => !seen.has(r.id))]
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/**
 * Style list, generation jobs and result lists for one plot.
 *
 * Jobs are polled every 5 seconds (observed interval). Polling stops when the
 * hook unmounts (sheet closed). Finished images still appear in the history on
 * the next open.
 */
export function useProfileImageGenerator(plotId: string) {
  const [styles, setStyles] = useState<ProfileImageStyle[] | null>(null)
  const [stylesError, setStylesError] = useState<string | null>(null)
  const [history, setHistory] = useState<ProfileImageResult[]>([])
  const [historyCursor, setHistoryCursor] = useState<string | null>(null)
  const [saved, setSaved] = useState<ProfileImageResult[]>([])
  const [savedCursor, setSavedCursor] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [jobs, setJobs] = useState<GenerationJob[]>([])
  const tokenRef = useRef(0)

  useEffect(() => {
    const token = tokenRef.current
    return () => {
      // Cancels polling on unmount; a later mount starts a new token.
      if (token === tokenRef.current) tokenRef.current += 1
    }
  }, [])

  const loadHistory = useCallback(
    async (reset: boolean) => {
      setLoadingList(true)
      setListError(null)
      try {
        const page = await getProfileImageHistory(plotId, {
          cursor: reset ? null : historyCursor,
        })
        setHistory((prev) =>
          reset ? page.profileImages : mergeById(prev, page.profileImages)
        )
        setHistoryCursor(page.nextCursor ?? null)
      } catch (error) {
        setListError(errorMessage(error))
      } finally {
        setLoadingList(false)
      }
    },
    [plotId, historyCursor]
  )

  const loadSaved = useCallback(
    async (reset: boolean) => {
      setLoadingList(true)
      setListError(null)
      try {
        const page = await getSavedProfileImages({
          cursor: reset ? null : savedCursor,
        })
        setSaved((prev) =>
          reset ? page.profileImages : mergeById(prev, page.profileImages)
        )
        setSavedCursor(page.nextCursor ?? null)
      } catch (error) {
        setListError(errorMessage(error))
      } finally {
        setLoadingList(false)
      }
    },
    [savedCursor]
  )

  const setJobState = useCallback(
    (jobId: string, patch: Partial<GenerationJob>) => {
      setJobs((prev) =>
        prev.map((j) => (j.jobId === jobId ? { ...j, ...patch } : j))
      )
    },
    []
  )

  const pollJob = useCallback(
    async (jobId: string, token: number) => {
      await sleep(1000)
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        if (token !== tokenRef.current) return
        try {
          const st = await getProfileImageJob(jobId)
          if (token !== tokenRef.current) return
          if (st.userStatus && st.userStatus !== "NORMAL") {
            const days =
              typeof st.blockDays === "number" ? `（${st.blockDays}日）` : ""
            setJobState(jobId, {
              state: "failed",
              message: `生成が制限されています${days}`,
            })
            return
          }
          if (st.status === "COMPLETE") {
            if (!st.profileImageResultId) {
              setJobState(jobId, {
                state: "failed",
                message: "生成結果を取得できませんでした",
              })
              return
            }
            const result = await getProfileImageResult(st.profileImageResultId)
            if (token !== tokenRef.current) return
            setHistory((prev) => mergeById([result], prev))
            setJobState(jobId, { state: "done", message: null })
            return
          }
          if (st.status !== "IN_PROGRESS") {
            setJobState(jobId, {
              state: "failed",
              message: "生成に失敗しました",
            })
            return
          }
        } catch (error) {
          if (token !== tokenRef.current) return
          setJobState(jobId, {
            state: "failed",
            message: errorMessage(error),
          })
          return
        }
        await sleep(POLL_INTERVAL_MS)
      }
      if (token === tokenRef.current) {
        setJobState(jobId, {
          state: "failed",
          message: "生成に時間がかかっています。履歴から後で確認できます",
        })
      }
    },
    [setJobState]
  )

  /** Registers `quantity` jobs and polls each one. Rejects when registration itself fails. */
  const generate = useCallback(
    async (params: GenerateParams) => {
      const ids = await registerProfileImageJobs(plotId, params)
      const token = tokenRef.current
      setJobs((prev) => [
        ...ids.map((jobId) => ({
          jobId,
          state: "running" as const,
          message: null,
        })),
        ...prev,
      ])
      for (const jobId of ids) void pollJob(jobId, token)
      return ids.length
    },
    [plotId, pollJob]
  )

  // Initial load when the sheet mounts (the sheet is unmounted when closed).
  useEffect(() => {
    let cancelled = false
    getProfileImageStyles()
      .then((list) => {
        if (!cancelled) setStyles(list)
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setStylesError(errorMessage(error))
      })
    getProfileImageHistory(plotId, { limit: 10 })
      .then((page) => {
        if (cancelled) return
        setHistory(page.profileImages)
        setHistoryCursor(page.nextCursor ?? null)
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setListError(errorMessage(error))
      })
    return () => {
      cancelled = true
    }
  }, [plotId])

  const runningCount = jobs.filter((j) => j.state === "running").length

  return {
    styles,
    stylesError,
    history,
    historyCursor,
    loadHistory,
    saved,
    savedCursor,
    loadSaved,
    listError,
    loadingList,
    jobs,
    runningCount,
    generate,
  }
}
