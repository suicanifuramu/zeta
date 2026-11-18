import { useState, useCallback } from "react"
import { toast } from "sonner"
import {
  getIntroBeforeSelection,
  getRoom,
  getMyPlotChatProfile,
  getUserChatProfiles,
  getMessages,
  createIntro,
  selectUserChatProfile,
  selectPlotChatProfile,
  selectMyPlotChatProfile,
} from "@/lib/api"
import type {
  UserChatProfile,
  PlotChatProfile,
  MyPlotChatProfileResponse,
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
  myPlotProfile: MyPlotChatProfileResponse | null
  onEmptyRoomDetected: () => Promise<void>
  handleProfileSelect: (profile: UserChatProfile) => Promise<void>
  handlePlotProfileSelect: (profile: PlotProfileItem) => Promise<void>
  handleCreateProfile: (profile: UserChatProfile) => Promise<void>
  handleProfileUpdated: () => Promise<void>
  handleMyPlotProfileSaved: () => Promise<void>
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
  const [myPlotProfile, setMyPlotProfile] =
    useState<MyPlotChatProfileResponse | null>(null)

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
      const [profData, myProfile] = await Promise.all([
        getUserChatProfiles(20, {
          plotId: pid,
          roomId,
        }),
        getMyPlotChatProfile(roomId).catch(() => null),
      ])
      setProfileList(profData.userChatProfiles || [])
      setMyPlotProfile(myProfile)
      setProfileLoading(false)

      const defaultProfile = (profData.userChatProfiles || []).find(
        (p) => p.isDefault || p.selected
      )
      const resolvedPlotProfiles: PlotProfileItem[] = []
      if (myProfile) {
        // Once the room has a `/me` record, it is the only plot profile the
        // UI shows (matching the official web/android clients).
        resolvedPlotProfiles.push({
          id: myProfile.id,
          name: myProfile.name,
          description: myProfile.description,
          summary: myProfile.summary,
          profileImageUrl: myProfile.imageUrl,
          kind: "mine",
        })
      } else {
        // New room: show the creator-defined presets so the user can edit
        // one and start the chat with it.
        const rawProfiles: PlotChatProfile[] =
          roomData?.plot?.chatProfiles || []
        for (const cp of rawProfiles) {
          const usesDefaultName =
            cp.isUsingDefaultName || cp.name === "{{user}}"
          resolvedPlotProfiles.push({
            id: cp.id,
            name:
              usesDefaultName && defaultProfile
                ? defaultProfile.name
                : cp.name,
            description: cp.description,
            summary: cp.summary,
            profileImageUrl: cp.imageUrl,
            kind: "preset",
          })
        }
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
        if (profile.kind === "mine") {
          // Already-created room profile: switch the selection in place.
          await selectMyPlotChatProfile(roomId, profile.id, plotId)
        } else {
          await selectPlotChatProfile({
            roomId,
            plotChatProfileId: profile.id,
            plotId,
            name: profile.name,
            profileImageUrl: profile.profileImageUrl || "",
            summary: profile.summary || "",
            description: profile.description || "",
          })
        }
        await finalizeProfileStart(profile.name)
      } catch (e: unknown) {
        toast.error(
          `チャット開始失敗: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    },
    [roomId, plotId, finalizeProfileStart]
  )

  const handleMyPlotProfileSaved = useCallback(async () => {
    if (!roomId) return
    const myProfile = await getMyPlotChatProfile(roomId).catch(() => null)
    setMyPlotProfile(myProfile)
    setPlotChatProfiles((prev) => {
      if (!myProfile) return prev
      return [
        {
          id: myProfile.id,
          name: myProfile.name,
          description: myProfile.description,
          summary: myProfile.summary,
          profileImageUrl: myProfile.imageUrl,
          kind: "mine" as const,
        },
      ]
    })
    // A preset edit on a brand-new room creates `/me`; finish starting the
    // chat once the record exists.
    if (needsInit && myProfile) {
      await finalizeProfileStart(myProfile.name)
    }
  }, [roomId, needsInit, finalizeProfileStart])

  const handleCreateProfile = useCallback(
    async (profile: UserChatProfile) => {
      await handleProfileSelect(profile)
    },
    [handleProfileSelect]
  )

  const handleProfileUpdated = useCallback(async () => {
    if (!roomId) return
    try {
      const profData = await getUserChatProfiles(20, {
        plotId: plotId || undefined,
        roomId,
      })
      setProfileList(profData.userChatProfiles || [])
    } catch {
      // ignore — profile list will refresh on next open
    }
  }, [roomId, plotId])

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
    myPlotProfile,
    onEmptyRoomDetected,
    handleProfileSelect,
    handlePlotProfileSelect,
    handleCreateProfile,
    handleProfileUpdated,
    handleMyPlotProfileSaved,
  }
}
