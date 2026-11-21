import { useState } from "react"
import { toast } from "sonner"
import {
  clearSession,
  getAuthState,
  getDeviceId,
  getRefreshToken,
  importTokens,
  refreshSession,
  setDeviceId,
  setGender,
  updateRefreshToken,
} from "@/lib/auth"
import { getMyProfile } from "@/lib/api"

export function useSettingsSession() {
  const [deviceId, setDeviceIdState] = useState(getDeviceId())
  const [refreshToken, setRefreshToken] = useState(getRefreshToken())
  const [refreshing, setRefreshing] = useState(false)

  const handleRefreshSession = async () => {
    setRefreshing(true)
    try {
      setDeviceId(deviceId)
      const input = refreshToken.trim()
      // importTokens guesses that a bare 3-part dotted string is an access token,
      // so only cookie/JSON input goes through it; a plain value is the refresh token.
      if (input.includes("=") || input.startsWith("{")) importTokens(input)
      else if (input) updateRefreshToken(input)
      // Force the network call so the newly entered credentials are used even
      // while the current access token is still valid.
      await refreshSession(true)
      setRefreshToken(getRefreshToken())
      const profile = await getMyProfile()
      setGender(profile.gender)
      toast.success("セッションを更新しました")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshing(false)
    }
  }

  const handleLogout = async () => {
    await clearSession()
    setRefreshToken("")
    toast.info("ローカルセッションを削除しました")
  }

  const authState = getAuthState()

  return {
    deviceId,
    setDeviceIdState,
    refreshToken,
    setRefreshToken,
    refreshing,
    handleRefreshSession,
    handleLogout,
    authState,
  }
}
