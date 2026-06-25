// Type declarations for .js service modules

declare module "@/lib/api" {
  const api: unknown
  export default api
  export const getHomePlots: (
      limit?: number,
      cursor?: string
    ) => Promise<unknown>
  export const getSpecialCuration: () => Promise<unknown>
  export const getBanners: () => Promise<unknown>
  export const getPopups: () => Promise<unknown>
  export const getFeatureFlag: (
      name: string
    ) => Promise<unknown>
  export const getGenresRanking: () => Promise<unknown>
  export const getRanking: (
      type?: string,
      limit?: number,
      filterValues?: string
    ) => Promise<unknown>
  export const getPlot: (
      plotId: string
    ) => Promise<unknown>
  export const getPlotImages: (
      plotId: string
    ) => Promise<unknown>
  export const getCharacterImages: (
      plotId: string,
      characterId: string
    ) => Promise<unknown>
  export const getSimilarPlots: (
      plotId: string,
      limit?: number
    ) => Promise<unknown>
  export const getLikedPlots: (
      limit?: number
    ) => Promise<unknown>
  export const getActiveRoomId: (
      plotId: string
    ) => Promise<unknown>
  export const createRoom: (
      plotId: string
    ) => Promise<unknown>
  export const getRooms: (
      limit?: number
    ) => Promise<unknown>
  export const getRoom: (
      roomId: string
    ) => Promise<unknown>
  export const deleteRoom: (
      roomId: string
    ) => Promise<unknown>
  export const getRoomModelSetting: (
      roomId: string
    ) => Promise<unknown>
  export const getRoomCyoaSetting: (
      roomId: string
    ) => Promise<unknown>
  export const getIntroBeforeSelection: (
      roomId: string
    ) => Promise<unknown>
  export const createIntro: (
      roomId: string
    ) => Promise<unknown>
  export const getSelectedPersona: (
      plotId: string,
      roomId: string
    ) => Promise<unknown>
  export const getMessages: (
      roomId: string,
      limit?: number
    ) => Promise<unknown>
  export const getMessagesByCursor: (
      roomId: string,
      cursor: string,
      limit?: number
    ) => Promise<unknown>
  export const sendMessageStream: (
    roomId: string,
    text: string,
    onEvent: (
      event: unknown
    )   => void,
    onDone?: () => void
  ) => Promise<void>
  export const regenMessageStream: (
    roomId: string,
    messageId: string,
    onEvent: (
      event: unknown
    )   => void,
    onDone?: () => void
  ) => Promise<void>
  export const getCandidates: (
      roomId: string,
      messageId: string,
      limit?: number
    ) => Promise<unknown>
  export const selectCandidate: (
      roomId: string,
      messageId: string,
      candidateId: string
    ) => Promise<unknown>
  export const editMessage: (
      roomId: string,
      messageId: string,
      candidateId: string,
      text: string
    ) => Promise<unknown>
  export const deleteMessages: (
      roomId: string,
      messageId: string
    ) => Promise<unknown>
  export const getRecommended: (
      roomId: string
    ) => Promise<unknown>
  export const refreshRecommended: (
      roomId: string
    ) => Promise<unknown>
  export const getRecommendQuota: () => Promise<unknown>
  export const getCoinBalance: () => Promise<unknown>
  export const getCreatorStats: () => Promise<unknown>
  export const getZetaPassSubscription: () => Promise<unknown>
  export const getZetaPassPromotionEligibility: () => Promise<unknown>
  export const getZetaPassProConversionStatus: () => Promise<unknown>
  export const getLatestNotificationTime: () => Promise<unknown>
  export const getAppPushSetting: (
      type?: string
    ) => Promise<unknown>
  export const getStoreProducts: (
      productType: string
    ) => Promise<unknown>
  export const getSessionOverview: () => Promise<unknown>
  export const getUserChatProfiles: (
      limit?: number,
      opts?: { plotId?: string; roomId?: string }
    ) => Promise<unknown>
  export const createUserChatProfile: (data: {
      name: string
      description: string
    }) => Promise<unknown>
  export const checkUserChatProfileAbuse: (data: {
      name: string
      description: string
    }) => Promise<unknown>
  export const updateUserChatProfile: (
      profileId: string,
      data: { name: string; description: string }
    ) => Promise<unknown>
  export const deleteUserChatProfile: (
      profileId: string
    ) => Promise<unknown>
  export const selectUserChatProfile: (
      profileId: string,
      opts?: { plotId?: string; roomId?: string }
    ) => Promise<unknown>
  export const selectPlotChatProfile: (data: {
      roomId: string
      plotChatProfileId: string
      plotId: string
      name: string
      profileImageUrl?: string
      summary: string
      description: string
    }) => Promise<unknown>
  export const setDefaultUserChatProfile: (
      profileId: string
    ) => Promise<unknown>
  export const getMyPlotChatProfile: (
      roomId: string
    ) => Promise<unknown>
  export const getSelectedUserPersona: (
      plotId: string,
      roomId: string
    ) => Promise<unknown>
  export const getQuiz: () => Promise<unknown>
  export const joinQuiz: (
      quizId: string,
      plotId: string
    ) => Promise<unknown>
  export const claimQuiz: (
      quizId: string
    ) => Promise<unknown>
}

declare module "./api" {
  export * from "@/lib/api"
}

declare module "./api.js" {
  export * from "@/lib/api"
}

declare module "@/lib/auth" {
  export function ensureAccessToken(): Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */
  export function getAccessToken(): string | null
  export function refreshSession(): Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */
  export function initAuth(): Promise<boolean>
  export function getAuthState(): any /* eslint-disable-line @typescript-eslint/no-explicit-any */
  export function loadLocalAuth(): Promise<void>
  export function decodeJwt(
    token: string
  ): any /* eslint-disable-line @typescript-eslint/no-explicit-any */
  export function getTokenExpiry(token: string): number
  export function getRefreshToken(): string
  export function getDeviceId(): string
  export function setDeviceId(deviceId: string): void
  export function updateRefreshToken(token: string): void
  export function updateAccessToken(token: string): void
  export function importTokens(input: string): void
  export function clearSession(): Promise<void>
  export function logout(): void
}

declare module "./auth" {
  export * from "@/lib/auth"
}

declare module "./auth.js" {
  export * from "@/lib/auth"
}

declare module "@/lib/quiz" {
  export function getQuizStatus(): Promise<string>
  export function runQuizAutomation(): Promise<string>
}

declare module "@/lib/quiz.js" {
  export * from "@/lib/quiz"
}

declare module "@/lib/new-chat" {
  export function startNewChat(
    plotId: string,
    navigate: (path: string) => void
  ): Promise<void>
}
