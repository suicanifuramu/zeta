import { ProfileSelectSheet } from "@/components/profile-select-sheet"
import { PlotDetailDialog } from "@/components/plot-detail-dialog"
import { CharacterDetailSheet } from "@/components/character-detail-sheet"
import { MyProfileSheet } from "@/components/my-profile-sheet"
import type { UserChatProfile, Character, PlotDetailResponse } from "@/lib/types"
import type { PlotProfileItem } from "@/components/profile-select-sheet"

interface ChatOverlaysProps {
  roomId: string
  plotId: string
  profileSheetOpen: boolean
  setProfileSheetOpen: (v: boolean) => void
  profileList: UserChatProfile[]
  plotChatProfiles: PlotProfileItem[]
  profileLoading: boolean
  handleProfileSelect: (profile: UserChatProfile) => Promise<void>
  handlePlotProfileSelect: (profile: PlotProfileItem) => Promise<void>
  handleCreateProfile: (profile: UserChatProfile) => Promise<void>
  plotDetailData: PlotDetailResponse | null
  plotDetailOpen: boolean
  setPlotDetailOpen: (v: boolean) => void
  selectedCharacter: Character | null
  characterDetailOpen: boolean
  setCharacterDetailOpen: (v: boolean) => void
  myProfileSheetOpen: boolean
  setMyProfileSheetOpen: (v: boolean) => void
  myProfileKeyRef: React.RefObject<number>
}

export function ChatOverlays({
  roomId,
  plotId,
  profileSheetOpen,
  setProfileSheetOpen,
  profileList,
  plotChatProfiles,
  profileLoading,
  handleProfileSelect,
  handlePlotProfileSelect,
  handleCreateProfile,
  plotDetailData,
  plotDetailOpen,
  setPlotDetailOpen,
  selectedCharacter,
  characterDetailOpen,
  setCharacterDetailOpen,
  myProfileSheetOpen,
  setMyProfileSheetOpen,
  myProfileKeyRef,
}: ChatOverlaysProps) {
  return (
    <>
      <ProfileSelectSheet
        profiles={profileList}
        plotProfiles={plotChatProfiles}
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
        onSelect={handleProfileSelect}
        onPlotSelect={handlePlotProfileSelect}
        onCreateProfile={handleCreateProfile}
        loading={profileLoading}
      />

      <PlotDetailDialog
        plot={plotDetailData}
        open={plotDetailOpen}
        onOpenChange={setPlotDetailOpen}
      />

      <CharacterDetailSheet
        character={selectedCharacter}
        plotId={plotId}
        open={characterDetailOpen}
        onOpenChange={setCharacterDetailOpen}
      />

      <MyProfileSheet
        key={`my-profile-${myProfileKeyRef.current}`}
        roomId={roomId}
        plotId={plotId}
        open={myProfileSheetOpen}
        onOpenChange={setMyProfileSheetOpen}
      />
    </>
  )
}
