import { useEffect, useState } from "react"
import { BookOpen, MessageCircle, ScrollText, Users } from "lucide-react"
import { toast } from "sonner"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CachedImage } from "@/components/cached-image"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { getPlot } from "@/lib/api"

interface PlotDetailDialogProps {
  plot: any | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStartChat?: (plot: any) => void
}

function formatCount(n: number | undefined) {
  if (!n) return "0"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function PlotDetailDialog({ plot, open, onOpenChange, onStartChat }: PlotDetailDialogProps) {
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!open || !plot?.id) { setDetail(null); return }
    setLoading(true)
    getPlot(plot.id)
      .then((data: any) => setDetail(data))
      .catch((e: any) => {
        toast.error(`プロット取得失敗: ${e.message}`)
        setDetail(null)
      })
      .finally(() => setLoading(false))
  }, [open, plot?.id])

  const d = detail || plot || {}

  // Resolve fields from actual API response
  const heroImg = d.imageUrl || d.initialRoomImageUrl || plot?.imageUrl || ""
  const plotName = d.name || d.title || plot?.name || "タイトルなし"
  const creatorName = d.creator?.nickname || d.creatorName || d.creator?.username || ""
  const description = d.shortDescription || d.longDescription || d.description || d.synopsis || d.summary || ""
  const characters = d.characters || []
  const tags: string[] = (d.hashtags || d.hashTags || d.tags || []).map((t: any) =>
    typeof t === "string" ? t : t.name || t.label || ""
  ).filter(Boolean)
  const interactionCount = d.interactionCount || d.chatCount || d.viewCount || 0

  // About section (world-building text + detailed character descriptions)
  const aboutContents: any[] = (d.isAboutPublic || d.about) ? (d.about?.contents || []) : []
  const aboutCharacters: any[] = d.about?.characters || []

  // Build lookup from about.characters by characterId for description fallback
  const aboutCharMap: Record<string, string> = {}
  for (const ac of aboutCharacters) {
    if (ac.characterId && ac.description) aboutCharMap[ac.characterId] = ac.description
  }

  // Intro messages
  const introMessages: any[] = d.intros?.[0]?.conversation?.messages || []
  // Build character lookup for avatars
  const charMap: Record<string, any> = {}
  for (const c of characters) { if (c.id) charMap[c.id] = c }

  const handleStart = async () => {
    setStarting(true)
    try {
      if (onStartChat) await onStartChat(d)
    } finally {
      setStarting(false)
    }
  }

  // Track expanded items (character descriptions / intro messages)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isDesktop = useMediaQuery("(min-width: 768px)")
  const ScrollContainer: any = isDesktop ? ScrollArea : "div"
  const scrollProps = isDesktop ? { className: "max-h-[50vh]" } : { className: "max-h-[60vh] overflow-y-auto" }

  const content = (
    <>
      {/* Hero image */}
        {heroImg ? (
          <div className="relative h-52 w-full overflow-hidden sm:h-64">
            <CachedImage
              src={heroImg}
              alt={plotName}
              className="size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <h2 className="text-lg font-bold leading-tight text-white drop-shadow-lg line-clamp-2">
                {plotName}
              </h2>
              {creatorName && (
                <p className="mt-0.5 text-sm text-white/80 drop-shadow">{creatorName}</p>
              )}
            </div>
          </div>
        ) : (
          /* Fallback header when no image */
          <div className="px-5 pt-5 pb-2">
            <h2 className="text-lg font-bold leading-tight line-clamp-2">{plotName}</h2>
            {creatorName && (
              <p className="mt-0.5 text-sm text-muted-foreground">{creatorName}</p>
            )}
          </div>
        )}

        <ScrollContainer {...scrollProps}>
          <div className="flex flex-col gap-4 px-5 py-4">
            {/* Stats + interaction count */}
            {interactionCount > 0 && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageCircle className="size-3.5" /> {formatCount(interactionCount)} 回の会話
                </span>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((label, i) => (
                  <Badge key={i} variant="secondary" className="text-[11px]">#{label}</Badge>
                ))}
              </div>
            )}

            {/* Description */}
            {loading ? (
              <div className="flex flex-col gap-2">
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
              </div>
            ) : description ? (
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                {description}
              </p>
            ) : null}

            {/* Characters */}
            {characters.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Users className="size-3.5" /> キャラクター
                  </h3>
                  <div className="flex flex-col gap-2">
                    {characters.map((char: any) => {
                      const charKey = `char-${char.id || char.name}`
                      const isExpanded = expandedIds.has(charKey)
                      // Use about.characters description as fallback
                      const charDesc = char.description || (char.id ? aboutCharMap[char.id] : null) || null
                      return (
                        <div
                          key={char.id || char.name}
                          className="flex items-start gap-3 rounded-lg bg-secondary/30 px-3 py-2 cursor-pointer"
                          onClick={() => charDesc && toggleExpand(charKey)}
                        >
                          <Avatar className="size-9 shrink-0 mt-0.5">
                            <AvatarImage src={char.imageUrl} />
                            <AvatarFallback>{(char.name || "?")[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{char.name}</p>
                            {charDesc && (
                              <p className={`mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-2"}`}>
                                {charDesc}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* About / 設定 section */}
            {aboutContents.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ScrollText className="size-3.5" /> 設定
                  </h3>
                  <div className="flex flex-col gap-2">
                    {aboutContents.map((item: any, i: number) => {
                      const aboutKey = `about-${i}`
                      const isExpanded = expandedIds.has(aboutKey)
                      return (
                        <div
                          key={i}
                          className="cursor-pointer rounded-lg bg-secondary/30 px-3 py-2"
                          onClick={() => toggleExpand(aboutKey)}
                        >
                          <p className={`text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-4"}`}>
                            {item.content || item.text || ""}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Intro conversation preview */}
            {introMessages.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <BookOpen className="size-3.5" /> イントロ
                  </h3>
                  <div className="flex flex-col gap-2">
                    {introMessages.map((msg: any, i: number) => {
                      const isNarrator = msg.senderId === "_NARRATOR_"
                      const char = charMap[msg.senderId]
                      const msgKey = `intro-${i}`
                      const isExpanded = expandedIds.has(msgKey)
                      return (
                        <div
                          key={i}
                          className={`cursor-pointer ${isNarrator ? "px-2" : "flex gap-2"}`}
                          onClick={() => toggleExpand(msgKey)}
                        >
                          {isNarrator ? (
                            <p className={`text-xs italic text-muted-foreground/70 leading-relaxed whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-3"}`}>
                              {msg.content}
                            </p>
                          ) : (
                            <>
                              {char?.imageUrl && (
                                <Avatar className="size-7 mt-0.5 shrink-0">
                                  <AvatarImage src={char.imageUrl} />
                                  <AvatarFallback>{(char.name || "?")[0]}</AvatarFallback>
                                </Avatar>
                              )}
                              <div className="min-w-0 flex-1">
                                {char?.name && (
                                  <p className="mb-0.5 text-[10px] font-medium text-muted-foreground">{char.name}</p>
                                )}
                                <div className="rounded-2xl rounded-tl-sm bg-secondary/50 px-3 py-2">
                                  <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-3"}`}>
                                    {msg.content}
                                  </p>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollContainer>

        {/* Action footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          {isDesktop && (
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
          )}
          {onStartChat && (
            <Button size="sm" onClick={handleStart} disabled={starting || loading}>
              {starting && <Spinner className="mr-1 size-3" />}
              <MessageCircle className="mr-1 size-4" />
              チャット開始
            </Button>
          )}
        </div>
    </>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-lg">
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] gap-0 overflow-hidden p-0">
        {content}
      </DrawerContent>
    </Drawer>
  )
}
