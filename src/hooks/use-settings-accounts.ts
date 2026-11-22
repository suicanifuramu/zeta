import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ACCOUNTS_UPDATED_EVENT,
  getActiveAccountId,
  loadAccounts,
  type StoredAccount,
} from "@/lib/accounts"
import {
  activateStoredAccount,
  ensureCurrentAccount,
  removeStoredAccount,
} from "@/lib/account-session"

export function useSettingsAccounts() {
  const [accounts, setAccounts] = useState<StoredAccount[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const initialized = useRef(false)

  const reload = useCallback(() => {
    setAccounts(loadAccounts())
    setActiveAccountId(getActiveAccountId())
  }, [])

  useEffect(() => {
    const handler = () => reload()
    window.addEventListener(ACCOUNTS_UPDATED_EVENT, handler)
    return () => window.removeEventListener(ACCOUNTS_UPDATED_EVENT, handler)
  }, [reload])

  useEffect(() => {
    // StrictMode runs effects twice; only the first run should touch the store.
    if (initialized.current) return
    initialized.current = true
    void ensureCurrentAccount()
      .catch((e: unknown) => {
        console.error("[Accounts] Failed to save current account:", e)
      })
      .finally(reload)
  }, [reload])

  const switchAccount = useCallback(
    async (account: StoredAccount) => {
      if (switchingId) return
      setSwitchingId(account.id)
      try {
        await activateStoredAccount(account.id)
        reload()
        toast.success(`「${account.label}」に切り替えました`)
      } catch (e: unknown) {
        reload()
        toast.error(
          `切り替えに失敗しました: ${e instanceof Error ? e.message : String(e)}`
        )
      } finally {
        setSwitchingId(null)
      }
    },
    [reload, switchingId]
  )

  const deleteAccount = useCallback(
    async (account: StoredAccount) => {
      try {
        const wasActive = await removeStoredAccount(account.id)
        reload()
        if (wasActive) {
          toast.info(`「${account.label}」を削除してログアウトしました`)
        } else {
          toast.success(`「${account.label}」を削除しました`)
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : String(e))
      }
    },
    [reload]
  )

  return {
    accounts,
    activeAccountId,
    switchingId,
    switchAccount,
    deleteAccount,
    reload,
  }
}
