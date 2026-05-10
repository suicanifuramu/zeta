// Type declarations for .js service modules

declare module "@/lib/api" {
  const api: any;
  export default api;
  export const getHomePlots: (limit?: number, cursor?: string) => Promise<any>;
  export const getSpecialCuration: () => Promise<any>;
  export const getBanners: () => Promise<any>;
  export const getPopups: () => Promise<any>;
  export const getFeatureFlag: (name: string) => Promise<any>;
  export const getGenresRanking: () => Promise<any>;
  export const getRanking: (type?: string, limit?: number, filterValues?: string) => Promise<any>;
  export const getPlot: (plotId: string) => Promise<any>;
  export const getPlotImages: (plotId: string) => Promise<any>;
  export const getCharacterImages: (plotId: string, characterId: string) => Promise<any>;
  export const getSimilarPlots: (plotId: string, limit?: number) => Promise<any>;
  export const getLikedPlots: (limit?: number) => Promise<any>;
  export const getActiveRoomId: (plotId: string) => Promise<any>;
  export const createRoom: (plotId: string) => Promise<any>;
  export const getRooms: (limit?: number) => Promise<any>;
  export const getRoom: (roomId: string) => Promise<any>;
  export const deleteRoom: (roomId: string) => Promise<any>;
  export const getRoomModelSetting: (roomId: string) => Promise<any>;
  export const getRoomCyoaSetting: (roomId: string) => Promise<any>;
  export const getIntroBeforeSelection: (roomId: string) => Promise<any>;
  export const createIntro: (roomId: string) => Promise<any>;
  export const getSelectedPersona: (plotId: string, roomId: string) => Promise<any>;
  export const getMessages: (roomId: string, limit?: number) => Promise<any>;
  export const getMessagesByCursor: (roomId: string, cursor: string, limit?: number) => Promise<any>;
  export const sendMessageStream: (roomId: string, text: string, onEvent: (event: any) => void, onDone?: () => void) => Promise<void>;
  export const regenMessageStream: (roomId: string, messageId: string, onEvent: (event: any) => void, onDone?: () => void) => Promise<void>;
  export const getCandidates: (roomId: string, messageId: string, limit?: number) => Promise<any>;
  export const selectCandidate: (roomId: string, messageId: string, candidateId: string) => Promise<any>;
  export const editMessage: (roomId: string, messageId: string, candidateId: string, text: string) => Promise<any>;
  export const deleteMessages: (roomId: string, messageId: string) => Promise<any>;
  export const getRecommended: (roomId: string) => Promise<any>;
  export const refreshRecommended: (roomId: string) => Promise<any>;
  export const getRecommendQuota: () => Promise<any>;
  export const getCoinBalance: () => Promise<any>;
  export const getCreatorStats: () => Promise<any>;
  export const getZetaPassSubscription: () => Promise<any>;
  export const getZetaPassPromotionEligibility: () => Promise<any>;
  export const getZetaPassProConversionStatus: () => Promise<any>;
  export const getLatestNotificationTime: () => Promise<any>;
  export const getAppPushSetting: (type?: string) => Promise<any>;
  export const getStoreProducts: (productType: string) => Promise<any>;
  export const getSessionOverview: () => Promise<any>;
  export const getUserChatProfiles: (limit?: number, opts?: { plotId?: string; roomId?: string }) => Promise<any>;
  export const createUserChatProfile: (data: { name: string; description: string }) => Promise<any>;
  export const checkUserChatProfileAbuse: (data: { name: string; description: string }) => Promise<any>;
  export const updateUserChatProfile: (profileId: string, data: { name: string; description: string }) => Promise<any>;
  export const deleteUserChatProfile: (profileId: string) => Promise<any>;
  export const selectUserChatProfile: (profileId: string, opts?: { plotId?: string; roomId?: string }) => Promise<any>;
  export const getQuiz: () => Promise<any>;
  export const joinQuiz: (quizId: string, plotId: string) => Promise<any>;
  export const claimQuiz: (quizId: string) => Promise<any>;
}

declare module "./api" {
  export * from "@/lib/api";
}

declare module "./api.js" {
  export * from "@/lib/api";
}

declare module "@/lib/auth" {
  export function ensureAccessToken(): Promise<any>;
  export function getAccessToken(): string | null;
  export function refreshSession(): Promise<any>;
  export function initAuth(): Promise<boolean>;
  export function getAuthState(): any;
  export function loadLocalAuth(): Promise<void>;
  export function decodeJwt(token: string): any;
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
