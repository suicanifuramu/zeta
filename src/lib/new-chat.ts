// Lightweight new-chat helper. Opens original flow via navigation.
// The full modal flow is handled by NewChatDialog component.
import { toast } from "sonner"
import { createRoom, getActiveRoomId, getPlot } from "@/lib/api"
import { preloadImages } from "@/lib/image-preloader"

export async function startNewChat(
  plotId: string,
  navigate: (path: string) => void
) {
  try {
    // Pre-fetch plot info for header display before navigating
    getPlot(plotId)
      .then((plot) => {
        if (plot?.name)
          sessionStorage.setItem("chat_plot_name", plot.name)
        const img = (plot?.imageUrl || plot?.initialRoomImageUrl || "")
        sessionStorage.setItem("chat_plot_img", img)

        const imageUrls = [plot?.imageUrl, plot?.initialRoomImageUrl].filter(
          Boolean
        ) as string[]
        if (imageUrls.length > 0) {
          preloadImages(imageUrls, { priority: "high" }).catch(() => {})
        }
      })
      .catch(() => {})

    let roomId: string | undefined
    try {
      const data = await getActiveRoomId(plotId)
      roomId = data.roomId
    } catch {
      /* no active room */
    }

    if (!roomId) {
      toast.info("ルームを作成中…")
      const data = await createRoom(plotId)
      roomId = data.id
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
