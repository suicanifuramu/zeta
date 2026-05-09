import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { AppShell } from "@/components/layout/app-shell"
import { HomePage } from "@/pages/home"
import { RankingPage } from "@/pages/ranking"
import { RoomsPage } from "@/pages/rooms"
import { ChatPage } from "@/pages/chat"
import { SettingsPage } from "@/pages/settings"
import { Spinner } from "@/components/ui/spinner"
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
    </>
  )
}
