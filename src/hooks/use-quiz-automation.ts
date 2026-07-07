import { useEffect, useRef } from "react"
import { runQuizAutomation } from "@/lib/quiz-client"
import { getAccessToken } from "@/lib/auth"

export function useQuizAutomation() {
  const prevTokenRef = useRef<string>("")

  useEffect(() => {
    const handler = () => {
      const token = getAccessToken()
      if (token && token !== prevTokenRef.current) {
        prevTokenRef.current = token
        runQuizAutomation()
      }
    }

    // Run on mount if token already exists
    const token = getAccessToken()
    if (token) {
      prevTokenRef.current = token
      runQuizAutomation()
    }

    window.addEventListener("zeta-auth-updated", handler)
    return () => window.removeEventListener("zeta-auth-updated", handler)
  }, [])
}
