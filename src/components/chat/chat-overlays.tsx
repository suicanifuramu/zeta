import { ProfileSelectSheet } from "@/components/profile-select-sheet"
import { PlotDetailDialog } from "@/components/plot-detail-dialog"
import { CharacterDetailSheet } from "@/components/character-detail-sheet"
import type {
  UserChatProfile,
  Character,
  MyPlotChatProfileResponse,
  PlotDetailResponse,
} from "@/lib/types"
import type { PlotProfileItem } from "@/components/profile-select-sheet"

interface ChatOverlaysProps {
  roomId: string | undefined
  plotId: string
  profileSheetOpen: boolean
  setProfileSheetOpen: (v: boolean) => void
  profileList: UserChatProfile[]
  plotChatProfiles: PlotProfileItem[]
  myPlotProfile: MyPlotChatProfileResponse | null
  profileLoading: boolean
  handleProfileSelect: (profile: UserChatProfile) => Promise<void>
  handlePlotProfileSelect: (profile: PlotProfileItem) => Promise<void>
  handleCreateProfile: (profile: UserChatProfile) => Promise<void>
  handleMyPlotProfileSaved: () => Promise<void>
  plotDetailData: PlotDetailResponse | null
  plotDetailOpen: boolean
  setPlotDetailOpen: (v: boolean) => void
  selectedCharacter: Character | null
  characterDetailOpen: boolean
  setCharacterDetailOpen: (v: boolean) => void
  changeProfileSheetOpen: boolean
  setChangeProfileSheetOpen: (v: boolean) => void
  changeProfileList: UserChatProfile[]
  changePlotProfiles: PlotProfileItem[]
  changeMyPlotProfile: MyPlotChatProfileResponse | null
  changeProfileLoading: boolean
  changeProfileInitialId: string | null
  handleChangeProfileSelect: (profile: UserChatProfile) => Promise<void>
  handleChangePlotProfileSelect: (profile: PlotProfileItem) => Promise<void>
  handleCreateChangeProfile: (profile: UserChatProfile) => Promise<void>
  handleProfileUpdated: () => Promise<void>
  handleChangeMyPlotProfileSaved: () => Promise<void>
  handleChangeProfileUpdated: () => Promise<void>
}

export function ChatOverlays({
  roomId,
  plotId,
  profileSheetOpen,
  setProfileSheetOpen,
  profileList,
  plotChatProfiles,
  myPlotProfile,
  profileLoading,
  handleProfileSelect,
  handlePlotProfileSelect,
  handleCreateProfile,
  handleMyPlotProfileSaved,
  plotDetailData,
  plotDetailOpen,
  setPlotDetailOpen,
  selectedCharacter,
  characterDetailOpen,
  setCharacterDetailOpen,
  changeProfileSheetOpen,
  setChangeProfileSheetOpen,
  changeProfileList,
  changePlotProfiles,
  changeMyPlotProfile,
  changeProfileLoading,
  changeProfileInitialId,
  handleChangeProfileSelect,
  handleChangePlotProfileSelect,
  handleCreateChangeProfile,
  handleProfileUpdated,
  handleChangeMyPlotProfileSaved,
  handleChangeProfileUpdated,
}: ChatOverlaysProps) {
  return (
    <>
      <ProfileSelectSheet
        roomId={roomId}
        plotId={plotId}
        myPlotProfile={myPlotProfile}
        onMyPlotProfileSaved={handleMyPlotProfileSaved}
        profiles={profileList}
        plotProfiles={plotChatProfiles}
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
        onSelect={handleProfileSelect}
        onPlotSelect={handlePlotProfileSelect}
        onCreateProfile={handleCreateProfile}
        onProfileUpdated={handleProfileUpdated}
        loading={profileLoading}
      />

      <ProfileSelectSheet
        variant="change"
        roomId={roomId}
        plotId={plotId}
        myPlotProfile={changeMyPlotProfile}
        onMyPlotProfileSaved={handleChangeMyPlotProfileSaved}
        profiles={changeProfileList}
        plotProfiles={changePlotProfiles}
        open={changeProfileSheetOpen}
        onOpenChange={setChangeProfileSheetOpen}
        onSelect={handleChangeProfileSelect}
        onPlotSelect={handleChangePlotProfileSelect}
        onCreateProfile={handleCreateChangeProfile}
        onProfileUpdated={handleChangeProfileUpdated}
        loading={changeProfileLoading}
        initialSelectedId={changeProfileInitialId || undefined}
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
    </>
  )
}
