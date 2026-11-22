// ===== Account session orchestration =====
// Bridges the multi-account store (accounts.ts) and the live session (auth.ts).

import {
  clearSession,
  getAuthState,
  getDeviceId,
  getGender,
  getRefreshToken,
  replaceSession,
} from "./auth"
import {
  fallbackAccountLabel,
  findAccount,
  getActiveAccountId,
  loadAccounts,
  newAccountId,
  removeAccount,
  setActiveAccountId,
  upsertAccount,
  type StoredAccount,
} from "./accounts"
import { getMyProfile } from "./api"

interface AccountProfile {
  name?: string
  imageUrl?: string | null
  gender?: string
}

async function fetchProfile(): Promise<AccountProfile | undefined> {
  try {
    const profile = await getMyProfile()
    return {
      name: profile.name || profile.nickname || profile.username || "",
      imageUrl: profile.profileImageUrl || "",
      gender: profile.gender,
    }
  } catch {
    return undefined
  }
}

// Makes sure the account the live session belongs to exists in the store and
// is marked as active. This is also the migration path for users who already
// had a single session stored before account switching existed.
export async function ensureCurrentAccount(
  options: {
    profile?: AccountProfile
  } = {}
): Promise<StoredAccount | null> {
  const stateBefore = getAuthState()
  const tokenBefore = getRefreshToken()
  if (!tokenBefore) return null

  const accounts = loadAccounts()
  const activeId = getActiveAccountId()
  let account = activeId ? accounts.find((a) => a.id === activeId) : undefined
  if (!account) {
    account =
      (stateBefore.userId
        ? accounts.find((a) => a.userId === stateBefore.userId)
        : undefined) ?? accounts.find((a) => a.refreshToken === tokenBefore)
  }

  const fetchedProfile =
    !account && !options.profile ? await fetchProfile() : undefined

  // A profile fetch can trigger a token refresh and gives another switch time
  // to complete, so re-read the live session and re-resolve the account.
  const state = getAuthState()
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  const sessionChanged =
    state.userId !== stateBefore.userId ||
    state.deviceId !== stateBefore.deviceId
  const profile =
    options.profile ?? (sessionChanged ? undefined : fetchedProfile)

  // Adding an account remounts this page, so two ensure calls can race. The
  // first one stores the account while the other is fetching the profile;
  // re-check before creating so the same session never produces duplicates.
  const latest = loadAccounts()
  const latestActiveId = getActiveAccountId()
  account =
    (latestActiveId
      ? latest.find((a) => a.id === latestActiveId)
      : undefined) ??
    (state.userId
      ? latest.find((a) => a.userId === state.userId)
      : undefined) ??
    latest.find((a) => a.refreshToken === refreshToken) ??
    (sessionChanged ? undefined : account)

  const now = Date.now()

  const next: StoredAccount = {
    id: account?.id ?? newAccountId(),
    label:
      profile?.name?.trim() ||
      account?.label ||
      fallbackAccountLabel(state.userId),
    userId: state.userId || account?.userId || "",
    deviceId: getDeviceId(),
    refreshToken,
    gender: profile?.gender || state.gender || account?.gender || "",
    imageUrl: profile?.imageUrl ?? account?.imageUrl ?? "",
    createdAt: account?.createdAt ?? now,
    lastUsedAt: now,
  }

  upsertAccount(next)
  setActiveAccountId(next.id)
  return next
}

export async function activateStoredAccount(
  id: string
): Promise<StoredAccount> {
  const account = findAccount(id)
  if (!account) throw new Error("アカウントが見つかりません")

  const previousActiveId = getActiveAccountId()

  try {
    // replaceSession() clears the active marker while the credentials are
    // swapped, so the store cannot attribute the new token to the old account.
    await replaceSession({
      deviceId: account.deviceId,
      refreshToken: account.refreshToken,
      gender: account.gender,
    })
  } catch (e) {
    setActiveAccountId(previousActiveId)
    throw e
  }

  const next: StoredAccount = {
    ...account,
    userId: getAuthState().userId || account.userId,
    deviceId: getDeviceId(),
    refreshToken: getRefreshToken(),
    gender: getGender() || account.gender,
    lastUsedAt: Date.now(),
  }
  upsertAccount(next)
  setActiveAccountId(next.id)
  return next
}

// Returns true when the removed account was the live one (caller just logged out).
export async function removeStoredAccount(id: string): Promise<boolean> {
  const wasActive = getActiveAccountId() === id
  removeAccount(id)
  if (!wasActive) return false
  await clearSession()
  return true
}

// Logging out drops the active account's saved credentials too; other saved
// accounts stay available for switching.
export async function logoutActiveAccount(): Promise<void> {
  const activeId = getActiveAccountId()
  if (activeId) removeAccount(activeId)
  await clearSession()
}
