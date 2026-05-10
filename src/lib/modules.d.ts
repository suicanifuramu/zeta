// Type declarations for .js service modules

declare module "@/lib/api" {
  const api: any; /* eslint-disable-line @typescript-eslint/no-explicit-any */
  export default api;
  export const getHomePlots: (limit?: number, cursor?: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getSpecialCuration: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getBanners: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getPopups: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getFeatureFlag: (name: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getGenresRanking: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getRanking: (type?: string, limit?: number, filterValues?: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getPlot: (plotId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getPlotImages: (plotId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getCharacterImages: (plotId: string, characterId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getSimilarPlots: (plotId: string, limit?: number) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getLikedPlots: (limit?: number) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getActiveRoomId: (plotId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const createRoom: (plotId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getRooms: (limit?: number) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getRoom: (roomId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const deleteRoom: (roomId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getRoomModelSetting: (roomId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getRoomCyoaSetting: (roomId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getIntroBeforeSelection: (roomId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const createIntro: (roomId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getSelectedPersona: (plotId: string, roomId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getMessages: (roomId: string, limit?: number) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getMessagesByCursor: (roomId: string, cursor: string, limit?: number) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const sendMessageStream: (roomId: string, text: string, onEvent: (event: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => void, onDone?: () => void) => Promise<void>;
  export const regenMessageStream: (roomId: string, messageId: string, onEvent: (event: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => void, onDone?: () => void) => Promise<void>;
  export const getCandidates: (roomId: string, messageId: string, limit?: number) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const selectCandidate: (roomId: string, messageId: string, candidateId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const editMessage: (roomId: string, messageId: string, candidateId: string, text: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const deleteMessages: (roomId: string, messageId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getRecommended: (roomId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const refreshRecommended: (roomId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getRecommendQuota: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getCoinBalance: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getCreatorStats: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getZetaPassSubscription: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getZetaPassPromotionEligibility: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getZetaPassProConversionStatus: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getLatestNotificationTime: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getAppPushSetting: (type?: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getStoreProducts: (productType: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getSessionOverview: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getUserChatProfiles: (limit?: number, opts?: { plotId?: string; roomId?: string }) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const createUserChatProfile: (data: { name: string; description: string }) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const checkUserChatProfileAbuse: (data: { name: string; description: string }) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const updateUserChatProfile: (profileId: string, data: { name: string; description: string }) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const deleteUserChatProfile: (profileId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const selectUserChatProfile: (profileId: string, opts?: { plotId?: string; roomId?: string }) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const getQuiz: () => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const joinQuiz: (quizId: string, plotId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export const claimQuiz: (quizId: string) => Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
}

declare module "./api" {
  export * from "@/lib/api";
}

declare module "./api.js" {
  export * from "@/lib/api";
}

declare module "@/lib/auth" {
  export function ensureAccessToken(): Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export function getAccessToken(): string | null;
  export function refreshSession(): Promise<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  export function initAuth(): Promise<boolean>;
  export function getAuthState(): any; /* eslint-disable-line @typescript-eslint/no-explicit-any */
  export function loadLocalAuth(): Promise<void>;
  export function decodeJwt(token: string): any; /* eslint-disable-line @typescript-eslint/no-explicit-any */
  export function getTokenExpiry(token: string): number;
  export function getRefreshToken(): string;
  export function getDeviceId(): string;
  export function setDeviceId(deviceId: string): void;
  export function updateRefreshToken(token: string): void;
  export function updateAccessToken(token: string): void;
  export function importTokens(input: string): void;
  export function clearSession(): Promise<void>;
  export function logout(): void;
}

declare module "./auth" {
  export * from "@/lib/auth";
}

declare module "./auth.js" {
  export * from "@/lib/auth";
}

declare module "@/lib/quiz" {
  export function getQuizStatus(): Promise<string>;
  export function runQuizAutomation(): Promise<string>;
}

declare module "@/lib/quiz.js" {
  export * from "@/lib/quiz";
}

declare module "@/lib/new-chat" {
  export function startNewChat(plotId: string, navigate: (path: string) => void): Promise<void>;
}
