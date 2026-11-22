import {
  ensureAccessToken,
  getAccessToken,
  getGender,
  refreshSession,
} from "./auth"
import { getCommonHeaders, setAppVersion, APP_VERSION } from "./headers"
import type { PreparedImage } from "./image-upload"
import { z } from "zod"
import {
  CharacterImageResponseSchema,
  CheckPlotNameSchema,
  CommentSettingSchema,
  DiceThemesSchema,
  GalleryListSchema,
  PhoneManifestSchema,
  PluginPutResponseSchema,
  PlotPluginsSchema,
  PluginCatalogSchema,
  CreatorPlotListSchema,
  CreatorPlotSchema,
  HashtagAutocompleteSchema,
  ImageSetResultsSchema,
  ImageUploadResponseSchema,
  ImageUrlResponseSchema,
  KeywordTestSchema,
  LorebookDetailSchema,
  LorebookListSchema,
  MyPlotChatProfileResponseSchema,
  PlotDetailResponseSchema,
  ProfileImageHistorySchema,
  ProfileImageJobIdsSchema,
  ProfileImageJobStatusSchema,
  ProfileImageResultSchema,
  ProfileImageStyleListSchema,
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
  ImageUploadResponse,
  IntroBeforeSelectionResponse,
  JoinQuizResponse,
  LikedPlotsResponse,
  ModelSettingResponse,
  MyProfileResponse,
  MyPlotChatProfileResponse,
  NotificationTimeResponse,
  PlotDetailResponse,
  PlotSearchResponse,
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
  CommentWindowStatus,
  CreatorPlot,
  CreatorPlotListResponse,
  CropCoordinates,
  DiceTheme,
  GalleryImage,
  PluginCatalogItem,
  PlotPluginState,
  WallpaperPreset,
  ExampleChatStreamEvent,
  ImageSetResult,
  KeywordTestType,
  LorebookListResponse,
  LorebookSummary,
  ProfileImageHistoryResponse,
  ProfileImageJobStatus,
  ProfileImageResult,
  ProfileImageStyle,
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

/** Returns the minimum app version when the body is an APP_UPDATE_REQUIRED error. */
function getRequiredMinVersion(text: string): string | null {
  try {
    const body = JSON.parse(text) as {
      code?: string
      data?: string | Record<string, unknown>
    }
    if (body.code !== "APP_UPDATE_REQUIRED") return null
    const raw =
      typeof body.data === "string" ? JSON.parse(body.data) : body.data || {}
    return (
      (raw as { minimumRequiredVersion?: string }).minimumRequiredVersion ||
      null
    )
  } catch {
    return null
  }
}

/**
 * Shared POST for SSE endpoints. Uses the same common headers and the same
 * 401-refresh / APP_UPDATE_REQUIRED retry as `request()`; only `accept` differs.
 */
async function fetchEventStream(
  path: string,
  body: string | undefined,
  signal?: AbortSignal,
  retry = true,
  versionRetry = true
): Promise<Response> {
  await ensureAccessToken()
  const token = getAccessToken()
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      ...getCommonHeaders(),
      // Overrides the lowercase `accept` from getCommonHeaders; a second
      // `Accept` key would be merged into one header value.
      accept: "text/event-stream",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    signal,
  })

  if (res.status === 401 && retry) {
    await refreshSession(true)
    return fetchEventStream(path, body, signal, false, versionRetry)
  }

  if (res.status === 400 && versionRetry) {
    const text = await res.text().catch(() => "")
    const minVersion = getRequiredMinVersion(text)
    if (minVersion && minVersion !== APP_VERSION) {
      setAppVersion(minVersion)
      return fetchEventStream(path, body, signal, retry, false)
    }
    throw new Error(`POST ${path} -> 400: ${text.slice(0, 160)}`)
  }

  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`)
  return res
}

/**
 * Thrown for non-2xx responses. `message` keeps the historical format; `code` and
 * `serverMessage` come from the JSON body (e.g. PLOT_NAME_CONSTRAINT_VIOLATION).
 */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string | null
  readonly serverMessage: string | null

  constructor(message: string, status: number, code: string | null, serverMessage: string | null) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.code = code
    this.serverMessage = serverMessage
  }
}

function parseErrorBody(text: string): { code: string | null; message: string | null } {
  try {
    const body = JSON.parse(text) as { code?: unknown; message?: unknown }
    return {
      code: typeof body.code === "string" ? body.code : null,
      message: typeof body.message === "string" ? body.message : null,
    }
  } catch {
    return { code: null, message: null }
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
    const minVersion = getRequiredMinVersion(text)
    if (minVersion && minVersion !== APP_VERSION) {
      setAppVersion(minVersion)
      return request<T>(path, options, retry, false)
    }
    // The body is already consumed here, so the code is parsed from `text` now.
    const parsed = parseErrorBody(text)
    throw new ApiRequestError(
      `${options.method || "GET"} ${path} -> 400: ${text.slice(0, 160)}`,
      400,
      parsed.code,
      parsed.message
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    const parsed = parseErrorBody(text)
    throw new ApiRequestError(
      `${options.method || "GET"} ${path} -> ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`,
      res.status,
      parsed.code,
      parsed.message
    )
  }

  const text = await res.text()
  return (text ? JSON.parse(text) : {}) as T
}

async function get<T>(
  path: string,
  headers?: Record<string, string>
): Promise<T> {
  await ensureAccessToken()
  return request<T>(path, headers ? { headers } : {})
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
  filterValues = "all",
  gender = getGender() || "MALE"
): Promise<ApiRankingResponse> {
  const apiType = type === "TREND" ? "TRENDING" : type
  return get<ApiRankingResponse>(
    `/v1/plots/ranking?limit=${limit}&gender=${gender}&type=${apiType}&filterType=GENRE&filterValues=${encodeURIComponent(filterValues)}`
  )
}

// Search
export type PlotSearchOrder =
  | "RECOMMENDED"
  | "LATEST"
  | "MALE_RECOMMENDED"
  | "FEMALE_RECOMMENDED"

export interface PlotSearchOptions {
  order?: PlotSearchOrder
  limit?: number
  cursor?: string
  /** Tracking hint the web client sends for keyword chips: RECOMMEND / RELATED */
  source?: string
}

export function searchPlots(
  keyword: string,
  {
    order = "RECOMMENDED",
    limit = 18,
    cursor = "",
    source,
  }: PlotSearchOptions = {}
): Promise<PlotSearchResponse> {
  const params = new URLSearchParams({
    keyword,
    order,
    limit: String(limit),
  })
  if (cursor) params.set("cursor", cursor)
  if (source) params.set("source", source)
  return get<PlotSearchResponse>(`/v2/plots/search?${params.toString()}`)
}

export async function getPlotSearchCount(keyword: string): Promise<number> {
  const data = await get<{ count?: number }>(
    `/v2/plots/search/plot-count?keyword=${encodeURIComponent(keyword)}`
  )
  return data?.count ?? 0
}

export interface SearchSuggestion {
  hashtag: string
  count?: number
}

/** Hashtag suggestions for the search box (`/v1/plots/search/autocomplete`). */
export async function getSearchSuggestions(
  keyword: string
): Promise<SearchSuggestion[]> {
  const data = await get<{ hashtags?: SearchSuggestion[] }>(
    `/v1/plots/search/autocomplete?keyword=${encodeURIComponent(keyword)}`,
    // The autocomplete endpoint is the web client's; the android client type
    // gets APP_UPDATE_REQUIRED there, so ask for it as a web client.
    { "x-client-type": "web", "x-device-type": "pc_web" }
  )
  return (data.hashtags || []).filter(
    (item): item is SearchSuggestion => Boolean(item?.hashtag)
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

export function createRoom(
  plotId: string,
  intent?: string
): Promise<CreateRoomResponse> {
  // Without an intent the body stays exactly as before; the creator flow passes "AUTO".
  return post<CreateRoomResponse>(
    "/v1/rooms",
    intent ? { plotId, intent } : { plotId }
  )
}

export function getRooms(limit = 30, cursor = ""): Promise<ApiRoomsResponse> {
  return get<ApiRoomsResponse>(
    `/v1/rooms?limit=${limit}&orderBy.property=LAST_MESSAGE_TIME&orderBy.direction=DESC${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
  )
}

/** Cursor for the next page of rooms; null when the API returned none (single page). */
export function getNextRoomsCursor(data: ApiRoomsResponse): string | null {
  return data.nextCursor || data.cursor || null
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
  onDone?: () => void | Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetchEventStream(
    `/v1/rooms/${roomId}/messages/stream`,
    JSON.stringify({ type: "TEXT", text }),
    signal
  )
  await readSSE<T>(res, onEvent, onDone, signal)
}

// Regen (SSE stream)
export async function regenMessageStream<T = unknown>(
  roomId: string,
  messageId: string,
  onEvent: (event: T) => void,
  onDone?: () => void | Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetchEventStream(
    `/v1/rooms/${roomId}/messages/${messageId}/candidates/stream`,
    undefined,
    signal
  )
  await readSSE<T>(res, onEvent, onDone, signal)
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

export async function uploadUserChatProfileImage(
  file: File | Blob,
  cropCoordinates?: string
): Promise<ImageUploadResponse> {
  await ensureAccessToken()
  const formData = new FormData()
  formData.append("image", file)
  if (cropCoordinates) {
    formData.append("cropCoordinates", cropCoordinates)
  }
  return request<ImageUploadResponse>("/v1/user-chat-profiles/images", {
    method: "POST",
    body: formData,
    headers: {},
  }).then(
    (data) =>
      validate(ImageUploadResponseSchema, data, "uploadUserChatProfileImage") as ImageUploadResponse
  )
}

export function createUserChatProfile({
  name,
  description,
  profileImageUrl,
}: {
  name: string
  description?: string
  profileImageUrl?: string
}): Promise<UserChatProfile> {
  const body: Record<string, unknown> = { name }
  if (description) body.description = description
  if (profileImageUrl) body.profileImageUrl = profileImageUrl
  return post<unknown>("/v1/user-chat-profiles", body).then(
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
  { name, description, profileImageUrl }: { name: string; description?: string; profileImageUrl?: string }
): Promise<unknown> {
  const body: Record<string, unknown> = { name }
  // "" clears the description; undefined leaves it unchanged (omitted).
  if (description !== undefined) body.description = description
  // undefined = leave unchanged (omit), "" = clear, signed upload URL = replace.
  // A stored secret-less URL is rejected by the API (403 "Invalid image url").
  if (profileImageUrl !== undefined) body.profileImageUrl = profileImageUrl
  return patch<unknown>(`/v1/user-chat-profiles/${profileId}`, body)
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

/**
 * Uploads a profile image for the user's room-scoped plot chat profile.
 * The android client posts the same multipart fields (`image` +
 * `cropCoordinates`) to this endpoint. Minimum source/crop size is 256px.
 */
export async function uploadUserPlotChatProfileImage(
  file: File | Blob,
  cropCoordinates?: string
): Promise<ImageUploadResponse> {
  await ensureAccessToken()
  const formData = new FormData()
  formData.append("image", file)
  if (cropCoordinates) {
    formData.append("cropCoordinates", cropCoordinates)
  }
  return request<ImageUploadResponse>("/v1/user-plot-chat-profiles/images", {
    method: "POST",
    body: formData,
    headers: {},
  }).then(
    (data) =>
      validate(
        ImageUploadResponseSchema,
        data,
        "uploadUserPlotChatProfileImage"
      ) as ImageUploadResponse
  )
}

/**
 * Selects an already-created user plot chat profile (the `/me` record).
 * Unlike `selectPlotChatProfile` (POST `/selected`, which creates a record
 * from a plot preset), this updates the room's selection in place.
 */
export function selectMyPlotChatProfile(
  roomId: string,
  plotChatProfileId: string,
  plotId: string
): Promise<SelectPlotChatProfileResponse> {
  return put<SelectPlotChatProfileResponse>(
    `/v1/rooms/${roomId}/user-plot-chat-profiles/${plotChatProfileId}/selected`,
    { plotId }
  )
}

/**
 * Updates the user's room-scoped plot chat profile. The android client sends
 * only the fields that changed; an omitted `imageUrl` keeps the current image.
 */
export function updateMyPlotChatProfile(
  roomId: string,
  { name, description, imageUrl }: {
    name?: string
    description?: string
    imageUrl?: string
  }
): Promise<unknown> {
  const body: Record<string, unknown> = {}
  if (name !== undefined) body.name = name
  if (description !== undefined) body.description = description
  if (imageUrl !== undefined) body.imageUrl = imageUrl
  return patch<unknown>(
    `/v1/rooms/${roomId}/user-plot-chat-profiles/me`,
    body
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
  onDone?: () => void | Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>
    try {
      chunk = await reader.read()
    } catch (e) {
      // Aborting the request (e.g. leaving the room) is not an error.
      if (signal?.aborted) return
      throw e
    }
    const { done, value } = chunk
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

  if (onDone) await onDone()
}

// ---------------------------------------------------------------------------
// Creator (plot authoring)
// ---------------------------------------------------------------------------

const CREATOR_MODES = "STORY_CHAT,VISUAL_NOVEL"

/**
 * One page of the creator's plots. `status` is RELEASE or PRERELEASE. `isPrivate`
 * filters both (LIVE: verified for PRERELEASE and RELEASE); omit it for all.
 */
export function listCreatorPlots({
  status,
  isPrivate,
  limit = 15,
  cursor,
}: {
  status: "PRERELEASE" | "RELEASE"
  isPrivate?: boolean
  limit?: number
  cursor?: string | null
}): Promise<CreatorPlotListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    "orderBy.property": "UPDATED_AT",
    "orderBy.direction": "DESC",
    status,
    modes: CREATOR_MODES,
  })
  if (isPrivate !== undefined) params.set("isPrivate", String(isPrivate))
  if (cursor) params.set("cursor", cursor)
  return get<unknown>(`/v1/plots/creator?${params.toString()}`).then(
    (data) =>
      validate(CreatorPlotListSchema, data, "listCreatorPlots") as CreatorPlotListResponse
  )
}

/** Creates an empty PRERELEASE plot (no body). */
export function createCreatorPlot(): Promise<CreatorPlot> {
  return post<unknown>("/v1/plots").then(
    (data) => validate(CreatorPlotSchema, data, "createCreatorPlot") as CreatorPlot
  )
}

export function getCreatorPlot(plotId: string): Promise<CreatorPlot> {
  return get<unknown>(`/v1/plots/${plotId}/creator`).then(
    (data) => validate(CreatorPlotSchema, data, "getCreatorPlot") as CreatorPlot
  )
}

/** Partial section save. Callers must send whole sections (see plot-draft.ts). */
export function patchCreatorPlot(
  plotId: string,
  body: Record<string, unknown>
): Promise<CreatorPlot> {
  return patch<unknown>(`/v1/plots/${plotId}`, body).then(
    (data) => validate(CreatorPlotSchema, data, "patchCreatorPlot") as CreatorPlot
  )
}

/** Full-document save used right before publishing. */
export function putCreatorPlot(
  plotId: string,
  body: Record<string, unknown>
): Promise<CreatorPlot> {
  return put<unknown>(`/v1/plots/${plotId}`, body).then(
    (data) => validate(CreatorPlotSchema, data, "putCreatorPlot") as CreatorPlot
  )
}

export function setCreatorPlotPrivate(
  plotId: string,
  isPrivate: boolean
): Promise<CreatorPlot> {
  return patch<unknown>(`/v1/plots/${plotId}/private`, { isPrivate }).then(
    (data) => validate(CreatorPlotSchema, data, "setCreatorPlotPrivate") as CreatorPlot
  )
}

/** RELEASE publishes (or re-publishes) the draft; DELETE deletes the plot immediately (LIVE I1/I2). */
export function setCreatorPlotStatus(plotId: string, status: "RELEASE" | "DELETE"): Promise<CreatorPlot> {
  return patch<unknown>(`/v1/plots/${plotId}/status`, { status }).then(
    (data) => validate(CreatorPlotSchema, data, "setCreatorPlotStatus") as CreatorPlot
  )
}

export function publishCreatorPlot(plotId: string): Promise<CreatorPlot> {
  return setCreatorPlotStatus(plotId, "RELEASE")
}

export function deleteCreatorPlot(plotId: string): Promise<CreatorPlot> {
  return setCreatorPlotStatus(plotId, "DELETE")
}

/** Returns the warning keywords for a plot name (empty when clean). */
export function checkPlotName(name: string): Promise<string[]> {
  return get<unknown>(`/v1/plots/check-name?name=${encodeURIComponent(name)}`).then(
    (data) =>
      (validate(CheckPlotNameSchema, data, "checkPlotName") as { warnKeywords?: string[] | null })
        .warnKeywords ?? []
  )
}

export function testKeywords(type: KeywordTestType, text: string): Promise<boolean> {
  return post<unknown>("/v1/keywords/test", { type, text }).then(
    (data) =>
      (validate(KeywordTestSchema, data, "testKeywords") as { hasAbusingKeyword: boolean })
        .hasAbusingKeyword
  )
}

export function searchHashtagSuggestions(keyword: string): Promise<string[]> {
  return get<unknown>(
    `/v1/plots/search/autocomplete?keyword=${encodeURIComponent(keyword)}`
  ).then((data) => {
    const parsed = validate(HashtagAutocompleteSchema, data, "searchHashtagSuggestions") as {
      hashtags: { hashtag: string }[]
    }
    return parsed.hashtags.map((h) => h.hashtag)
  })
}

export function getProfileImageStyles(): Promise<ProfileImageStyle[]> {
  return get<unknown>("/v1/plots/profile-image/styles").then(
    (data) =>
      (validate(ProfileImageStyleListSchema, data, "getProfileImageStyles") as {
        styles: ProfileImageStyle[]
      }).styles
  )
}

export function registerProfileImageJobs(
  plotId: string,
  body: {
    prompt: string
    quantity: number
    styleId: string
    defaultPrompt: string
    negativePrompt: string
  }
): Promise<string[]> {
  return post<unknown>(`/v1/plots/profile-image/${plotId}/job/register`, body).then(
    (data) =>
      (validate(ProfileImageJobIdsSchema, data, "registerProfileImageJobs") as {
        jobIds: string[]
      }).jobIds
  )
}

export function getProfileImageJob(jobId: string): Promise<ProfileImageJobStatus> {
  return get<unknown>(`/v1/plots/profile-image/job/${jobId}`).then(
    (data) =>
      validate(ProfileImageJobStatusSchema, data, "getProfileImageJob") as ProfileImageJobStatus
  )
}

export function getProfileImageHistory(
  plotId: string,
  { limit = 10, cursor }: { limit?: number; cursor?: string | null } = {}
): Promise<ProfileImageHistoryResponse> {
  const cursorPart = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
  return get<unknown>(
    `/v1/plots/profile-image/${plotId}/history?limit=${limit}${cursorPart}`
  ).then(
    (data) =>
      validate(ProfileImageHistorySchema, data, "getProfileImageHistory") as ProfileImageHistoryResponse
  )
}

export function getSavedProfileImages({
  limit = 20,
  cursor,
}: { limit?: number; cursor?: string | null } = {}): Promise<ProfileImageHistoryResponse> {
  const cursorPart = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
  return get<unknown>(
    `/v1/plots/saved-profile-image/list?limit=${limit}${cursorPart}`
  ).then(
    (data) =>
      validate(ProfileImageHistorySchema, data, "getSavedProfileImages") as ProfileImageHistoryResponse
  )
}

export function getProfileImageResult(resultId: string): Promise<ProfileImageResult> {
  return get<unknown>(`/v1/plots/profile-image/${resultId}`).then(
    (data) =>
      validate(ProfileImageResultSchema, data, "getProfileImageResult") as ProfileImageResult
  )
}

function requestForm<T>(path: string, method: "POST" | "PUT", form: FormData): Promise<T> {
  // No Content-Type header: the browser must set the multipart boundary.
  return ensureAccessToken().then(() =>
    request<T>(path, { method, body: form, headers: {} })
  )
}

/** Registers a generated image (by its server URL) as a character image. */
export function addCharacterImage(
  plotId: string,
  characterId: string,
  imageUrl: string
): Promise<ImageSetResult[]> {
  const form = new FormData()
  form.append("imageUrls", imageUrl)
  return requestForm<unknown>(
    `/v2/plots/${plotId}/characters/${characterId}/images`,
    "POST",
    form
  ).then(
    (data) =>
      (validate(ImageSetResultsSchema, data, "addCharacterImage") as { results: ImageSetResult[] })
        .results
  )
}

export function cropCharacterImage(
  plotId: string,
  characterId: string,
  imageUrl: string,
  cropCoordinates: CropCoordinates
): Promise<string> {
  return post<unknown>(`/v2/plots/${plotId}/characters/${characterId}/images/crop`, {
    imageUrl,
    cropCoordinates,
  }).then(
    (data) =>
      (validate(ImageUrlResponseSchema, data, "cropCharacterImage") as { imageUrl: string })
        .imageUrl
  )
}

/** Sets a chat profile image. `profileImageResultId` is the generation result id (history item id). */
export function setChatProfileImage(
  plotId: string,
  chatProfileId: string,
  imageUrl: string,
  profileImageResultId: string | null
): Promise<string> {
  const form = new FormData()
  form.append("imageUrl", imageUrl)
  if (profileImageResultId) form.append("profileImageResultId", profileImageResultId)
  return requestForm<unknown>(
    `/v2/plots/${plotId}/chat-profiles/${chatProfileId}/images`,
    "PUT",
    form
  ).then(
    (data) =>
      (validate(ImageUrlResponseSchema, data, "setChatProfileImage") as { imageUrl: string })
        .imageUrl
  )
}

/** Adds a generated image as the plot cover. The server stores it on the draft. */
export function addPlotCoverImage(
  plotId: string,
  imageUrl: string
): Promise<ImageSetResult[]> {
  const form = new FormData()
  form.append("imageUrls", imageUrl)
  return requestForm<unknown>(`/v2/plots/${plotId}/images`, "POST", form).then(
    (data) =>
      (validate(ImageSetResultsSchema, data, "addPlotCoverImage") as { results: ImageSetResult[] })
        .results
  )
}

export interface ExampleChatRequestMessage {
  senderType: "BOT" | "USER"
  contents: {
    type: "TEXT"
    speakerName?: string
    position: "LEFT" | "RIGHT"
    text: string
  }[]
  messageTime: string
}

/** Streams the next example-conversation reply (SSE). Resolves when the stream ends. */
export async function streamExampleChat(
  plotId: string,
  messages: ExampleChatRequestMessage[],
  {
    signal,
    onEvent,
  }: { signal?: AbortSignal; onEvent: (event: ExampleChatStreamEvent) => void }
): Promise<void> {
  const res = await fetchEventStream(
    `/v1/plots/${plotId}/example-chat`,
    JSON.stringify({ messages }),
    signal
  )
  await readSSE<ExampleChatStreamEvent>(res, onEvent, undefined, signal)
}

export function getLorebookRecommendations({
  limit = 20,
  cursor,
}: { limit?: number; cursor?: string | null } = {}): Promise<LorebookListResponse> {
  const cursorPart = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
  return get<unknown>(
    `/v1/lorebooks/discovery/recommend?limit=${limit}${cursorPart}`
  ).then(
    (data) => validate(LorebookListSchema, data, "getLorebookRecommendations") as LorebookListResponse
  )
}

// ---- Plugins -----------------------------------------------------------------

export function getPluginCatalog(): Promise<PluginCatalogItem[]> {
  return get<unknown>("/v1/plugins").then((data) => {
    const parsed = validate(PluginCatalogSchema, data, "getPluginCatalog") as {
      plugins: { id: string; displayName?: string | null; paid?: boolean | null }[]
    }
    return parsed.plugins.map((p) => ({
      id: p.id,
      displayName: p.displayName ?? p.id,
      paid: p.paid === true,
    }))
  })
}

/** value = published, draftValue = draft (LIVE A2/C4). */
export function getPlotPlugins(plotId: string): Promise<PlotPluginState[]> {
  return get<unknown>(`/v1/plots/${plotId}/plugins`).then((data) => {
    const parsed = validate(PlotPluginsSchema, data, "getPlotPlugins") as {
      plugins: {
        pluginId: string
        displayName?: string | null
        state?: string | null
        paid?: boolean | null
        value?: unknown
        draftValue?: unknown
        constraints?: Record<string, unknown> | null
      }[]
    }
    return parsed.plugins.map((p) => ({
      pluginId: p.pluginId,
      displayName: p.displayName ?? p.pluginId,
      state: p.state ?? "AVAILABLE",
      paid: p.paid === true,
      value: p.value ?? null,
      draftValue: p.draftValue ?? null,
      constraints: p.constraints ?? null,
    }))
  })
}

/** Dice themes for the dice editor. The response is `{items:[{id,name}]}` (LIVE). */
export function getDiceThemes(): Promise<DiceTheme[]> {
  return get<unknown>("/v1/dice-themes").then((data) => {
    const parsed = validate(DiceThemesSchema, data, "getDiceThemes") as {
      items: { id: string; name?: string | null }[]
    }
    return parsed.items.map((t) => ({ id: t.id, name: t.name ?? t.id }))
  })
}

export function getPhoneWallpaperPresets(): Promise<WallpaperPreset[]> {
  return get<unknown>("/v1/plugins/phone-peek/manifest").then((data) => {
    const parsed = validate(PhoneManifestSchema, data, "getPhoneWallpaperPresets") as {
      manifest?: {
        wallpaperPresets?: { id: string; name?: string | null; imageUrl?: string | null }[] | null
      } | null
    }
    return (parsed.manifest?.wallpaperPresets ?? []).map((p) => ({
      id: p.id,
      name: p.name ?? null,
      imageUrl: p.imageUrl ?? null,
    }))
  })
}

/**
 * Dedicated editors only (bgm, event-cut). LIVE C1: any other plugin answers 400 PLUGIN_ID_INVALID.
 * Resolves with the value the server stored; callers mirror that value, not the one they sent.
 */
export function putPlotPlugin(
  plotId: string,
  pluginId: string,
  value: unknown
): Promise<{ pluginId: string; value: unknown }> {
  return put<unknown>(`/v1/plots/${plotId}/plugins`, { pluginId, value }).then((data) => {
    const parsed = validate(PluginPutResponseSchema, data, "putPlotPlugin") as {
      pluginId: string
      value?: unknown
    }
    return { pluginId: parsed.pluginId, value: parsed.value ?? null }
  })
}

// ---- Comment window ----------------------------------------------------------

export function getCommentWindowStatus(plotId: string): Promise<CommentWindowStatus> {
  return get<unknown>(`/v1/creator/plots/${plotId}/comment-setting`).then((data) =>
    (validate(CommentSettingSchema, data, "getCommentWindowStatus") as { windowStatus: string })
      .windowStatus === "OFF"
      ? "OFF"
      : "ON"
  )
}

/** Request key is `status` (LIVE J1); the response carries `windowStatus`. */
export function setCommentWindowStatus(plotId: string, status: CommentWindowStatus): Promise<CommentWindowStatus> {
  return patch<unknown>(`/v1/creator/plots/${plotId}/comment-setting`, { status }).then((data) =>
    (validate(CommentSettingSchema, data, "setCommentWindowStatus") as { windowStatus: string })
      .windowStatus === "OFF"
      ? "OFF"
      : "ON"
  )
}

// ---- Image gallery (local upload, replace, delete) ---------------------------

function galleryFrom(data: unknown, endpoint: string): GalleryImage[] {
  const parsed = validate(GalleryListSchema, data, endpoint) as {
    images: { imageUrl: string; aspectRatio?: number | null }[]
  }
  return parsed.images.map((i) => ({ imageUrl: i.imageUrl, aspectRatio: i.aspectRatio ?? 1 }))
}

export function listCharacterGallery(plotId: string, characterId: string): Promise<GalleryImage[]> {
  return get<unknown>(`/v2/plots/${plotId}/characters/${characterId}/images/creator`).then((data) =>
    galleryFrom(data, "listCharacterGallery")
  )
}

export function listCoverGallery(plotId: string): Promise<GalleryImage[]> {
  return get<unknown>(`/v2/plots/${plotId}/images/creator`).then((data) => galleryFrom(data, "listCoverGallery"))
}

function appendGalleryAddFields(form: FormData, image: PreparedImage) {
  form.append("images", image.blob, image.fileName)
  form.append("widths", String(image.width))
  form.append("heights", String(image.height))
  form.append("aspectRatios", String(image.aspectRatio))
}

function appendReplaceFields(form: FormData, image: PreparedImage) {
  form.append("image", image.blob, image.fileName)
  form.append("width", String(image.width))
  form.append("height", String(image.height))
  form.append("aspectRatio", String(image.aspectRatio))
}

/** Adds an uploaded file to a character's gallery (multipart `images` + sizes). */
export function uploadCharacterImage(
  plotId: string,
  characterId: string,
  image: PreparedImage
): Promise<ImageSetResult[]> {
  const form = new FormData()
  appendGalleryAddFields(form, image)
  return requestForm<unknown>(`/v2/plots/${plotId}/characters/${characterId}/images`, "POST", form).then(
    (data) =>
      (validate(ImageSetResultsSchema, data, "uploadCharacterImage") as { results: ImageSetResult[] }).results
  )
}

/** Replaces the gallery item at `sequence` (LIVE D3: `sequence` is required, 0-based). */
export function replaceCharacterImage(
  plotId: string,
  characterId: string,
  image: PreparedImage,
  sequence: number
): Promise<string> {
  const form = new FormData()
  appendReplaceFields(form, image)
  form.append("sequence", String(sequence))
  return requestForm<unknown>(`/v2/plots/${plotId}/characters/${characterId}/images`, "PUT", form).then(
    (data) => (validate(ImageUrlResponseSchema, data, "replaceCharacterImage") as { imageUrl: string }).imageUrl
  )
}

/** LIVE D6: DELETE with a JSON body `{sequence}`. */
export function deleteCharacterImage(plotId: string, characterId: string, sequence: number): Promise<unknown> {
  return del<unknown>(`/v2/plots/${plotId}/characters/${characterId}/images`, { sequence })
}

export function uploadCoverImage(plotId: string, image: PreparedImage): Promise<ImageSetResult[]> {
  const form = new FormData()
  appendGalleryAddFields(form, image)
  return requestForm<unknown>(`/v2/plots/${plotId}/images`, "POST", form).then(
    (data) => (validate(ImageSetResultsSchema, data, "uploadCoverImage") as { results: ImageSetResult[] }).results
  )
}

/** LIVE D8: DELETE with `{sequence}`. */
export function deleteCoverImage(plotId: string, sequence: number): Promise<unknown> {
  return del<unknown>(`/v2/plots/${plotId}/images`, { sequence })
}

/** Local file for a chat profile (LIVE D9: no profileImageResultId needed). */
export function uploadChatProfileImage(plotId: string, chatProfileId: string, image: PreparedImage): Promise<string> {
  const form = new FormData()
  appendReplaceFields(form, image)
  return requestForm<unknown>(`/v2/plots/${plotId}/chat-profiles/${chatProfileId}/images`, "PUT", form).then(
    (data) => (validate(ImageUrlResponseSchema, data, "uploadChatProfileImage") as { imageUrl: string }).imageUrl
  )
}

export function getLorebookDetail(lorebookId: string): Promise<LorebookSummary> {
  return get<unknown>(`/v1/lorebooks/${lorebookId}`).then(
    (data) => validate(LorebookDetailSchema, data, "getLorebookDetail") as LorebookSummary
  )
}
