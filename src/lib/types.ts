export interface Plot {
  id: string
  name: string
  imageUrl?: string
  coverImageUrl?: string
  shortDescription?: string
  interactionCount?: number
  hashtags?: string[]
  rank?: number
  rankDiff?: number
  isNew?: boolean
  characters?: Character[]
  /**
   * Preset chat profiles defined by the plot creator. The android client reads
   * these from `room.plot.chatProfiles` (the room response embeds the plot)
   * rather than fetching `/v1/plots/:id` separately.
   */
  chatProfiles?: PlotChatProfile[]
}

export interface Character {
  id: string
  name: string
  imageUrl?: string
  description?: string
}

export interface CharacterImageResponse {
  images: Array<{
    imageUrl: string
    aspectRatio: number
  }>
}

export interface CharacterDetail {
  id: string
  name: string
  description: string
  imageUrl: string
}

export interface Room {
  id: string
  lastMessageTime?: string
  plot?: Plot
  title?: string
  name?: string
  unreadCount?: number
  lastMessage?: Message
  [key: string]: unknown
}

export interface Message {
  id: string
  roomId: string
  senderId: string
  text: string
  createdAt?: string
  candidates?: Candidate[]
  contents?: ContentItem[]
  /**
   * Per-message Choose-Your-Own-Adventure choices. Newer API builds attach this
   * directly to the BOT message (previously only a room-level flag existed via
   * `/v1/rooms/{roomId}/settings/cyoa`). `title` is usually empty/null; `text`
   * is what gets sent back as the user's message.
   */
  cyoa?: CyoaPayload | null
}

export interface CyoaChoice {
  title?: string | null
  text: string
}

export interface CyoaPayload {
  choices?: CyoaChoice[] | null
}

export interface Candidate {
  id: string
  text: string
  isFinalized?: boolean
  contents?: ContentItem[]
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

export interface PlotChatProfile {
  id: string
  plotId: string
  name: string
  imageUrl?: string
  summary?: string
  description?: string
  isUsingDefaultName?: boolean
}

export interface SessionOverview {
  coin: CoinBalanceResponse | null
  creatorStats: CreatorStatsResponse | null
  subscription: SubscriptionResponse | null
  promotion: PromotionEligibilityResponse | null
  notifications: NotificationTimeResponse | null
  profiles: UserChatProfilesResponse | null
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

export interface PlotSearchItem {
  type: string
  plot: Plot
}

export interface PlotSearchResponse {
  items?: PlotSearchItem[]
  nextCursor?: string | null
  requestId?: string
}

export interface ApiRoomsResponse {
  rooms?: Room[]
  /** Cursor for the next page; the exact field name is unverified, so both are accepted. */
  nextCursor?: string | null
  cursor?: string | null
}

export interface ApiMessagesResponse {
  messages?: RuntimeMessage[]
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

export interface TextIntroMessage {
  type?: "text"
  senderId: string | null
  content: string
  position?: string
}

export interface ImageIntroMessage {
  type: "image"
  id: string
  url: string
  caption?: string
  aspectRatio?: number
  fileName?: string
}

export interface InfoBoxIntroMessage {
  type: "infoBox"
  infoBox?: {
    scenes?: Array<{ type?: string; value?: string }>
    characters?: Array<{
      characterId?: string
      items?: Array<{ type?: string; value?: string }>
    }>
  }
}

export type IntroMessage = TextIntroMessage | ImageIntroMessage | InfoBoxIntroMessage

export interface IntroConversation {
  messages: IntroMessage[]
}

export interface IntroItem {
  conversation?: IntroConversation
}

// Plot/Room
export interface PlotDetailResponse extends Plot {
  longDescription?: string
  initialRoomImageUrl?: string
  creator?: {
    id: string
    nickname: string
    username: string
  }
  intros?: IntroItem[]
  isAboutPublic?: boolean
  about?: {
    contents: Array<{
      content?: string
      text?: string
    }>
    characters: Array<{
      characterId: string
      description: string
    }>
  }
  chatProfiles?: PlotChatProfile[]
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
  createdAt: string
  lastMessage: {
    id: string
    sender: { id: string; type: string }
    contents: unknown[]
    messageTime: string
  }
  isActive: boolean
  title: string | null
  unreadCount: number
  plot: PlotDetailResponse
}

export interface RoomDetailResponse extends Room {
  plot?: PlotDetailResponse
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
export interface RecommendedMessageEntry {
  replies?: Array<{
    id?: string
    text?: string
    content?: string
    type?: string
  }>
  text?: string
  content?: string
}

export interface RecommendedResponse {
  isAbusing?: boolean
  recommendedMessages?: RecommendedMessageEntry[]
  messages?: RecommendedMessageEntry[]
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

export interface MyProfileResponse {
  id: string
  name: string
  email?: string
  nickname?: string
  username?: string
  profileImageUrl?: string | null
  description?: string
  gender: string
  timeZone?: string
  birthdate?: string
  language?: string
  isAnonymous?: boolean
  marketingOptIn?: boolean
  sexualContentsAllowed?: boolean
  isUnlimited?: boolean
  isAuthenticatedByAdditionalAuth?: boolean
  isBackgroundEnabled?: boolean
  isUserCharacterProfileImageEnabled?: boolean
  createdAt?: string
  tier?: {
    type: string
    isTrial?: boolean
    expiredAt?: string | null
  }
}

// Profiles
export interface UserChatProfilesResponse {
  userChatProfiles?: UserChatProfile[]
  profiles?: UserChatProfile[]
  cursor?: string
  nextCursor?: string
}

export interface ContentItem {
  type?: string
  position?: string
  speakerName?: string
  text?: string
  scenes?: unknown[]
  characters?: InfoBoxCharacter[]
}

export interface RuntimeMessage extends Message {
  contents?: ContentItem[]
  candidateId?: string
  isIntro?: boolean
  sender?: { type: string }
}

export interface AbuseCheckResponse {
  isAbusing: boolean
  reason?: string
}

export interface SelectProfileResponse {
  success: boolean
  profile?: UserChatProfile
}

export interface SelectPlotChatProfileResponse {
  success: boolean
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

// My profile (user-plot-chat-profiles/me)
export interface MyPlotChatProfileResponse {
  id: string
  userId: string
  roomId: string
  plotChatProfileId?: string
  name: string
  imageUrl?: string
  summary?: string
  description?: string
  selected?: boolean
}

export interface SelectedUserPersonaResponse {
  name: string
  profileImageUrl?: string
  description?: string
}

export interface ImageUploadResponse {
  imageUrl: string
}

// ---------------------------------------------------------------------------
// Creator (plot authoring). Wire shapes are taken from the official app's HAR.
// Every object is open-ended (`[key: string]: unknown`) so that fields the UI
// does not edit survive a round trip through PATCH/PUT.
// ---------------------------------------------------------------------------

export type CreatorPlotStatus =
  | "PRERELEASE"
  | "RELEASE"
  | "FILTERED"
  | "DELETED"
  | "HARD_DELETED"
  | (string & {})

/** Character entry. A newly added character is sent as `{}` and gets its id from the server. */
export interface DraftCharacter {
  id?: string
  name?: string | null
  description?: string | null
  imageUrl?: string | null
  [key: string]: unknown
}

export interface DraftChatProfile {
  id: string
  name?: string | null
  imageUrl?: string | null
  summary?: string | null
  description?: string | null
  isUsingDefaultName?: boolean
  [key: string]: unknown
}

export interface DraftExampleMessage {
  content?: string | null
  sender?: string | null
  senderName?: string | null
  [key: string]: unknown
}

export interface DraftExampleConversation {
  messages: DraftExampleMessage[]
  randomUsername?: string | null
  [key: string]: unknown
}

export interface DraftCyoaChoice {
  title?: string
  text?: string
  [key: string]: unknown
}

export interface DraftIntroConversation {
  /** Text, infoBox and image messages. Only text messages are edited in the UI. */
  messages: DraftIntroMessage[]
  cyoaChoices?: { choices: DraftCyoaChoice[] } | null
  [key: string]: unknown
}

export interface DraftIntro {
  conversation: DraftIntroConversation
  publicConversationMessageCount?: number | null
  playerCharacterSelectionIndex?: number | null
  backgroundAudioUrl?: string | null
  backgroundAudioDurationSeconds?: number | null
  [key: string]: unknown
}

export interface DraftIntroTextMessage {
  type: "text"
  content: string
  /** "BOT" or "USER" */
  senderType: string
  /** "_NARRATOR_" for the narrator, a character id for a character, null for the user. */
  senderId: string | null
  tempId?: string
  [key: string]: unknown
}

export interface DraftIntroMessage {
  type?: string
  [key: string]: unknown
}

export interface DraftAboutBlock {
  type?: string
  content?: string | null
  [key: string]: unknown
}

export interface DraftAboutCharacter {
  characterId?: string
  name?: string | null
  description?: string | null
  [key: string]: unknown
}

export interface DraftAbout {
  contents: DraftAboutBlock[]
  characters: DraftAboutCharacter[]
  [key: string]: unknown
}

/**
 * Enum members of the creator editor's "ストーリー演出" settings. Each list is
 * complete and in the official app's declaration order (confirmed from its
 * GraphQL enum map and its Japanese labels).
 */
export type DraftStyleDifficulty = "EASY" | "NORMAL" | "HARD" | "NIGHTMARE"
export type DraftStylePacing = "FAST" | "NATURAL" | "SLOW"
export type DraftStylePov = "FIRST_PERSON" | "SECOND_PERSON" | "THIRD_PERSON"
export type DraftStyleTense = "PAST" | "PRESENT"
export type DraftStyleResponseLength = "SHORT" | "MEDIUM" | "LONG" | "DYNAMIC"
export type DraftStyleDevelopmentStyle =
  "DIALOGUE_FOCUSED" | "DEFAULT" | "ACTION_FOCUSED"
export type DraftStyleMood =
  | "ROMANCE"
  | "HEALING"
  | "ANGST"
  | "YANDERE"
  | "FANTASY"
  | "ACTION"
  | "MYSTERY"
  | "HORROR"
export type DraftStorytellingStyle =
  | "JANE_AUSTEN"
  | "DON_WINSLOW"
  | "HENRY_MILLER"
  | "LOUISA_MAY_ALCOTT"
  | "QUENTIN_TARANTINO"
  | "JK_ROWLING"
  | "NISIO_ISIN"
  | "STEPHEN_KING"

export interface DraftStylePreset {
  difficulty?: DraftStyleDifficulty
  pacing?: DraftStylePacing
  pov?: DraftStylePov
  tense?: DraftStyleTense
  responseLength?: DraftStyleResponseLength
  developmentStyle?: DraftStyleDevelopmentStyle
  moods?: DraftStyleMood[]
  storytellingStyle?: DraftStorytellingStyle | null
}

/** Info box scene rows, in the official app's order. */
export type DraftInfoBoxSceneType =
  "DATE" | "TIME" | "LOCATION" | "WEATHER" | "SITUATION"
/** `DATE` scene display format (`年月日` / `時間経過`). */
export type DraftInfoBoxDateFormat = "DATE" | "DAY_COUNT"

export interface DraftInfoBoxScene {
  type: DraftInfoBoxSceneType
  enabled: boolean
  format?: DraftInfoBoxDateFormat
}

/** Info box character item rows, in the official app's order. */
export type DraftInfoBoxItemType =
  | "MOOD"
  | "CONDITION"
  | "OUTFIT"
  | "POSE"
  | "GOAL"
  | "RELATIONSHIP"
  | "INNER_THOUGHT"
  | "INVENTORY"

export interface DraftInfoBoxItem {
  type: DraftInfoBoxItemType
  enabled: boolean
}

export interface DraftInfoBoxSetting {
  scenes: DraftInfoBoxScene[]
  characters: DraftInfoBoxItem[]
}

/** `cyoaSetting.type`: choices written as sentences or as keywords. */
export type DraftCyoaType = "DIALOGUE" | "KEYWORD"

export interface DraftCyoaSetting {
  enabled: boolean
  type: DraftCyoaType
}

export interface DraftPluginEntry {
  pluginId: string
  value: unknown
  [key: string]: unknown
}

/** Editable draft of a plot. Unknown keys are kept in the index signature. */
export interface PlotDraft {
  name: string | null
  imageUrl: string | null
  shortDescription: string | null
  longDescription: string | null
  narrator: string | null
  characters: DraftCharacter[]
  chatProfiles: DraftChatProfile[]
  exampleConversations: DraftExampleConversation[]
  intros: DraftIntro[]
  about: DraftAbout | null
  hashtags: string[]
  lorebookIds: string[]
  creatorComment: string | null
  isCreatorCommentPublic: boolean
  isAboutPublic: boolean
  isExampleConversationPublic: boolean
  stylePreset: DraftStylePreset | null
  infoBoxSetting: DraftInfoBoxSetting | null
  cyoaSetting: DraftCyoaSetting | null
  plugins: DraftPluginEntry[] | null
  [key: string]: unknown
}

/** Plot as returned by GET /v1/plots/:id/creator (and by POST/PATCH/PUT). */
export interface CreatorPlot {
  id: string
  status: CreatorPlotStatus
  isPrivate: boolean
  name: string | null
  imageUrl: string | null
  updatedAt: string | null
  releasedAt: string | null
  /** Non-null while the plot can still be edited; may also be returned after publishing. */
  draft: Record<string, unknown> | null
  [key: string]: unknown
}

export interface CreatorPlotListResponse {
  plots: CreatorPlot[]
  nextCursor: string | null
}

export interface ProfileImageStyle {
  id: string
  model: string
  name: string
  /** Pieces per generation (observed values: 0 and 4). */
  price: number
  hasDiscount: boolean
  thumbnail: string
  isZetaModel: boolean
  defaultPrompt: string | null
  negativePrompt: string | null
  enabled: boolean
  [key: string]: unknown
}

export interface ProfileImageResult {
  id: string
  prompt: string | null
  defaultPrompt: string | null
  negativePrompt: string | null
  seed: number | null
  style: ProfileImageStyle | null
  /** Signed URL. Store and send it exactly as returned. */
  imageUrl: string
  saved?: boolean | null
  createdAt?: string | null
  expiredAt?: string | null
  [key: string]: unknown
}

export interface ProfileImageHistoryResponse {
  profileImages: ProfileImageResult[]
  nextCursor: string | null
}

export interface ProfileImageJobStatus {
  status: string
  userStatus?: string | null
  blockDays?: number | null
  profileImageResultId?: string | null
}

export interface ImageSetResult {
  type: string
  imageUrl: string | null
  [key: string]: unknown
}

export interface CropCoordinates {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type KeywordTestType = "ABUSING_PLOT_PROMPT" | "ABUSING_PLOT_HASHTAG"

export interface LorebookSummary {
  id: string
  title: string
  description?: string | null
  [key: string]: unknown
}

export interface LorebookListItem {
  lorebook: LorebookSummary
  coverImageUrl?: string | null
}

export interface LorebookListResponse {
  lorebooks: LorebookListItem[]
  nextCursor: string | null
}

export interface PluginCatalogItem {
  id: string
  displayName: string
  paid: boolean
}

/** One entry of GET /v1/plots/:id/plugins. `value` is published, `draftValue` is the draft. */
export interface PlotPluginState {
  pluginId: string
  displayName: string
  state: string
  paid: boolean
  value: unknown
  draftValue: unknown
  constraints: Record<string, unknown> | null
}

/** One dice theme from GET /v1/dice-themes. */
export interface DiceTheme {
  id: string
  name: string
}

export interface GalleryImage {
  imageUrl: string
  aspectRatio: number
}

export type CommentWindowStatus = "ON" | "OFF"

export interface WallpaperPreset {
  id: string
  name: string | null
  imageUrl: string | null
}

export type ReviewState = "NONE" | "REVIEWING" | "REJECTED" | (string & {})

export interface ExampleChatStreamEvent {
  event: string
  chunkMessage?: { contents?: { type?: string; speakerName?: string | null; position?: string; text?: string }[] } | null
  replyMessage?: { senderType?: string; contents?: { type?: string; speakerName?: string | null; position?: string; text?: string }[] } | null
  index?: number | null
}
