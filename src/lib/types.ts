export interface Plot {
  id: string
  name: string
  imageUrl?: string
  shortDescription?: string
  interactionCount?: number
  hashtags?: string[]
  rank?: number
  rankDiff?: number
  isNew?: boolean
  characters?: Character[]
}

export interface Character {
  id: string
  name: string
  imageUrl?: string
  description?: string
}

export interface Room {
  id: string
  lastMessageTime?: string
  plot?: Plot
  title?: string
  name?: string
  unreadCount?: number
  [key: string]: unknown
}

export interface Message {
  id: string
  roomId: string
  senderId: string
  text: string
  createdAt?: string
  candidates?: Candidate[]
}

export interface Candidate {
  id: string
  text: string
  isFinalized?: boolean
  contents?: Array<{
    position: string
    speakerName?: string
    text: string
  }>
  content?: string
}

export interface InfoBoxItem {
  label: string
  value: string
}

export interface InfoBoxCharacter {
  name: string
  items: InfoBoxItem[]
}

export interface InfoBoxContent {
  type: "INFO_BOX"
  scenes: unknown[]
  characters: InfoBoxCharacter[]
}

export interface UserChatProfile {
  id: string
  name: string
  description?: string
  isDefault?: boolean
  profileImageUrl?: string
  selected?: boolean
}

export interface SessionOverview {
  coin?: { balance?: number }
  subscription?: { type?: string }
  creatorStats?: {
    followingCount?: number
    followerCount?: number
    plotCount?: number
  }
}

export interface ApiListResponse<T> {
  cursor?: string | null
  nextCursor?: string | null
  [key: string]: T[] | string | number | null | undefined | unknown
}

export interface ApiHomeResponse {
  plots?: Plot[]
  cursor?: string
  nextCursor?: string
  roomId?: string
}

export interface ApiRankingResponse {
  rankings?: Plot[]
  roomId?: string
}

export interface ApiRoomsResponse {
  rooms?: Room[]
}

export interface ApiMessagesResponse {
  messages?: Message[]
}

export interface QuizPlot {
  id: string
  name: string
  description?: string
  imageUrl?: string
  interactionCount?: number
}

export interface QuizQuestion {
  type: string
  countType: string
  plots: QuizPlot[]
  ageGroup?: string | null
  gender: string
  period: string
}

export interface QuizSelection {
  type: string
  plotId: string
}

export interface QuizData {
  id: number
  type: string
  question?: QuizQuestion
  selection?: QuizSelection
  availableAt?: string
  rewardUntil?: string
  claimed?: boolean
  rewardClaimed?: boolean
}

// Home/Discovery
export interface SpecialCurationResponse {
  plots?: Plot[]
  banners?: Banner[]
  specialPlots?: Plot[]
}

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

// Ranking
export interface GenreRankingResponse {
  genres?: Array<{
    id: string
    name: string
    rank: number
    plotCount: number
  }>
}

export interface IntroMessage {
  senderId: string;
  content: string;
  position: string;
}

export interface IntroConversation {
  messages: IntroMessage[];
}

export interface IntroItem {
  conversation?: IntroConversation;
}

// Plot/Room
export interface PlotDetailResponse extends Plot {
  longDescription?: string;
  initialRoomImageUrl?: string;
  creator?: {
    id: string;
    nickname: string;
    username: string;
  };
  intros?: IntroItem[];
  isAboutPublic?: boolean;
  about?: {
    contents: Array<{
      content?: string;
      text?: string;
    }>;
    characters: Array<{
      characterId: string;
      description: string;
    }>;
  };
}

export interface PlotImage {
  id: string
  url: string
  type: string
  order: number
}

export interface CharacterImage {
  id: string
  url: string
  characterId: string
  order: number
}

export interface SimilarPlotsResponse {
  plots?: Plot[]
}

export interface LikedPlotsResponse {
  plots?: Plot[]
  cursor?: string
  nextCursor?: string
}

export interface ActiveRoomIdResponse {
  roomId?: string
}

export interface CreateRoomResponse {
  id: string
  roomId?: string
}

export interface RoomDetailResponse extends Room {
  plot?: PlotDetailResponse
  lastMessage?: Message
  unreadCount?: number
}

export interface DeleteRoomResponse {
  success: boolean
}

export interface ModelSettingResponse {
  model?: string
  type?: string
  temperature?: number
  maxTokens?: number
}

export interface CyoaSettingResponse {
  enabled: boolean
  settings?: Record<string, unknown>
}

export interface IntroBeforeSelectionResponse {
  introMessages?: Message[]
}

export interface CreateIntroResponse {
  success: boolean
  message?: Message
}

export interface SelectedPersonaResponse {
  profile?: UserChatProfile
}

// Messages
export interface CandidatesResponse {
  candidates?: Candidate[]
}

export interface SelectCandidateResponse {
  success: boolean
  message?: Message
}

export interface EditMessageResponse {
  success: boolean
  message?: Message
}

export interface DeleteMessagesResponse {
  success: boolean
  deletedCount?: number
}

// Recommend
export interface RecommendedResponse {
  recommendedMessages?: Array<{
    replies?: Array<{
      text: string
      type?: string
    }>
    text?: string
  }>
  messages?: Message[]
}

export interface RefreshRecommendedResponse {
  success: boolean
  count?: number
}

export interface RecommendQuotaResponse {
  remainCount?: number
  remainingCount?: number
  totalCount?: number
  resetAt?: string
}

// Account
export interface CoinBalanceResponse {
  balance: number
  freeBalance?: number
  paidBalance?: number
}

export interface AutoPaymentSettingsResponse {
  enabled: boolean
  threshold?: number
  amount?: number
}

export interface CreatorStatsResponse {
  followingCount: number
  followerCount: number
  plotCount: number
  totalInteractions?: number
}

export interface SubscriptionResponse {
  type: string
  status: string
  expiresAt?: string
  autoRenew?: boolean
}

export interface PromotionEligibilityResponse {
  eligible: boolean
  reason?: string
  promotionType?: string
}

export interface ProConversionStatusResponse {
  status: string
  progress?: number
  requiredInteractions?: number
}

export interface NotificationTimeResponse {
  latestUpdatedAt: string
}

export interface PushSettingResponse {
  enabled: boolean
  types?: string[]
}

export interface StoreProductsResponse {
  products?: Array<{
    id: string
    name: string
    price: number
    currency: string
    description?: string
    imageUrl?: string
  }>
}

// Profiles
export interface UserChatProfilesResponse {
  userChatProfiles?: UserChatProfile[]
  profiles?: UserChatProfile[]
  cursor?: string
  nextCursor?: string
}

export interface AbuseCheckResponse {
  isAbusing: boolean
  reason?: string
}

export interface SelectProfileResponse {
  success: boolean
  profile?: UserChatProfile
}

// Quiz
export interface JoinQuizResponse {
  success: boolean
  selection?: QuizSelection
}

export interface ClaimQuizResponse {
  success: boolean
  reward?: {
    type: string
    amount: number
    currency?: string
  }
}
