import { useCallback, useMemo } from "react"
import { toast } from "sonner"
import { createRoom } from "@/lib/api"
import { useLongPress } from "./use-long-press"

export interface UseChatActionsDeps {
  plotId: string
  navigate: (path: string) => void
  releaseBodyLock: () => void
  deleteMode: boolean
  exitDeleteMode: () => void
  enterDeleteMode: () => void
  onResetConfirmOpen: () => void
}

export interface UseChatActionsReturn {
  handleRoomReset: () => Promise<void>
  longPressHandlers: ReturnType<typeof useLongPress>
}

export function useChatActions(deps: UseChatActionsDeps): UseChatActionsReturn {
  const {
    plotId,
    navigate,
    releaseBodyLock,
    deleteMode,
    exitDeleteMode,
    enterDeleteMode,
    onResetConfirmOpen,
  } = deps

  const handleRoomReset = useCallback(async () => {
    if (!plotId) return
    releaseBodyLock()
    try {
      const newRoom = await createRoom(plotId)
      toast.success("ルームをリセットしました")
      navigate(`/chat/${newRoom.id}`)
    } catch (e: unknown) {
      toast.error(
        `ルームリセット失敗: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }, [plotId, navigate, releaseBodyLock])

  const handleResetConfirmAccess = useCallback(
    () => onResetConfirmOpen(),
    [onResetConfirmOpen]
  )
  const handleDeleteToggle = useCallback(
    () => {
      if (deleteMode) exitDeleteMode()
      else enterDeleteMode()
    },
    [deleteMode, exitDeleteMode, enterDeleteMode]
  )

  const longPressHandlers = useLongPress(
    handleResetConfirmAccess,
    handleDeleteToggle
  )

  return useMemo(
    () => ({
      handleRoomReset,
      longPressHandlers,
    }),
    [handleRoomReset, longPressHandlers]
  )
}
