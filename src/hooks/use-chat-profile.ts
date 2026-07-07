import { useState, useCallback } from "react"
import { toast } from "sonner"
import {
  getIntroBeforeSelection,
  getRoom,
  getPlot,
  getUserChatProfiles,
  getMessages,
  createIntro,
  selectUserChatProfile,
  selectPlotChatProfile,
} from "@/lib/api"
import type {
  UserChatProfile,
  PlotChatProfile,
  RuntimeMessage,
} from "@/lib/types"
import type { PlotProfileItem } from "@/components/profile-select-sheet"

export interface UseChatProfileDeps {
  roomId: string | undefined
  plotId: string
  setPlotId: React.Dispatch<React.SetStateAction<string>>
  setCharAvatars: React.Dispatch<React.SetStateAction<Record<string, string>>>
  chatRefs: React.MutableRefObject<{
    scrollToBottom?: () => void
    setMessages?: React.Dispatch<React.SetStateAction<RuntimeMessage[]>>
  }>
}

export interface UseChatProfileReturn {
  needsInit: boolean
  setNeedsInit: React.Dispatch<React.SetStateAction<boolean>>
  profileSheetOpen: boolean
  setProfileSheetOpen: React.Dispatch<React.SetStateAction<boolean>>
  profileList: UserChatProfile[]
  setProfileList: React.Dispatch<React.SetStateAction<UserChatProfile[]>>
  profileLoading: boolean
  setProfileLoading: React.Dispatch<React.SetStateAction<boolean>>
  plotChatProfiles: PlotProfileItem[]
  setPlotChatProfiles: React.Dispatch<React.SetStateAction<PlotProfileItem[]>>
  onEmptyRoomDetected: () => Promise<void>
  handleProfileSelect: (profile: UserChatProfile) => Promise<void>
  handlePlotProfileSelect: (profile: PlotProfileItem) => Promise<void>
  handleCreateProfile: (profile: UserChatProfile) => Promise<void>
}

export function useChatProfile(
  deps: UseChatProfileDeps
): UseChatProfileReturn {
  const {
    roomId,
    plotId,
    setPlotId,
    setCharAvatars,
    chatRefs,
  } = deps

  const [needsInit, setNeedsInit] = useState(false)
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [profileList, setProfileList] = useState<UserChatProfile[]>([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [plotChatProfiles, setPlotChatProfiles] = useState<PlotProfileItem[]>(
    []
  )

  const onEmptyRoomDetected = useCallback(async () => {
    if (!roomId) return
    setNeedsInit(true)
    try {
      const introData = await getIntroBeforeSelection(roomId)
      chatRefs.current.setMessages?.(introData.introMessages || [])

      const roomData = await getRoom(roomId)
      const pid = roomData?.plot?.id || ""
      setPlotId(pid)

      const chars = roomData?.plot?.characters || []
      const avatars: Record<string, string> = {}
      chars.forEach((c) => {
        if (c.name && c.imageUrl) avatars[c.name] = c.imageUrl
      })
      setCharAvatars(avatars)

      setProfileLoading(true)
      const profData = await getUserChatProfiles(20, {
        plotId: pid,
        roomId,
      })
      setProfileList(profData.userChatProfiles || [])
      setProfileLoading(false)

      let resolvedPlotProfiles: PlotProfileItem[] = []
      try {
        const plotDetail = await getPlot(pid)
        const rawProfiles: PlotChatProfile[] = plotDetail.chatProfiles || []
        if (rawProfiles.length > 0) {
          const defaultProfile = (profData.userChatProfiles || []).find(
            (p) => p.isDefault || p.selected
          )
          resolvedPlotProfiles = rawProfiles.map((cp) => ({
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
        /* ignore — plot chat profiles are optional */
      }
      setPlotChatProfiles(resolvedPlotProfiles)
      setProfileSheetOpen(true)
    } catch (e: unknown) {
      toast.error(
        `初期化失敗: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }, [roomId, setPlotId, setCharAvatars, chatRefs])

  const finalizeProfileStart = useCallback(
    async (name: string) => {
      await createIntro(roomId!)
      const data = await getMessages(roomId!, 50)
      chatRefs.current.setMessages?.(data.messages || [])
      setNeedsInit(false)
      setProfileSheetOpen(false)
      toast.success(`「${name}」で開始しました`)
      chatRefs.current.scrollToBottom?.()
    },
    [roomId, chatRefs]
  )

  const handleProfileSelect = useCallback(
    async (profile: UserChatProfile) => {
      if (!roomId) return
      try {
        await selectUserChatProfile(profile.id, { plotId, roomId })
        await finalizeProfileStart(profile.name)
      } catch (e: unknown) {
        toast.error(
          `チャット開始失敗: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    },
    [roomId, plotId, finalizeProfileStart]
  )

  const handlePlotProfileSelect = useCallback(
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
        await finalizeProfileStart(profile.name)
      } catch (e: unknown) {
        toast.error(
          `チャット開始失敗: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    },
    [roomId, plotId, finalizeProfileStart]
  )

  const handleCreateProfile = useCallback(
    async (profile: UserChatProfile) => {
      await handleProfileSelect(profile)
    },
    [handleProfileSelect]
  )

  return {
    needsInit,
    setNeedsInit,
    profileSheetOpen,
    setProfileSheetOpen,
    profileList,
    setProfileList,
    profileLoading,
    setProfileLoading,
    plotChatProfiles,
    setPlotChatProfiles,
    onEmptyRoomDetected,
    handleProfileSelect,
    handlePlotProfileSelect,
    handleCreateProfile,
  }
}
