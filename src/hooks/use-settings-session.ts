import { useState } from "react"
import { toast } from "sonner"
import {
  getAuthState,
  getDeviceId,
  getRefreshToken,
  parseTokenInput,
  replaceSession,
  setGender,
} from "@/lib/auth"
import { getActiveAccountId, setActiveAccountId } from "@/lib/accounts"
import {
  ensureCurrentAccount,
  logoutActiveAccount,
} from "@/lib/account-session"
import { getMyProfile } from "@/lib/api"

export function useSettingsSession() {
  const [deviceId, setDeviceIdState] = useState(getDeviceId())
  const [refreshToken, setRefreshToken] = useState(getRefreshToken())
  const [refreshing, setRefreshing] = useState(false)

  const handleRefreshSession = async () => {
    const previousActiveId = getActiveAccountId()
    let replaced = false
    setRefreshing(true)
    try {
      // Drop the active marker first: if these credentials belong to another
      // account, token rotation must not overwrite the current account's copy.
      setActiveAccountId(null)

      const input = refreshToken.trim()
      const parsed = parseTokenInput(input)
      const nextDeviceId = (parsed.deviceId || deviceId).trim()
      let nextRefreshToken = parsed.refreshToken || ""
      if (!nextRefreshToken && !parsed.accessToken) nextRefreshToken = input
      if (!nextRefreshToken) nextRefreshToken = getRefreshToken()

      // Replaces the live credentials and refreshes them. On failure the
      // previous session is restored inside replaceSession().
      await replaceSession({
        deviceId: nextDeviceId,
        refreshToken: nextRefreshToken,
      })
      replaced = true

      setDeviceIdState(getDeviceId())
      setRefreshToken(getRefreshToken())

      // The session is valid already; a profile fetch failure must not roll
      // back freshly rotated tokens.
      let profile: Awaited<ReturnType<typeof getMyProfile>> | undefined
      try {
        profile = await getMyProfile()
        setGender(profile.gender)
      } catch {
        profile = undefined
      }

      await ensureCurrentAccount({
        profile: profile
          ? {
              name: profile.name || profile.nickname || profile.username || "",
              imageUrl: profile.profileImageUrl || "",
              gender: profile.gender,
            }
          : undefined,
      })
      // The profile call may have rotated the refresh token again.
      setRefreshToken(getRefreshToken())
      toast.success("セッションを更新しました")
    } catch (e: unknown) {
      if (!replaced) setActiveAccountId(previousActiveId)
      setDeviceIdState(getDeviceId())
      setRefreshToken(getRefreshToken())
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshing(false)
    }
  }

  const handleLogout = async () => {
    await logoutActiveAccount()
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
