import { useState, useCallback } from "react"
import { toast } from "sonner"
import { deleteMessages, getMessages } from "@/lib/api"
import type { RuntimeMessage } from "@/lib/types"

export function useChatDeleteMode(
  roomId: string | undefined,
  setMessages: React.Dispatch<React.SetStateAction<RuntimeMessage[]>>
) {
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteMessages = useCallback(async () => {
    if (!roomId || !selectedMsgId) return
    setDeleting(true)
    try {
      await deleteMessages(roomId, selectedMsgId)
      const data = await getMessages(roomId, 50)
      setMessages(data.messages || [])
      toast.success("メッセージを削除しました")
      setDeleteMode(false)
      setSelectedMsgId(null)
    } catch (e: unknown) {
      toast.error(`削除失敗: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDeleting(false)
    }
  }, [roomId, selectedMsgId, setMessages])

  const exitDeleteMode = useCallback(() => {
    setDeleteMode(false)
    setSelectedMsgId(null)
  }, [])

  const enterDeleteMode = useCallback(async () => {
    setDeleteMode(true)
    if (!roomId) return
    try {
      const data = await getMessages(roomId, 50)
      setMessages(data.messages || [])
    } catch (e: unknown) {
      toast.error(
        `履歴の同期に失敗しました: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }, [roomId, setMessages])

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
