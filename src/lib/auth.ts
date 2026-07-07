// ===== Auth Module =====
// deviceId / refreshToken / accessToken are stored in localStorage.
// accessToken is also kept in sessionStorage for immediate access.

import { getCommonHeaders } from "./headers"
import { logger } from "./log"

const ACCESS_TOKEN_KEY = "zeta_access_token"
const REFRESH_TOKEN_KEY = "zeta_refresh_token"
const DEVICE_ID_KEY = "zeta_device_id"
const GENDER_KEY = "zeta_gender"

const BASE = "https://api.zeta-ai.io"

let accessToken: string | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let localAuthLoaded = false
let savedDeviceId = ""
let savedRefreshToken = ""

interface ParsedTokens {
  accessToken?: string
  refreshToken?: string
  deviceId?: string
}

function readJsonToken(input: string): ParsedTokens {
  const text = String(input || "").trim()
  if (!text) return {}

  if (/REFRESH_TOKEN=|TOKEN=|DEVICE_ID=/i.test(text)) {
    const values: Record<string, string> = {}
    for (const part of text.split(";")) {
      const [rawKey, ...rawValue] = part.trim().split("=")
      const key = rawKey?.trim()
      const value = rawValue.join("=").trim()
      if (key && value) values[key] = decodeURIComponent(value)
    }
    return {
      accessToken: values.TOKEN || values.token || "",
      refreshToken: values.REFRESH_TOKEN || values.refresh_token || "",
      deviceId: values.DEVICE_ID || values.device_id || "",
    }
  }

  try {
    const parsed = JSON.parse(text) as {
      accessToken?: string
      access_token?: string
      refreshToken?: string
      refresh_token?: string
      deviceId?: string
      device_id?: string
    }
    return {
      accessToken: parsed.accessToken || parsed.access_token || "",
      refreshToken: parsed.refreshToken || parsed.refresh_token || "",
      deviceId: parsed.deviceId || parsed.device_id || "",
    }
  } catch {
    return {}
  }
}

function normalizeBearerToken(token: string): string {
  return String(token || "").trim().replace(/^Bearer\s+/i, "")
}

function makeDeviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function saveLocalAuth(): void {
  if (savedDeviceId) localStorage.setItem(DEVICE_ID_KEY, savedDeviceId)
  if (savedRefreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, savedRefreshToken)
}

export async function loadLocalAuth(force = false): Promise<void> {
  if (localAuthLoaded && !force) return

  savedDeviceId = localStorage.getItem(DEVICE_ID_KEY) || ""
  savedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || ""

  if (!savedDeviceId) {
    savedDeviceId = makeDeviceId()
    saveLocalAuth()
  }

  localAuthLoaded = true
}

function storeRefreshToken(token: string): void {
  const normalized = normalizeBearerToken(token)
  if (normalized) {
    savedRefreshToken = normalized
    saveLocalAuth()
  }
}

function storeAccessToken(token: string): void {
  accessToken = normalizeBearerToken(token)
  if (accessToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    saveLocalAuth()
  }
}

function clearRefreshTimer(): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
}

export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = normalizeBearerToken(token).split(".")[1]
    let base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const pad = base64.length % 4
    if (pad) {
      base64 += "=".repeat(4 - pad)
    }
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    )
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function getTokenExpiry(token: string): number {
  const payload = decodeJwt(token)
  return payload?.exp ? (payload.exp as number) * 1000 : 0
}

export function getAccessToken(): string | null {
  return accessToken
}

export function getRefreshToken(): string {
  return savedRefreshToken
}

export function getDeviceId(): string {
  if (!savedDeviceId) {
    savedDeviceId = makeDeviceId()
    saveLocalAuth()
  }
  return savedDeviceId
}

export function setDeviceId(deviceId: string): void {
  const normalized = String(deviceId || "").trim()
  if (!normalized) return
  savedDeviceId = normalized
  saveLocalAuth()
}

export function getGender(): string {
  return localStorage.getItem(GENDER_KEY) || ""
}

export function setGender(gender: string): void {
  const normalized = String(gender || "").trim().toUpperCase()
  if (normalized) {
    localStorage.setItem(GENDER_KEY, normalized)
  } else {
    localStorage.removeItem(GENDER_KEY)
  }
}

export function clearGender(): void {
  localStorage.removeItem(GENDER_KEY)
}

export function updateRefreshToken(token: string): void {
  const parsed = readJsonToken(token)
  storeRefreshToken(parsed.refreshToken || token)
}

export function updateAccessToken(token: string): void {
  const parsed = readJsonToken(token)
  storeAccessToken(parsed.accessToken || token)
  scheduleRefresh()
}

export function importTokens(input: string): void {
  const parsed = readJsonToken(input)
  if (parsed.deviceId) setDeviceId(parsed.deviceId)
  if (parsed.refreshToken) storeRefreshToken(parsed.refreshToken)
  if (parsed.accessToken) storeAccessToken(parsed.accessToken)
  if (!parsed.refreshToken && !parsed.accessToken) {
    const token = normalizeBearerToken(input)
    if (token.split(".").length === 3) storeAccessToken(token)
    else storeRefreshToken(token)
  }
  scheduleRefresh()
}

export interface AuthState {
  hasAccessToken: boolean
  hasRefreshToken: boolean
  deviceId: string
  expiresAt: number
  expiresInSeconds: number
  userId: string
  timezone: string
  country: string
  gender: string
}

export function getAuthState(): AuthState {
  const payload = decodeJwt(accessToken || "")
  const expiresAt = getTokenExpiry(accessToken || "")
  return {
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(savedRefreshToken),
    deviceId: getDeviceId(),
    expiresAt,
    expiresInSeconds: expiresAt
      ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      : 0,
    userId: (payload?.uid || payload?.sub || "") as string,
    timezone: (payload?.tz || "") as string,
    country: (payload?.cty || "") as string,
    gender: getGender(),
  }
}

let refreshPromise: Promise<string> | null = null

export async function refreshSession(forceNetwork = false): Promise<string> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const oldToken = accessToken
      await loadLocalAuth(true)

      if (
        accessToken !== oldToken &&
        accessToken &&
        getTokenExpiry(accessToken) > Date.now() + 600000
      ) {
        logger.debug("[Auth] Token was updated from local auth")
        scheduleRefresh()
        window.dispatchEvent(
          new CustomEvent("zeta-auth-updated", {
            detail: getAuthState(),
          })
        )
        return accessToken
      }

      if (
        !forceNetwork &&
        accessToken &&
        getTokenExpiry(accessToken) > Date.now() + 600000
      ) {
        logger.debug("[Auth] Token was already refreshed by another process")
        scheduleRefresh()
        window.dispatchEvent(
          new CustomEvent("zeta-auth-updated", {
            detail: getAuthState(),
          })
        )
        return accessToken
      }

      const refreshToken = savedRefreshToken
      if (!refreshToken) throw new Error("Refresh Token is not set")

      const res = await fetch(`${BASE}/v1/auth/tokens`, {
        method: "POST",
        headers: {
          ...getCommonHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          type: "refresh",
          refreshToken,
        }),
      })

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          clearSession()
        }
        throw new Error(`Session refresh failed (${res.status})`)
      }

      const data = (await res.json()) as { accessToken?: string; refreshToken?: string }
      if (!data.accessToken) throw new Error("accessToken is missing in response")

      storeAccessToken(data.accessToken)
      if (data.refreshToken) storeRefreshToken(data.refreshToken)
      scheduleRefresh()
      window.dispatchEvent(
        new CustomEvent("zeta-auth-updated", {
          detail: getAuthState(),
        })
      )
      return accessToken!
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export async function ensureAccessToken(): Promise<string | null> {
  if (accessToken && getTokenExpiry(accessToken) > Date.now() + 30000) {
    return accessToken
  }
  return refreshSession()
}

function scheduleRefresh(): void {
  clearRefreshTimer()
  if (!accessToken || !savedRefreshToken) return

  const expiry = getTokenExpiry(accessToken)
  if (!expiry) return

  const delay = Math.max(expiry - Date.now() - 600000, 10000)
  refreshTimer = setTimeout(async () => {
    try {
      await refreshSession()
      logger.debug("[Auth] Token auto-refreshed")
    } catch (e) {
      console.error("[Auth] Auto-refresh failed:", e)
      window.dispatchEvent(
        new CustomEvent("zeta-auth-error", {
          detail: e instanceof Error ? e.message : String(e),
        })
      )
    }
  }, delay)
}

export async function initAuth(): Promise<boolean> {
  await loadLocalAuth()

  const cachedAccessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (
    cachedAccessToken &&
    getTokenExpiry(cachedAccessToken) > Date.now() + 30000
  ) {
    accessToken = cachedAccessToken
    scheduleRefresh()
    return true
  }

  if (!savedRefreshToken) return false

  try {
    await refreshSession()
    return true
  } catch (e) {
    console.error("[Auth] Init failed:", e)
    return false
  }
}

export async function clearSession(): Promise<void> {
  clearRefreshTimer()
  accessToken = null
  savedRefreshToken = ""
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  clearGender()
  window.dispatchEvent(
    new CustomEvent("zeta-auth-updated", { detail: getAuthState() })
  )
}
