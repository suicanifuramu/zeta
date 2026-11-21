import { useState, useCallback } from "react"
import { toast } from "sonner"
import { deleteMessages } from "@/lib/api"

export function useChatDeleteMode(
  roomId: string | undefined,
  reloadLatestMessages: () => Promise<void>
) {
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteMessages = useCallback(async () => {
    if (!roomId || !selectedMsgId) return
    setDeleting(true)
    try {
      await deleteMessages(roomId, selectedMsgId)
      await reloadLatestMessages()
      toast.success("メッセージを削除しました")
      setDeleteMode(false)
      setSelectedMsgId(null)
    } catch (e: unknown) {
      toast.error(`削除失敗: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDeleting(false)
    }
  }, [roomId, selectedMsgId, reloadLatestMessages])

  const exitDeleteMode = useCallback(() => {
    setDeleteMode(false)
    setSelectedMsgId(null)
  }, [])

  const enterDeleteMode = useCallback(async () => {
    setDeleteMode(true)
    if (!roomId) return
    try {
      await reloadLatestMessages()
    } catch (e: unknown) {
      toast.error(
        `履歴の同期に失敗しました: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }, [roomId, reloadLatestMessages])

  return {
    deleteMode,
    setDeleteMode,
    selectedMsgId,
    setSelectedMsgId,
    deleting,
    handleDeleteMessages,
    exitDeleteMode,
    enterDeleteMode,
  }
}
