import { useState, useRef, useCallback, useEffect } from "react"
import { toast } from "sonner"
import {
  getMyPlotChatProfile,
  getPlot,
  getRoom,
  getUserChatProfiles,
  selectUserChatProfile,
  selectPlotChatProfile,
} from "@/lib/api"
import type {
  Character,
  PlotDetailResponse,
  PlotChatProfile,
  UserChatProfile,
} from "@/lib/types"
import type { PlotProfileItem } from "@/components/profile-select-sheet"

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
  changeProfileSheetOpen: boolean
  setChangeProfileSheetOpen: React.Dispatch<React.SetStateAction<boolean>>
  changeProfileList: UserChatProfile[]
  changePlotProfiles: PlotProfileItem[]
  changeProfileLoading: boolean
  changeProfileInitialId: string | null
  exitConfirmOpen: boolean
  setExitConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>
  resetConfirmOpen: boolean
  setResetConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>
  handleAvatarTap: (characterName: string) => void
  handleUserMessageTap: () => Promise<void>
  handleChangeProfileSelect: (profile: UserChatProfile) => Promise<void>
  handleChangePlotProfileSelect: (profile: PlotProfileItem) => Promise<void>
  handleCreateChangeProfile: (profile: UserChatProfile) => Promise<void>
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
  const [changeProfileSheetOpen, setChangeProfileSheetOpen] = useState(false)
  const [changeProfileList, setChangeProfileList] = useState<UserChatProfile[]>(
    []
  )
  const [changePlotProfiles, setChangePlotProfiles] = useState<
    PlotProfileItem[]
  >([])
  const [changeProfileLoading, setChangeProfileLoading] = useState(false)
  const [changeProfileInitialId, setChangeProfileInitialId] = useState<
    string | null
  >(null)
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

  const handleUserMessageTap = useCallback(async () => {
    if (!roomId) return
    setChangeProfileLoading(true)
    setChangeProfileInitialId(null)
    try {
      const profData = await getUserChatProfiles(20, {
        plotId: plotId || undefined,
        roomId,
      })
      setChangeProfileList(profData.userChatProfiles || [])

      let plotProfiles: PlotProfileItem[] = []
      if (plotId) {
        try {
          const plotDetail = await getPlot(plotId)
          const rawProfiles: PlotChatProfile[] = plotDetail.chatProfiles || []
          if (rawProfiles.length > 0) {
            const defaultProfile = (
              profData.userChatProfiles || []
            ).find((p) => p.isDefault || p.selected)
            plotProfiles = rawProfiles.map((cp) => ({
              id: cp.id,
              name:
                cp.name === "{{user}}" && defaultProfile
                  ? defaultProfile.name
                  : cp.name,
              description: cp.description,
              summary: cp.summary,
              profileImageUrl: cp.imageUrl,
            }))
          }
        } catch {
          /* ignore */
        }
      }
      setChangePlotProfiles(plotProfiles)

      // Determine currently active profile ID
      try {
        const currentProfile = await getMyPlotChatProfile(roomId)
        if (currentProfile.plotChatProfileId) {
          setChangeProfileInitialId(currentProfile.plotChatProfileId)
        } else {
          const matched = (profData.userChatProfiles || []).find(
            (p) => p.selected
          )
          if (matched) setChangeProfileInitialId(matched.id)
        }
      } catch {
        /* ignore — auto-selection fallback */
      }

      setChangeProfileSheetOpen(true)
    } catch (e: unknown) {
      toast.error(
        `プロフィール取得失敗: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setChangeProfileLoading(false)
    }
  }, [roomId, plotId])

  const handleChangeProfileSelect = useCallback(
    async (profile: UserChatProfile) => {
      if (!roomId) return
      try {
        await selectUserChatProfile(profile.id, {
          plotId: plotId || undefined,
          roomId,
        })
        toast.success(`「${profile.name}」に変更しました`)
        setChangeProfileSheetOpen(false)
      } catch (e: unknown) {
        toast.error(
          `プロフィール変更失敗: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    },
    [roomId, plotId]
  )

  const handleChangePlotProfileSelect = useCallback(
    async (profile: PlotProfileItem) => {
      if (!roomId || !plotId) return
      try {
        await selectPlotChatProfile({
          roomId,
          plotChatProfileId: profile.id,
          plotId,
          name: profile.name,
          profileImageUrl: profile.profileImageUrl || "",
          summary: profile.summary || "",
          description: profile.description || "",
        })
        toast.success(`「${profile.name}」に変更しました`)
        setChangeProfileSheetOpen(false)
      } catch (e: unknown) {
        toast.error(
          `プロフィール変更失敗: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    },
    [roomId, plotId]
  )

  const handleCreateChangeProfile = useCallback(
    async (profile: UserChatProfile) => {
      await handleChangeProfileSelect(profile)
    },
    [handleChangeProfileSelect]
  )

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
    changeProfileSheetOpen,
    setChangeProfileSheetOpen,
    changeProfileList,
    changePlotProfiles,
    changeProfileLoading,
    changeProfileInitialId,
    exitConfirmOpen,
    setExitConfirmOpen,
    resetConfirmOpen,
    setResetConfirmOpen,
    handleAvatarTap,
    handleUserMessageTap,
    handleChangeProfileSelect,
    handleChangePlotProfileSelect,
    handleCreateChangeProfile,
    handleHeaderClick,
  }
}
