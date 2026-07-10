import { useState, useCallback } from "react"
import { toast } from "sonner"
import { getRecommended, getRecommendQuota, refreshRecommended } from "@/lib/api"
import type { RecommendQuotaResponse } from "@/lib/types"

export type RecItem = { text?: string; content?: string; message?: string }

export function useChatRecommend(roomId: string | undefined) {
  const [recItems, setRecItems] = useState<RecItem[]>([])
  const [recVisible, setRecVisible] = useState(false)
  const [recQuota, setRecQuota] = useState<RecommendQuotaResponse | null>(null)
  const [recPage, setRecPage] = useState(0)
  const [recLoading, setRecLoading] = useState(false)

  async function loadRecommendations(refresh = false) {
    if (!roomId) return
    setRecLoading(true)
    try {
      if (refresh) await refreshRecommended(roomId)
      const data = await getRecommended(roomId)
      const rawRec = data.recommendedMessages || data.messages || []
      const items: RecItem[] = []
      for (const entry of rawRec) {
        if (Array.isArray(entry.replies)) items.push(...entry.replies)
        else items.push(entry)
      }
      if (items.length === 0 && !refresh) {
        await loadRecommendations(true)
        return
      }
      setRecItems((prev) => {
        const combined = [...prev, ...items]
        const seen = new Set<string>()
        return combined.filter((it) => {
          const t = it?.text || it?.content || it?.message || ""
          if (!t || seen.has(t)) return false
          seen.add(t)
          return true
        })
      })
      const q = await getRecommendQuota().catch(() => null)
      setRecQuota(q)
    } catch (e: unknown) {
      toast.error(
        `推薦取得失敗: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setRecLoading(false)
    }
  }

  const getRecText = useCallback((item: RecItem) => {
    return item?.text || item?.content || item?.message || ""
  }, [])

  const clearRecItems = useCallback(() => {
    setRecItems([])
    setRecPage(0)
  }, [])

  const pageItems = recItems.slice(recPage * 3, recPage * 3 + 3)

  return {
    recItems,
    recVisible,
    setRecVisible,
    recQuota,
    recPage,
    setRecPage,
    recLoading,
    loadRecommendations,
    getRecText,
    clearRecItems,
    pageItems,
  }
}
