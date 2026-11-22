// ===== Stored Accounts =====
// Multiple deviceId / refreshToken pairs are kept in localStorage so the user
// can switch between accounts without re-entering credentials.
// The active account is the one the live session (auth.ts) belongs to.

const ACCOUNTS_KEY = "zeta_accounts"
const ACTIVE_ACCOUNT_KEY = "zeta_active_account_id"

export const ACCOUNTS_UPDATED_EVENT = "zeta-accounts-updated"

export interface StoredAccount {
  id: string
  label: string
  userId: string
  deviceId: string
  refreshToken: string
  gender: string
  imageUrl?: string
  createdAt: number
  lastUsedAt: number
}

function notifyAccountsUpdated(): void {
  window.dispatchEvent(new Event(ACCOUNTS_UPDATED_EVENT))
}

function createAccountId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isStoredAccount(value: unknown): value is StoredAccount {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === "string" &&
    typeof v.deviceId === "string" &&
    typeof v.refreshToken === "string" &&
    Boolean(v.deviceId) &&
    Boolean(v.refreshToken)
  )
}

export function loadAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isStoredAccount)
      .map((a) => ({
        ...a,
        label: String(a.label || fallbackAccountLabel(a.userId)),
        userId: String(a.userId || ""),
        gender: String(a.gender || ""),
        createdAt: Number(a.createdAt) || Number(a.lastUsedAt) || Date.now(),
        lastUsedAt: Number(a.lastUsedAt) || 0,
      }))
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
  } catch {
    return []
  }
}

function saveAccounts(accounts: StoredAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch (e) {
    console.warn("[Accounts] Failed to save accounts:", e)
  }
}

export function fallbackAccountLabel(userId: string): string {
  const id = String(userId || "")
  return id ? `アカウント ${id.slice(0, 8)}` : "現在のアカウント"
}

export function newAccountId(): string {
  return createAccountId()
}

export function getActiveAccountId(): string | null {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY)
}

export function setActiveAccountId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_ACCOUNT_KEY, id)
  else localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
  notifyAccountsUpdated()
}

export function findAccount(id: string): StoredAccount | undefined {
  return loadAccounts().find((a) => a.id === id)
}

export function upsertAccount(account: StoredAccount): StoredAccount {
  const accounts = loadAccounts()
  const index = accounts.findIndex((a) => a.id === account.id)
  if (index >= 0) accounts[index] = account
  else accounts.unshift(account)
  saveAccounts(accounts)
  notifyAccountsUpdated()
  return account
}

export function updateAccount(
  id: string,
  patch: Partial<Omit<StoredAccount, "id">>
): StoredAccount | undefined {
  const accounts = loadAccounts()
  const index = accounts.findIndex((a) => a.id === id)
  if (index < 0) return undefined
  const next = { ...accounts[index], ...patch, id }
  accounts[index] = next
  saveAccounts(accounts)
  return next
}

// Called by auth.ts when the refresh token rotates. Deliberately does not
// notify: the list only shows labels, and token rotation is frequent.
export function syncActiveAccount(
  patch: Partial<Pick<StoredAccount, "deviceId" | "refreshToken">>
): void {
  const id = getActiveAccountId()
  if (!id) return
  updateAccount(id, patch)
}

export function removeAccount(id: string): void {
  saveAccounts(loadAccounts().filter((a) => a.id !== id))
  if (getActiveAccountId() === id) {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
  }
  notifyAccountsUpdated()
}
