import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { Suspense, lazy, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { AppShell } from "@/components/layout/app-shell"
import { Spinner } from "@/components/ui/spinner"

// Lazy-loaded pages for route-based code splitting
const HomePage = lazy(() => import("@/pages/home").then((m) => ({ default: m.HomePage })))
const RankingPage = lazy(() => import("@/pages/ranking").then((m) => ({ default: m.RankingPage })))
const RoomsPage = lazy(() => import("@/pages/rooms").then((m) => ({ default: m.RoomsPage })))
const ChatPage = lazy(() => import("@/pages/chat").then((m) => ({ default: m.ChatPage })))
const SettingsPage = lazy(() => import("@/pages/settings").then((m) => ({ default: m.SettingsPage })))

function PageSpinner() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { ready } = useAuth()

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="size-8" />
          <p className="text-sm text-muted-foreground">接続中…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageSpinner />}>
        <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="ranking" element={<RankingPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="chat/:roomId" element={<ChatPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  )
}
