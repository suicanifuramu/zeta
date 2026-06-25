import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  initAuth,
  getAuthState as getRawAuthState,
  getAccessToken,
} from "@/lib/auth"
import { runQuizAutomation } from "@/lib/quiz-client"

interface AuthState {
  ready: boolean
  authenticated: boolean
  hasAccessToken: boolean
  hasRefreshToken: boolean
  userId: string
  expiresAt: number
  expiresInSeconds: number
}

const AuthContext = createContext<AuthState>({
  ready: false,
  authenticated: false,
  hasAccessToken: false,
  hasRefreshToken: false,
  userId: "",
  expiresAt: 0,
  expiresInSeconds: 0,
})

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ready: false,
    authenticated: false,
    hasAccessToken: false,
    hasRefreshToken: false,
    userId: "",
    expiresAt: 0,
    expiresInSeconds: 0,
  })

  const prevAccessTokenRef = useRef<string>("")

  useEffect(() => {
    initAuth().then((ok: boolean) => {
      const raw = getRawAuthState()
      const newState = {
        ready: true,
        authenticated: ok,
        hasAccessToken: raw.hasAccessToken,
        hasRefreshToken: raw.hasRefreshToken,
        userId: raw.userId || "",
        expiresAt: raw.expiresAt,
        expiresInSeconds: raw.expiresInSeconds,
      }
      setState(newState)

      if (ok && raw.hasAccessToken) {
        const currentToken = getAccessToken()
        if (currentToken) {
          prevAccessTokenRef.current = currentToken
          runQuizAutomation().then((msg) => console.log("[Quiz] Startup:", msg))
        }
      }
    })

    const handler = () => {
      const raw = getRawAuthState()
      const currentToken = getAccessToken()

      setState((prev) => {
        const next = {
          ...prev,
          authenticated: raw.hasAccessToken,
          hasAccessToken: raw.hasAccessToken,
          hasRefreshToken: raw.hasRefreshToken,
          userId: raw.userId || "",
          expiresAt: raw.expiresAt,
          expiresInSeconds: raw.expiresInSeconds,
        }

        if (
          next.authenticated &&
          currentToken &&
          currentToken !== prevAccessTokenRef.current
        ) {
          prevAccessTokenRef.current = currentToken
          runQuizAutomation().then((msg) => console.log("[Quiz] Refresh:", msg))
        }

        return next
      })
    }

    window.addEventListener("zeta-auth-updated", handler)
    return () => window.removeEventListener("zeta-auth-updated", handler)
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
