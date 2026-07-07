import { useState, useRef, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { getPlot, getRoom } from "@/lib/api"
import type { Character, PlotDetailResponse } from "@/lib/types"

export interface UseChatDialogsDeps {
  roomId: string | undefined
  plotId: string
  setPlotId: React.Dispatch<React.SetStateAction<string>>
  characters: Character[]
}

export interface UseChatDialogsReturn {
  plotDetailOpen: boolean
  setPlotDetailOpen: React.Dispatch<React.SetStateAction<boolean>>
  plotDetailData: PlotDetailResponse | null
  characterDetailOpen: boolean
  setCharacterDetailOpen: React.Dispatch<React.SetStateAction<boolean>>
  selectedCharacter: Character | null
  myProfileSheetOpen: boolean
  setMyProfileSheetOpen: React.Dispatch<React.SetStateAction<boolean>>
  myProfileKeyRef: React.MutableRefObject<number>
  exitConfirmOpen: boolean
  setExitConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>
  resetConfirmOpen: boolean
  setResetConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>
  handleAvatarTap: (characterName: string) => void
  handleUserMessageTap: () => void
  handleHeaderClick: () => Promise<void>
}

export function useChatDialogs(deps: UseChatDialogsDeps): UseChatDialogsReturn {
  const { roomId, plotId, setPlotId, characters } = deps

  const [plotDetailOpen, setPlotDetailOpen] = useState(false)
  const [plotDetailData, setPlotDetailData] =
    useState<PlotDetailResponse | null>(null)
  const [characterDetailOpen, setCharacterDetailOpen] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(
    null
  )
  const [myProfileSheetOpen, setMyProfileSheetOpen] = useState(false)
  const myProfileKeyRef = useRef(0)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const handleAvatarTap = useCallback(
    async (characterName: string) => {
      const character = characters.find((c) => c.name === characterName)
      if (!character) return
      setSelectedCharacter(character)
      setCharacterDetailOpen(true)
    },
    [characters]
  )

  const handleUserMessageTap = useCallback(() => {
    myProfileKeyRef.current += 1
    setMyProfileSheetOpen(true)
  }, [])

  // Latest-ref mirror of plotDetailData so handleHeaderClick stays referentially
  // stable across renders where plotDetailData's identity changes (after
  // initial fetch). Read plotDetailDataRef.current inside the callback for
  // the latest value; the useCallback deps no longer need plotDetailData.
  const plotDetailDataRef = useRef<PlotDetailResponse | null>(null)
  useEffect(() => {
    plotDetailDataRef.current = plotDetailData
  }, [plotDetailData])

  const handleHeaderClick = useCallback(async () => {
    try {
      let currentPlotId = plotId
      if (!currentPlotId) {
        if (!roomId) return
        const roomData = await getRoom(roomId)
        currentPlotId = roomData?.plot?.id || ""
        if (currentPlotId) setPlotId(currentPlotId)
      }
      if (!currentPlotId) {
        toast.error("プロット情報が見つかりません")
        return
      }

      const currentDetail = plotDetailDataRef.current
      if (!currentDetail || currentDetail.id !== currentPlotId) {
        const data = await getPlot(currentPlotId)
        setPlotDetailData(data)
      }
      setPlotDetailOpen(true)
    } catch (e: unknown) {
      toast.error(
        `プロット情報取得失敗: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }, [roomId, plotId, setPlotId])

  return {
    plotDetailOpen,
    setPlotDetailOpen,
    plotDetailData,
    characterDetailOpen,
    setCharacterDetailOpen,
    selectedCharacter,
    myProfileSheetOpen,
    setMyProfileSheetOpen,
    myProfileKeyRef,
    exitConfirmOpen,
    setExitConfirmOpen,
    resetConfirmOpen,
    setResetConfirmOpen,
    handleAvatarTap,
    handleUserMessageTap,
    handleHeaderClick,
  }
}
