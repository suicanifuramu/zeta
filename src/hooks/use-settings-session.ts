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
      if (refreshToken) importTokens(refreshToken)
      await refreshSession()
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
