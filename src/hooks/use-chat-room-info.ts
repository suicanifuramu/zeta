import { useState, useEffect } from "react"
import { getRoom, getRoomModelSetting } from "@/lib/api"
import { preloadImages } from "@/lib/image-preloader"
import type { Character } from "@/lib/types"

export interface UseChatRoomInfoReturn {
  plotName: string
  setPlotName: React.Dispatch<React.SetStateAction<string>>
  plotImg: string
  setPlotImg: React.Dispatch<React.SetStateAction<string>>
  headerSub: string
  setHeaderSub: React.Dispatch<React.SetStateAction<string>>
  charAvatars: Record<string, string>
  setCharAvatars: React.Dispatch<React.SetStateAction<Record<string, string>>>
  characters: Character[]
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>
  plotId: string
  setPlotId: React.Dispatch<React.SetStateAction<string>>
}

export function useChatRoomInfo(
  roomId: string | undefined
): UseChatRoomInfoReturn {
  const [plotName, setPlotName] = useState(
    () => sessionStorage.getItem("chat_plot_name") || "チャット"
  )
  const [plotImg, setPlotImg] = useState(
    () => sessionStorage.getItem("chat_plot_img") || ""
  )
  const [headerSub, setHeaderSub] = useState("接続中")
  const [charAvatars, setCharAvatars] = useState<Record<string, string>>({})
  const [characters, setCharacters] = useState<Character[]>([])
  const [plotId, setPlotId] = useState<string>("")

  useEffect(() => {
    if (!roomId) return
    getRoom(roomId)
      .then((room) => {
        const chars = room?.plot?.characters || []
        const avatars: Record<string, string> = {}
        chars.forEach((c) => {
          if (c.name && c.imageUrl) avatars[c.name] = c.imageUrl
        })
        setCharAvatars(avatars)
        setCharacters(chars)
        setPlotId(room?.plot?.id || "")

        const charImageUrls = chars
          .map((c) => c.imageUrl)
          .filter((u): u is string => !!u)
        if (charImageUrls.length > 0) {
          preloadImages(charImageUrls, { priority: "high" }).catch(() => {})
        }

        const roomPlotName = room?.plot?.name || room?.title
        const roomPlotImg = room?.plot?.imageUrl || chars?.[0]?.imageUrl
        if (roomPlotName) {
          setPlotName(roomPlotName)
          sessionStorage.setItem("chat_plot_name", roomPlotName)
        }
        if (roomPlotImg) {
          setPlotImg(roomPlotImg)
          sessionStorage.setItem("chat_plot_img", roomPlotImg)
        }
      })
      .catch(() => {})

    getRoomModelSetting(roomId)
      .then((model) => {
        if (model?.model || model?.type)
          setHeaderSub(`Model: ${model.model || model.type}`)
        else setHeaderSub("オンライン")
      })
      .catch(() => setHeaderSub("オンライン"))
  }, [roomId])

  return {
    plotName,
    setPlotName,
    plotImg,
    setPlotImg,
    headerSub,
    setHeaderSub,
    charAvatars,
    setCharAvatars,
    characters,
    setCharacters,
    plotId,
    setPlotId,
  }
}
