// ===== Quiz Automation (Client-side) =====
import { claimQuiz, getQuiz, joinQuiz, getPlot } from "./api.js"
import type { QuizData, QuizPlot } from "./types"

function isJoined(data: QuizData): boolean {
  return data?.type === "Selected" || Boolean(data?.selection)
}

function isClaimed(data: QuizData): boolean {
  return (
    data?.type === "Claimed" ||
    data?.claimed === true ||
    data?.rewardClaimed === true
  )
}

function getAvailableAt(data: QuizData): Date | null {
  return data.availableAt ? new Date(data.availableAt) : null
}

function getRewardUntil(data: QuizData): Date | null {
  return data.rewardUntil ? new Date(data.rewardUntil) : null
}

function formatTime(date: Date | null): string {
  return date ? date.toLocaleString("ja-JP") : "-"
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getQuizStatus(): Promise<string> {
  try {
    const data = await getQuiz()
    if (!data || !data.id) return "クイズなし"

    const now = new Date()
    const availableAt = getAvailableAt(data)
    const rewardUntil = getRewardUntil(data)

    if (isClaimed(data)) {
      return `報酬受取済み (ID: ${data.id})`
    }

    if (isJoined(data)) {
      if (availableAt && now < availableAt) {
        return `参加済み: 報酬開始待ち (${formatTime(availableAt)})`
      }
      if (
        availableAt &&
        rewardUntil &&
        now >= availableAt &&
        now <= rewardUntil
      ) {
        return `参加済み: 報酬受け取り可能 (ID: ${data.id})`
      }
      if (!availableAt) {
        return `参加済み: 報酬受け取り試行可能 (ID: ${data.id})`
      }
      return `参加済み (ID: ${data.id})`
    }

    const options = (data.question?.plots || [])
      .map((p: QuizPlot) => p.name)
      .join(", ")
    return `未参加: 選択肢 ${options || "-"}`
  } catch (e) {
    console.error("[Quiz] Status check failed:", e)
    return `エラー: ${e instanceof Error ? e.message : String(e)}`
  }
}

export async function runQuizAutomation(): Promise<string> {
  try {
    let data = await getQuiz()
    if (!data || !data.id) return "クイズが見つかりません"

    const quizId = data.id
    console.log("[Quiz] Quiz data:", JSON.stringify(data, null, 2))

    // Already claimed
    if (isClaimed(data)) {
      return "報酬は既に受取済みです"
    }

    // Step 1: Join if not yet joined
    let justJoined = false
    if (!isJoined(data)) {
      const plots = data.question?.plots || []
      if (plots.length === 0) return "クイズに選択肢がありません"

      // Fetch plot details to get interactionCount and select the one with max messages
      let selectedPlot: QuizPlot = plots[0]
      try {
        const plotDetails = await Promise.all(
          plots.map((p: QuizPlot) => getPlot(p.id).catch(() => null))
        )
        const validPlots = plotDetails.filter(
          (p): p is { id: string; name: string; interactionCount?: number } =>
            p !== null && typeof p.interactionCount === "number"
        )
        if (validPlots.length > 0) {
          selectedPlot = validPlots.reduce((max, p) =>
            (p.interactionCount ?? 0) > (max.interactionCount ?? 0) ? p : max
          )
          console.log(
            "[Quiz] Plot interaction counts:",
            validPlots.map((p) => ({
              id: p.id,
              name: p.name,
              count: p.interactionCount,
            }))
          )
          console.log(
            `[Quiz] Selected plot with max messages: ${selectedPlot.id} (${selectedPlot.name}, ${selectedPlot.interactionCount} messages)`
          )
        } else {
          console.log(
            "[Quiz] No valid interactionCount, falling back to first plot"
          )
        }
      } catch (e) {
        console.warn(
          "[Quiz] Failed to fetch plot details, using first plot:",
          e
        )
      }

      console.log(
        `[Quiz] Joining quiz ${quizId} with plot ${selectedPlot.id} (${selectedPlot.name})`
      )
      await joinQuiz(String(quizId), selectedPlot.id)
      justJoined = true

      // Re-fetch to get updated state
      await delay(500)
      data = await getQuiz()
      console.log("[Quiz] After join:", JSON.stringify(data, null, 2))
    }

    // Step 2: Try to claim reward
    const now = new Date()
    const availableAt = getAvailableAt(data)
    const rewardUntil = getRewardUntil(data)

    // If reward window hasn't opened yet, report that
    if (availableAt && now < availableAt) {
      return `参加${justJoined ? "しました" : "済み"}。報酬開始: ${formatTime(availableAt)}`
    }

    // If reward window has closed
    if (rewardUntil && now > rewardUntil) {
      return `参加${justJoined ? "しました" : "済み"}。報酬期間終了 (${formatTime(rewardUntil)})`
    }

    // Attempt claim
    try {
      console.log(`[Quiz] Claiming reward for quiz ${quizId}`)
      const claimResult = await claimQuiz(String(quizId))
      console.log("[Quiz] Claim result:", JSON.stringify(claimResult, null, 2))
      return `報酬を受け取りました${claimResult?.reward ? ` (${JSON.stringify(claimResult.reward)})` : ""}`
    } catch (claimError: unknown) {
      const claimErr = claimError as Error
      console.warn("[Quiz] Claim failed:", claimErr.message)

      // If we just joined, wait a bit and retry
      if (justJoined) {
        console.log("[Quiz] Retrying claim after delay...")
        await delay(2000)
        try {
          const retryResult = await claimQuiz(String(quizId))
          console.log(
            "[Quiz] Retry claim result:",
            JSON.stringify(retryResult, null, 2)
          )
          return `報酬を受け取りました (リトライ)${retryResult?.reward ? ` (${JSON.stringify(retryResult.reward)})` : ""}`
        } catch (retryError) {
          return `参加しました。報酬受け取り失敗: ${retryError instanceof Error ? retryError.message : String(retryError)}`
        }
      }

      return `参加済み。報酬受け取り失敗: ${claimErr.message}`
    }
  } catch (e) {
    console.error("[Quiz] Automation failed:", e)
    return `エラー: ${e instanceof Error ? e.message : String(e)}`
  }
}
