import {
  getMessages,
  getMessagesByCursor,
  getMyPlotChatProfile,
  getPlot,
  getRoom,
  getSelectedUserPersona,
} from "@/lib/api"
import type {
  ContentItem,
  Room,
  RuntimeMessage,
} from "@/lib/types"

export type ExportRole = "user" | "bot"

export interface ExportMessage {
  id: string
  createdAt?: string
  senderType?: string
  role: ExportRole
  speakerName?: string
  speakerPosition?: string
  text: string
  contents: ContentItem[]
}

export interface ExportRoomJson {
  version: 1
  exportedAt: string
  roomId: string
  roomTitle?: string
  totalMessages: number
  /** getPlot() の返り値をそのまま格納（整形しない） */
  plot: unknown
  /** 設定したユーザープロフィール（取得できなければ null） */
  userProfile: { source: string; data: unknown } | null
  messages: {
    all: ExportMessage[]
    user: ExportMessage[]
    bot: ExportMessage[]
  }
}

function classifyMessage(msg: RuntimeMessage): ExportRole {
  const senderType = msg.sender?.type?.toUpperCase()
  if (senderType === "USER") return "user"
  if (senderType === "BOT") return "bot"
  const positions = (msg.contents || []).map((c) => c.position)
  if (positions.length > 0 && positions.every((p) => p === "RIGHT")) {
    return "user"
  }
  if (positions.includes("LEFT")) return "bot"
  return "bot"
}

function toExportMessage(msg: RuntimeMessage): ExportMessage {
  const contents = msg.contents || []
  const first = contents[0]
  const text = contents
    .map((c) => (c.text || "").trim())
    .filter(Boolean)
    .join("\n\n")
  return {
    id: msg.id,
    createdAt: msg.createdAt,
    senderType: msg.sender?.type,
    role: classifyMessage(msg),
    speakerName: first?.speakerName,
    speakerPosition: first?.position,
    text: text || msg.text || "",
    contents,
  }
}

/** 全メッセージを遡及取得（古い順に並べて返す） */
export async function fetchAllMessages(
  roomId: string,
  batchLimit = 50
): Promise<RuntimeMessage[]> {
  const first = await getMessages(roomId, batchLimit)
  let acc: RuntimeMessage[] = first.messages || []
  if (acc.length === 0) return acc

  const seen = new Set(acc.map((m) => m.id))
  // 安全弁：無限ループ防止（1ルーム2万件想定）
  for (let i = 0; i < 400; i++) {
    const oldest = acc[0]
    if (!oldest?.id) break
    const older = await getMessagesByCursor(roomId, oldest.id, batchLimit)
    const batch = (older.messages || []).filter((m) => !seen.has(m.id))
    if (batch.length === 0) break
    for (const m of batch) seen.add(m.id)
    acc = [...batch, ...acc]
    if ((older.messages || []).length < batchLimit) break
  }
  return acc
}

async function fetchPlotRaw(
  room: Room,
  roomId: string
): Promise<unknown> {
  const plotId =
    (room.plot as { id?: string } | undefined)?.id || ""
  if (plotId) {
    try {
      return await getPlot(plotId)
    } catch {
      // フォールバック：ルーム一覧の plot をそのまま使う
      return room.plot || null
    }
  }
  try {
    const detail = await getRoom(roomId)
    const pid = detail?.plot?.id
    if (pid) {
      try {
        return await getPlot(pid)
      } catch {
        return detail.plot || null
      }
    }
    return detail.plot || null
  } catch {
    return room.plot || null
  }
}

async function fetchUserProfileRaw(
  room: Room,
  roomId: string
): Promise<ExportRoomJson["userProfile"]> {
  try {
    const data = await getMyPlotChatProfile(roomId)
    return { source: "myPlotChatProfile", data }
  } catch {
    // フォールバック：旧エンドポイント
  }
  const plotId =
    (room.plot as { id?: string } | undefined)?.id || ""
  if (plotId) {
    try {
      const data = await getSelectedUserPersona(plotId, roomId)
      return { source: "selectedUserPersona", data }
    } catch {
      return null
    }
  }
  return null
}

export async function buildExportRoomJson(
  room: Room
): Promise<ExportRoomJson> {
  const roomId = room.id
  const [allRaw, plot, userProfile] = await Promise.all([
    fetchAllMessages(roomId),
    fetchPlotRaw(room, roomId),
    fetchUserProfileRaw(room, roomId),
  ])
  const all = allRaw.map(toExportMessage)
  const user = all.filter((m) => m.role === "user")
  const bot = all.filter((m) => m.role === "bot")
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    roomId,
    roomTitle:
      room.title || (room.plot as { name?: string } | undefined)?.name,
    totalMessages: all.length,
    plot,
    userProfile,
    messages: { all, user, bot },
  }
}

export function downloadRoomJson(roomId: string, data: ExportRoomJson) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${roomId}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
