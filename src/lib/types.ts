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
