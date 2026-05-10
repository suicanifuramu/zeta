// Lightweight new-chat helper. Opens original flow via navigation.
// The full modal flow is handled by NewChatDialog component.
import { toast } from "sonner"
import { createRoom, getActiveRoomId } from "@/lib/api"

export async function startNewChat(plotId: string, navigate: (path: string) => void) {
  try {
    let roomId: string | undefined
    try {
      const data = await getActiveRoomId(plotId)
      roomId = data.roomId
    } catch { /* no active room */ }

    if (!roomId) {
      toast.info("ルームを作成中…")
      const data = await createRoom(plotId)
      roomId = data.id || data.roomId
    }

    if (!roomId) {
      toast.error("ルーム作成に失敗しました")
      return
    }

    navigate(`/chat/${roomId}`)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e))
  }
}
