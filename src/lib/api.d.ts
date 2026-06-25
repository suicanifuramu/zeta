// TypeScript declarations for api.js
import type {
  ApiHomeResponse,
  ApiRankingResponse,
  ApiRoomsResponse,
  ApiMessagesResponse,
  SessionOverview,
  UserChatProfile,
  QuizData,
  SpecialCurationResponse,
  Banner,
  Popup,
  FeatureFlagResponse,
  GenreRankingResponse,
  PlotDetailResponse,
  PlotImage,
  CharacterImageResponse,
  SimilarPlotsResponse,
  LikedPlotsResponse,
  ActiveRoomIdResponse,
  CreateRoomResponse,
  RoomDetailResponse,
  DeleteRoomResponse,
  ModelSettingResponse,
  CyoaSettingResponse,
  IntroBeforeSelectionResponse,
  CreateIntroResponse,
  SelectedPersonaResponse,
  CandidatesResponse,
  SelectCandidateResponse,
  EditMessageResponse,
  DeleteMessagesResponse,
  RecommendedResponse,
  RefreshRecommendedResponse,
  RecommendQuotaResponse,
  CoinBalanceResponse,
  AutoPaymentSettingsResponse,
  CreatorStatsResponse,
  SubscriptionResponse,
  PromotionEligibilityResponse,
  ProConversionStatusResponse,
  NotificationTimeResponse,
  PushSettingResponse,
  StoreProductsResponse,
  UserChatProfilesResponse,
  AbuseCheckResponse,
  SelectProfileResponse,
  QuizData,
  JoinQuizResponse,
  ClaimQuizResponse,
} from "./types"

// Home/Discovery
export function getHomePlots(
  limit?: number,
  cursor?: string
): Promise<ApiHomeResponse>
export function getSpecialCuration(): Promise<SpecialCurationResponse>
export function getBanners(): Promise<Banner[]>
export function getPopups(): Promise<Popup[]>
export function getFeatureFlag(name: string): Promise<FeatureFlagResponse>

// Ranking
export function getGenresRanking(): Promise<GenreRankingResponse>
export function getRanking(
  type?: string,
  limit?: number,
  filterValues?: string
): Promise<ApiRankingResponse>

// Plots / rooms
export function getPlot(plotId: string): Promise<PlotDetailResponse>
export function getPlotImages(plotId: string): Promise<PlotImage[]>
export function getCharacterImages(
  plotId: string,
  characterId: string
): Promise<CharacterImageResponse>
export function getSimilarPlots(
  plotId: string,
  limit?: number
): Promise<SimilarPlotsResponse>
export function getLikedPlots(limit?: number): Promise<LikedPlotsResponse>
export function getActiveRoomId(plotId: string): Promise<ActiveRoomIdResponse>
export function createRoom(plotId: string): Promise<CreateRoomResponse>
export function getRooms(limit?: number): Promise<ApiRoomsResponse>
export function getRoom(roomId: string): Promise<RoomDetailResponse>
export function deleteRoom(roomId: string): Promise<DeleteRoomResponse>
export function getRoomModelSetting(
  roomId: string
): Promise<ModelSettingResponse>
export function getRoomCyoaSetting(roomId: string): Promise<CyoaSettingResponse>
export function getIntroBeforeSelection(
  roomId: string
): Promise<IntroBeforeSelectionResponse>
export function createIntro(roomId: string): Promise<CreateIntroResponse>
export function getSelectedPersona(
  plotId: string,
  roomId: string
): Promise<SelectedPersonaResponse>

// Messages
export function getMessages(
  roomId: string,
  limit?: number
): Promise<ApiMessagesResponse>
export function getMessagesByCursor(
  roomId: string,
  cursor: string,
  limit?: number
): Promise<ApiMessagesResponse>
export function sendMessageStream(
  roomId: string,
  text: string,
  onEvent: (event: unknown) => void,
  onDone: () => void,
  retry?: boolean
): Promise<void>
export function regenMessageStream(
  roomId: string,
  messageId: string,
  onEvent: (event: unknown) => void,
  onDone: () => void,
  retry?: boolean
): Promise<void>
export function getCandidates(
  roomId: string,
  messageId: string,
  limit?: number
): Promise<CandidatesResponse>
export function selectCandidate(
  roomId: string,
  messageId: string,
  candidateId: string
): Promise<SelectCandidateResponse>
export function editMessage(
  roomId: string,
  messageId: string,
  candidateId: string,
  text: string
): Promise<EditMessageResponse>
export function deleteMessages(
  roomId: string,
  messageId: string
): Promise<DeleteMessagesResponse>

// Recommend
export function getRecommended(roomId: string): Promise<RecommendedResponse>
export function refreshRecommended(
  roomId: string
): Promise<RefreshRecommendedResponse>
export function getRecommendQuota(): Promise<RecommendQuotaResponse>

// Account / session-adjacent
export function getCoinBalance(): Promise<CoinBalanceResponse>
export function getCoinAutoPaymentSettings(): Promise<AutoPaymentSettingsResponse>
export function getCreatorStats(): Promise<CreatorStatsResponse>
export function getZetaPassSubscription(): Promise<SubscriptionResponse>
export function getZetaPassPromotionEligibility(): Promise<PromotionEligibilityResponse>
export function getZetaPassProConversionStatus(): Promise<ProConversionStatusResponse>
export function getLatestNotificationTime(): Promise<NotificationTimeResponse>
export function getAppPushSetting(type?: string): Promise<PushSettingResponse>
export function getStoreProducts(
  productType: string
): Promise<StoreProductsResponse>
export function getSessionOverview(): Promise<SessionOverview>

// User chat profiles / personas
export function getUserChatProfiles(
  limit?: number,
  options?: { plotId?: string; roomId?: string }
): Promise<UserChatProfilesResponse>
export function createUserChatProfile(data: {
  name: string
  description?: string
}): Promise<UserChatProfile>
export function checkUserChatProfileAbuse(data: {
  name: string
  description?: string
}): Promise<AbuseCheckResponse>
export function updateUserChatProfile(
  profileId: string,
  data: { name: string; description?: string }
): Promise<UserChatProfile>
export function deleteUserChatProfile(profileId: string): Promise<void>
export function selectUserChatProfile(
  profileId: string,
  options?: { plotId?: string; roomId?: string }
): Promise<SelectProfileResponse>
export function setDefaultUserChatProfile(
  profileId: string
): Promise<Record<string, unknown>>

// Quiz
export function getQuiz(): Promise<QuizData>
export function joinQuiz(
  quizId: string,
  plotId: string
): Promise<JoinQuizResponse>
export function claimQuiz(quizId: string): Promise<ClaimQuizResponse>

// Additional types referenced above
export interface Banner {
  id: string
  imageUrl: string
  linkUrl?: string
  title?: string
  description?: string
}

export interface Popup {
  id: string
  title: string
  message: string
  imageUrl?: string
  actionUrl?: string
  actionText?: string
}

export interface FeatureFlagResponse {
  enabled: boolean
  name: string
  config?: Record<string, unknown>
}

export interface CharacterImage {
  id: string
  url: string
  characterId: string
  order: number
}
