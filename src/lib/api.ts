import {
  ensureAccessToken,
  getAccessToken,
  getGender,
  refreshSession,
} from "./auth"
import { getCommonHeaders, setAppVersion, APP_VERSION } from "./headers"
import { z } from "zod"
import {
  CharacterImageResponseSchema,
  MyPlotChatProfileResponseSchema,
  PlotDetailResponseSchema,
  SelectedUserPersonaResponseSchema,
  UserChatProfileSchema,
} from "./schemas"
import type {
  AbuseCheckResponse,
  ActiveRoomIdResponse,
  ApiHomeResponse,
  ApiMessagesResponse,
  ApiRankingResponse,
  ApiRoomsResponse,
  CandidatesResponse,
  CharacterImageResponse,
  ClaimQuizResponse,
  CoinBalanceResponse,
  CreateIntroResponse,
  CreateRoomResponse,
  CreatorStatsResponse,
  CyoaSettingResponse,
  DeleteMessagesResponse,
  DeleteRoomResponse,
  EditMessageResponse,
  GenreRankingResponse,
  IntroBeforeSelectionResponse,
  JoinQuizResponse,
  LikedPlotsResponse,
  ModelSettingResponse,
  MyProfileResponse,
  MyPlotChatProfileResponse,
  NotificationTimeResponse,
  PlotDetailResponse,
  PromotionEligibilityResponse,
  ProConversionStatusResponse,
  QuizData,
  RecommendQuotaResponse,
  SessionOverview,
  RefreshRecommendedResponse,
  RecommendedResponse,
  RoomDetailResponse,
  SelectCandidateResponse,
  SelectedPersonaResponse,
  SelectedUserPersonaResponse,
  SelectPlotChatProfileResponse,
  SelectProfileResponse,
  SimilarPlotsResponse,
  SpecialCurationResponse,
  StoreProductsResponse,
  SubscriptionResponse,
  UserChatProfile,
  UserChatProfilesResponse,
} from "./types"

const BASE = "https://api.zeta-ai.io"

function buildHeaders(
  extra: Record<string, string> = {}
): Record<string, string> {
  const token = getAccessToken()
  return {
    ...getCommonHeaders(),
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {},
  retry = true,
  versionRetry = true
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: buildHeaders(options.headers || {}),
  })

  if (res.status === 401 && retry) {
    await refreshSession(true)
    return request<T>(path, options, false, versionRetry)
  }

  if (res.status === 400 && versionRetry) {
    const text = await res.text().catch(() => "")
    try {
      const body = JSON.parse(text) as {
        code?: string
        data?: string | Record<string, unknown>
      }
      if (body.code === "APP_UPDATE_REQUIRED") {
        const raw =
          typeof body.data === "string"
            ? JSON.parse(body.data)
            : (body.data || {})
        const minVersion = (raw as { minimumRequiredVersion?: string }).minimumRequiredVersion
        if (minVersion && minVersion !== APP_VERSION) {
          setAppVersion(minVersion)
          return request<T>(path, options, retry, false)
        }
      }
    } catch {
      // ignore
    }
    throw new Error(
      `${options.method || "GET"} ${path} -> 400: ${text.slice(0, 160)}`
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `${options.method || "GET"} ${path} -> ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`
    )
  }

  const text = await res.text()
  return (text ? JSON.parse(text) : {}) as T
}

async function get<T>(path: string): Promise<T> {
  await ensureAccessToken()
  return request<T>(path)
}

/**
 * Validate a parsed JSON body against a Zod schema. Throws on shape drift;
 * the caller's `.catch()` (which forwards into a `sonner` toast) reports
 * the failure to the user and a `console.warn` keeps the diagnostics
 * available in development. Centralized so Cycle 5–8 narrowing assertions
 * have a runtime safety net.
 *
 * Returns `unknown` because Zod 4's generic inference doesn't survive
 * `tsc -b` declaration emission; callers narrow to their declared return
 * type via `as` at the call site (the schema type and the TS interface
 * are kept in sync manually — both mirror the wire shape).
 */
function validate(
  schema: z.ZodTypeAny,
  data: unknown,
  endpoint: string
): unknown {
  const result = schema.safeParse(data)
  if (!result.success) {
    console.warn(
      `[api] ${endpoint} response shape mismatch`,
      result.error.issues.slice(0, 3)
    )
    throw new Error(`Invalid response shape for ${endpoint}`)
  }
  return result.data
}

async function post<T>(path: string, body: unknown = null): Promise<T> {
  await ensureAccessToken()
  const opts: RequestInit & { headers: Record<string, string> } = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }
  if (body) opts.body = JSON.stringify(body)
  return request<T>(path, opts)
}

async function put<T>(path: string, body: unknown): Promise<T> {
  await ensureAccessToken()
  return request<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function del<T>(path: string, body: unknown = null): Promise<T> {
  await ensureAccessToken()
  const opts: RequestInit & { headers: Record<string, string> } = {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  }
  if (body) opts.body = JSON.stringify(body)
  return request<T>(path, opts)
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  await ensureAccessToken()
  return request<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// Home
export function getHomePlots(
  limit = 16,
  cursor = ""
): Promise<ApiHomeResponse> {
  return get<ApiHomeResponse>(
    `/v1/infinite-plots?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
  )
}

export function getSpecialCuration(): Promise<SpecialCurationResponse> {
  return get<SpecialCurationResponse>("/v1/special-curation")
}

export function getBanners(): Promise<unknown> {
  return get<unknown>("/v1/banners")
}

export function getPopups(): Promise<unknown> {
  return get<unknown>("/v1/popups")
}

export function getFeatureFlag(name: string): Promise<unknown> {
  return get<unknown>(`/v1/feature-flags/${encodeURIComponent(name)}`)
}

// Rankings
export function getGenresRanking(): Promise<GenreRankingResponse> {
  return get<GenreRankingResponse>("/v1/genres/ranking")
}

export function getRanking(
  type = "BEST",
  limit = 20,
  filterValues = "all"
): Promise<ApiRankingResponse> {
  const gender = getGender() || "MALE"
  const apiType = type === "TREND" ? "TRENDING" : type
  return get<ApiRankingResponse>(
    `/v1/plots/ranking?limit=${limit}&gender=${gender}&type=${apiType}&filterType=GENRE&filterValues=${encodeURIComponent(filterValues)}`
  )
}

// My profile
export function getMyProfile(): Promise<MyProfileResponse> {
  return get<MyProfileResponse>("/v1/users/me")
}

// Plots / rooms
export function getPlot(plotId: string): Promise<PlotDetailResponse> {
  return get<unknown>(`/v1/plots/${plotId}`).then(
    (data) => validate(PlotDetailResponseSchema, data, "getPlot") as PlotDetailResponse
  )
}

export function getPlotImages(plotId: string): Promise<unknown> {
  return get<unknown>(`/v2/plots/${plotId}/images`)
}

export function getCharacterImages(
  plotId: string,
  characterId: string
): Promise<CharacterImageResponse> {
  return get<unknown>(`/v2/plots/${plotId}/characters/${characterId}/images`).then(
    (data) =>
      validate(CharacterImageResponseSchema, data, "getCharacterImages") as CharacterImageResponse
  )
}

export function getSimilarPlots(
  plotId: string,
  limit = 12
): Promise<SimilarPlotsResponse> {
  return get<SimilarPlotsResponse>(
    `/v1/plots/${plotId}/similar-plots?limit=${limit}`
  )
}

export function getLikedPlots(limit = 30): Promise<LikedPlotsResponse> {
  return get<LikedPlotsResponse>(`/v1/plots/liked?limit=${limit}`)
}

export function getActiveRoomId(plotId: string): Promise<ActiveRoomIdResponse> {
  return get<ActiveRoomIdResponse>(
    `/v1/rooms/active-room-id?plotId=${encodeURIComponent(plotId)}`
  )
}

export function createRoom(plotId: string): Promise<CreateRoomResponse> {
  return post<CreateRoomResponse>("/v1/rooms", { plotId })
}

export function getRooms(limit = 30): Promise<ApiRoomsResponse> {
  return get<ApiRoomsResponse>(
    `/v1/rooms?limit=${limit}&orderBy.property=LAST_MESSAGE_TIME&orderBy.direction=DESC`
  )
}

export function getRoom(roomId: string): Promise<RoomDetailResponse> {
  return get<RoomDetailResponse>(`/v1/rooms/${roomId}`)
}

export function deleteRoom(roomId: string): Promise<DeleteRoomResponse> {
  return del<DeleteRoomResponse>(`/v1/rooms/${roomId}`)
}

export function getRoomModelSetting(
  roomId: string
): Promise<ModelSettingResponse> {
  return get<ModelSettingResponse>(`/v1/rooms/${roomId}/model-setting`)
}

export function getRoomCyoaSetting(roomId: string): Promise<CyoaSettingResponse> {
  return get<CyoaSettingResponse>(`/v1/rooms/${roomId}/settings/cyoa`)
}

export function getIntroBeforeSelection(
  roomId: string
): Promise<IntroBeforeSelectionResponse> {
  return get<IntroBeforeSelectionResponse>(
    `/v1/rooms/${roomId}/intros/before-selection`
  )
}

export function createIntro(roomId: string): Promise<CreateIntroResponse> {
  return post<CreateIntroResponse>(`/v1/rooms/${roomId}/intros`)
}

export function getSelectedPersona(
  plotId: string,
  roomId: string
): Promise<SelectedPersonaResponse> {
  return get<SelectedPersonaResponse>(
    `/v1/plots/${plotId}/rooms/${roomId}/user-personas/selected`
  )
}

// Messages
export function getMessages(
  roomId: string,
  limit = 30
): Promise<ApiMessagesResponse> {
  return get<ApiMessagesResponse>(
    `/v1/rooms/${roomId}/messages?limit=${limit}`
  )
}

export function getMessagesByCursor(
  roomId: string,
  cursor: string,
  limit = 30
): Promise<ApiMessagesResponse> {
  return get<ApiMessagesResponse>(
    `/v1/rooms/${roomId}/messages?limit=${limit}&cursor=${encodeURIComponent(`${roomId}:${cursor}`)}`
  )
}

// Send message (SSE stream)
export async function sendMessageStream<T = unknown>(
  roomId: string,
  text: string,
  onEvent: (event: T) => void,
  onDone?: () => void,
  retry = true
): Promise<void> {
  await ensureAccessToken()
  const res = await fetch(`${BASE}/v1/rooms/${roomId}/messages/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "TEXT", text }),
  })

  if (res.status === 401 && retry) {
    await refreshSession(true)
    return sendMessageStream<T>(roomId, text, onEvent, onDone, false)
  }

  if (!res.ok) throw new Error(`Send failed: ${res.status}`)
  await readSSE<T>(res, onEvent, onDone)
}

// Regen (SSE stream)
export async function regenMessageStream<T = unknown>(
  roomId: string,
  messageId: string,
  onEvent: (event: T) => void,
  onDone?: () => void,
  retry = true
): Promise<void> {
  await ensureAccessToken()
  const res = await fetch(
    `${BASE}/v1/rooms/${roomId}/messages/${messageId}/candidates/stream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
    }
  )

  if (res.status === 401 && retry) {
    await refreshSession(true)
    return regenMessageStream<T>(roomId, messageId, onEvent, onDone, false)
  }

  if (!res.ok) throw new Error(`Regen failed: ${res.status}`)
  await readSSE<T>(res, onEvent, onDone)
}

// Candidates
export function getCandidates(
  roomId: string,
  messageId: string,
  limit = 100
): Promise<CandidatesResponse> {
  return get<CandidatesResponse>(
    `/v1/rooms/${roomId}/messages/${messageId}/candidates?limit=${limit}`
  )
}

export function selectCandidate(
  roomId: string,
  messageId: string,
  candidateId: string
): Promise<SelectCandidateResponse> {
  return put<SelectCandidateResponse>(`/v1/rooms/${roomId}/messages/${messageId}`, {
    type: "CANDIDATE",
    candidateId,
  })
}

// Edit message
export function editMessage(
  roomId: string,
  messageId: string,
  candidateId: string,
  text: string
): Promise<EditMessageResponse> {
  const requestId = crypto.randomUUID()
  return put<EditMessageResponse>(
    `/v1/rooms/${roomId}/messages/${messageId}/candidates/${candidateId}`,
    { requestId, text }
  )
}

// Delete messages
export function deleteMessages(
  roomId: string,
  messageId: string
): Promise<DeleteMessagesResponse> {
  return del<DeleteMessagesResponse>(`/v1/rooms/${roomId}/room-messages`, {
    messagePointer: { messageId, roomId },
  })
}

// Recommended replies
export function getRecommended(roomId: string): Promise<RecommendedResponse> {
  return get<RecommendedResponse>(`/v1/rooms/${roomId}/recommended-messages`)
}

export function refreshRecommended(
  roomId: string
): Promise<RefreshRecommendedResponse> {
  return post<RefreshRecommendedResponse>(
    `/v1/rooms/${roomId}/recommended-messages/multiple`
  )
}

export function getRecommendQuota(): Promise<RecommendQuotaResponse> {
  return get<RecommendQuotaResponse>("/v1/recommended-messages/quota")
}

// Account / session-adjacent endpoints
export function getCoinBalance(): Promise<CoinBalanceResponse> {
  return get<CoinBalanceResponse>("/v1/coin/balance")
}

export function getCoinAutoPaymentSettings(): Promise<unknown> {
  return get<unknown>("/v1/coin/auto-payment/settings")
}

export function getCreatorStats(): Promise<CreatorStatsResponse> {
  return get<CreatorStatsResponse>("/v1/creators/me/stats")
}

export function getZetaPassSubscription(): Promise<SubscriptionResponse> {
  return get<SubscriptionResponse>("/v1/zeta-pass/subscription")
}

export function getZetaPassPromotionEligibility(): Promise<PromotionEligibilityResponse> {
  return get<PromotionEligibilityResponse>("/v1/zeta-pass/promotion/eligibility")
}

export function getZetaPassProConversionStatus(): Promise<ProConversionStatusResponse> {
  return get<ProConversionStatusResponse>("/v1/zeta-pass/pro-conversion/status")
}

export function getLatestNotificationTime(): Promise<NotificationTimeResponse> {
  return get<NotificationTimeResponse>("/v1/notifications/latest-updated-at")
}

export function getAppPushSetting(type = "CREATOR_NEW_PLOT"): Promise<unknown> {
  return get<unknown>(`/v1/app-push/settings/${encodeURIComponent(type)}`)
}

export function getStoreProducts(productType: string): Promise<StoreProductsResponse> {
  return get<StoreProductsResponse>(
    `/v1/open-stores/ZETA_STORE/products?productType=${encodeURIComponent(productType)}`
  )
}

export async function getSessionOverview(): Promise<SessionOverview> {
  const settled = await Promise.allSettled([
    getCoinBalance(),
    getCreatorStats(),
    getZetaPassSubscription(),
    getZetaPassPromotionEligibility(),
    getLatestNotificationTime(),
    getUserChatProfiles(20),
  ])
  return {
    coin: settled[0].status === "fulfilled" ? settled[0].value : null,
    creatorStats: settled[1].status === "fulfilled" ? settled[1].value : null,
    subscription: settled[2].status === "fulfilled" ? settled[2].value : null,
    promotion: settled[3].status === "fulfilled" ? settled[3].value : null,
    notifications: settled[4].status === "fulfilled" ? settled[4].value : null,
    profiles: settled[5].status === "fulfilled" ? settled[5].value : null,
  }
}

// User chat profiles / personas
export function getUserChatProfiles(
  limit = 20,
  { plotId = "", roomId = "" }: { plotId?: string; roomId?: string } = {}
): Promise<UserChatProfilesResponse> {
  const params = new URLSearchParams()
  if (limit) params.set("limit", String(limit))
  if (plotId) params.set("plotId", plotId)
  if (roomId) params.set("roomId", roomId)
  const query = params.toString()
  return get<UserChatProfilesResponse>(
    `/v1/user-chat-profiles${query ? `?${query}` : ""}`
  )
}

export function createUserChatProfile({
  name,
  description,
}: {
  name: string
  description?: string
}): Promise<UserChatProfile> {
  return post<unknown>("/v1/user-chat-profiles", { name, description }).then(
    (data) =>
      validate(UserChatProfileSchema, data, "createUserChatProfile") as UserChatProfile
  )
}

export function checkUserChatProfileAbuse({
  name,
  description,
}: {
  name: string
  description?: string
}): Promise<AbuseCheckResponse> {
  return post<AbuseCheckResponse>("/v1/user-chat-profiles/abusing", {
    name,
    description,
  })
}

export function updateUserChatProfile(
  profileId: string,
  { name, description }: { name: string; description?: string }
): Promise<unknown> {
  return patch<unknown>(`/v1/user-chat-profiles/${profileId}`, {
    name,
    description,
  })
}

export function deleteUserChatProfile(profileId: string): Promise<unknown> {
  return del<unknown>(`/v1/user-chat-profiles/${profileId}`)
}

export function selectUserChatProfile(
  profileId: string,
  { plotId, roomId }: { plotId?: string; roomId?: string } = {}
): Promise<SelectProfileResponse> {
  return put<SelectProfileResponse>(
    `/v1/user-chat-profiles/${profileId}/selected`,
    { plotId, roomId }
  )
}

export function setDefaultUserChatProfile(
  profileId: string
): Promise<unknown> {
  return put<unknown>(`/v1/user-chat-profiles/${profileId}/default`, {})
}

export function selectPlotChatProfile({
  roomId,
  plotChatProfileId,
  plotId,
  name,
  profileImageUrl,
  summary,
  description,
}: {
  roomId: string
  plotChatProfileId: string
  plotId: string
  name: string
  profileImageUrl: string
  summary: string
  description: string
}): Promise<SelectPlotChatProfileResponse> {
  return post<SelectPlotChatProfileResponse>(
    `/v1/rooms/${roomId}/user-plot-chat-profiles/selected`,
    { plotChatProfileId, plotId, name, profileImageUrl, summary, description }
  )
}

export function getMyPlotChatProfile(
  roomId: string
): Promise<MyPlotChatProfileResponse> {
  return get<unknown>(
    `/v1/rooms/${roomId}/user-plot-chat-profiles/me`
  ).then(
    (data) =>
      validate(MyPlotChatProfileResponseSchema, data, "getMyPlotChatProfile") as MyPlotChatProfileResponse
  )
}

export function getSelectedUserPersona(
  plotId: string,
  roomId: string
): Promise<SelectedUserPersonaResponse> {
  return get<unknown>(
    `/v1/plots/${plotId}/rooms/${roomId}/user-personas/selected`
  ).then(
    (data) =>
      validate(
        SelectedUserPersonaResponseSchema,
        data,
        "getSelectedUserPersona"
      ) as SelectedUserPersonaResponse
  )
}

// Quiz
export function getQuiz(): Promise<QuizData> {
  return get<QuizData>("/v1/daily-quizzes")
}

export function joinQuiz(
  quizId: string | number,
  plotId: string
): Promise<JoinQuizResponse> {
  return post<JoinQuizResponse>(`/v1/daily-quizzes/${quizId}/selection`, {
    selection: { type: "SinglePlotSelection", plotId },
  })
}

export function claimQuiz(quizId: string | number): Promise<ClaimQuizResponse> {
  return post<ClaimQuizResponse>(`/v1/daily-quizzes/${quizId}/claim-reward`)
}

// SSE Reader
async function readSSE<T>(
  res: Response,
  onEvent: (event: T) => void,
  onDone?: () => void
): Promise<void> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    // Handle both \r\n and \n line endings
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(":")) continue // skip empty lines and SSE comments
      if (!trimmed.startsWith("data:")) continue
      const jsonText = trimmed.slice(5).trim() // remove 'data:' prefix
      if (!jsonText || jsonText === "[DONE]") continue
      try {
        const parsed = JSON.parse(jsonText) as T
        onEvent(parsed)
      } catch (e) {
        console.warn(
          "[SSE] Failed to parse:",
          jsonText.slice(0, 200),
          (e as Error).message
        )
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    const trimmed = buffer.trim()
    if (trimmed.startsWith("data:")) {
      const jsonText = trimmed.slice(5).trim()
      if (jsonText && jsonText !== "[DONE]") {
        try {
          onEvent(JSON.parse(jsonText) as T)
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (onDone) onDone()
}
