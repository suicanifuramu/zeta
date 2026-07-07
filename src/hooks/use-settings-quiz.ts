import { useEffect, useState } from "react"
import * as quizClient from "@/lib/quiz-client"

export function useSettingsQuiz() {
  const [quizStatus, setQuizStatus] = useState("確認中...")

  useEffect(() => {
    void (async () => {
      try {
        setQuizStatus(await quizClient.getQuizStatus())
      } catch {
        setQuizStatus("取得失敗")
      }
    })()
  }, [])

  const runQuiz = async () => {
    setQuizStatus("実行中...")
    const result = await quizClient.runQuizAutomation()
    setQuizStatus(result)
    return result
  }

  return { quizStatus, setQuizStatus, runQuiz }
}
