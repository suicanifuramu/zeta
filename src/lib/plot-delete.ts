import { ApiRequestError, deleteCreatorPlot, getCreatorPlot } from "@/lib/api"
import { UserError } from "@/lib/user-error"

/**
 * Permanent delete with verification (UI-TEST bug 1).
 *
 * The server answered 200 `status:"DELETED"` once, and a few seconds later the plot came back
 * as RELEASE. So success is only reported after the plot is confirmed gone twice, about 2 s
 * apart. If it is still alive, DELETE is sent again after a backoff: at most 3 DELETE calls
 * in total, about 10 s. After that the caller shows an error and stays on the editor.
 */

/** Waits before the 2nd and 3rd DELETE call. */
export const DELETE_BACKOFF_MS = [2000, 4000]
/** Wait before the confirming second check. */
export const DELETE_CONFIRM_MS = 2000

const DELETED_STATUSES: ReadonlySet<string> = new Set(["DELETED", "HARD_DELETED"])

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** True when GET creator answers 404, or the plot's status is a deleted one. */
export async function isPlotGone(plotId: string): Promise<boolean> {
  try {
    const plot = await getCreatorPlot(plotId)
    return DELETED_STATUSES.has(plot.status)
  } catch (error) {
    return error instanceof ApiRequestError && error.status === 404
  }
}

/** Deletes the plot and resolves only once it is verified gone. Rejects with a UserError otherwise. */
export async function deletePlotVerified(plotId: string): Promise<void> {
  const attempts = DELETE_BACKOFF_MS.length + 1
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await deleteCreatorPlot(plotId)
    } catch (error) {
      // 404 on DELETE means it is already gone; the GET below decides. Other failures are retried.
      if (!(error instanceof ApiRequestError && error.status === 404)) {
        console.warn("[creator] delete request failed", error)
      }
    }
    if (await isPlotGone(plotId)) {
      await wait(DELETE_CONFIRM_MS)
      if (await isPlotGone(plotId)) return
    }
    if (attempt < DELETE_BACKOFF_MS.length) await wait(DELETE_BACKOFF_MS[attempt])
  }
  throw new UserError("プロットを削除できませんでした。もう一度お試しください。")
}
