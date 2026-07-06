import { useEffect, useState, useRef, useCallback } from "react"
import { BookOpen, MessageCircle, ScrollText, Users } from "lucide-react"
import { toast } from "sonner"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import type { Plot, PlotDetailResponse, Character, IntroMessage } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CachedImage } from "@/components/cached-image"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { getPlot } from "@/lib/api"

interface PlotDetailDialogProps {
  plot: Plot | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStartChat?: (plot: Plot) => void
}

function formatCount(n: number | undefined) {
  if (!n) return "0"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function PlotDetailDialog({
  plot,
  open,
  onOpenChange,
  onStartChat,
}: PlotDetailDialogProps) {
  const [detail, setDetail] = useState<PlotDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!open || !plot?.id) {
      return
    }
    const loadPlot = async () => {
      setLoading(true)
      try {
        const data = await getPlot(plot.id)
        setDetail(data as PlotDetailResponse)
      } catch (e: unknown) {
        toast.error(
          `プロット取得失敗: ${e instanceof Error ? e.message : String(e)}`
        )
        setDetail(null)
      } finally {
        setLoading(false)
      }
    }
    loadPlot()
  }, [open, plot?.id])

  const d = (detail || plot || {}) as PlotDetailResponse

  // Resolve fields from actual API response
  const dExtra = d as unknown as Record<string, unknown>
  const heroImg = (d.imageUrl || d.initialRoomImageUrl || plot?.imageUrl || "") as string
  const plotName = (d.name || dExtra.title || plot?.name || "タイトルなし") as string
  const creatorName =
    d.creator?.nickname || d.creator?.username || ""
  const description =
    (d.shortDescription ||
    d.longDescription ||
    dExtra.description ||
    dExtra.synopsis ||
    dExtra.summary ||
    "") as string
  const characters: Character[] = Array.isArray(d.characters) ? d.characters : []
  const tagSources: string[] = d.hashtags || dExtra.hashTags as string[] || dExtra.tags as string[] || []
  const tags: string[] = (tagSources || []).filter((t): t is string => typeof t === "string")

  const interactionCount: number =
    d.interactionCount || dExtra.chatCount as number || dExtra.viewCount as number || 0

  // About section (world-building text + detailed character descriptions)
  const aboutContents: Array<{ type: string; content: string; text?: string }> =
    (d.isAboutPublic || d.about)
      ? (Array.isArray(d.about?.contents) ? d.about!.contents.map(c => ({ type: "text", content: c.content || c.text || "", text: c.text })) : [])
      : []
  const aboutCharacters: Array<{ characterId?: string; description?: string }> =
    Array.isArray(d.about?.characters) ? d.about!.characters : []

  // Fallback: use longDescription as about content when about section is missing
  if (aboutContents.length === 0 && d.longDescription) {
    aboutContents.push({ type: "text", content: d.longDescription as string })
  }

  // Build lookup from about.characters by characterId for description fallback
  const aboutCharMap: Record<string, string> = {}
  for (const ac of aboutCharacters) {
    if (ac.characterId && ac.description)
      aboutCharMap[ac.characterId] = ac.description
  }

  // Intro messages
  const introMessages: IntroMessage[] =
    d.intros?.[0]?.conversation?.messages || []
  // Build character lookup for avatars
  const charMap: Record<string, Character> = {}
  for (const c of characters) {
    if (c.id) charMap[c.id] = c
  }

  const handleStart = async () => {
    setStarting(true)
    try {
      if (onStartChat) await onStartChat(d as Plot)
    } finally {
      setStarting(false)
    }
  }

  // Track expanded items (character descriptions / intro messages)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [showPlotImage, setShowPlotImage] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const toggleImage = useCallback(() => {
    if (showPlotImage && isDesktop) {
      heroRef.current?.scrollIntoView({ behavior: "instant", block: "start" })
    }
    setShowPlotImage((prev) => !prev)
  }, [showPlotImage, isDesktop])
  const content = (
    <div className="flex h-full flex-col">
      <div className="touch-scrollable min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y">
      {/* Hero image */}
      {heroImg ? (
        <div
          ref={heroRef}
          className={`relative w-full cursor-pointer ${showPlotImage ? "" : "h-52 overflow-hidden sm:h-64"}`}
          onClick={toggleImage}
        >
          <CachedImage
            src={heroImg}
            alt={plotName}
            className={
              showPlotImage
                ? "h-auto w-full max-w-none"
                : "size-full object-cover"
            }
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute right-4 bottom-3 left-4">
            <h2 className="line-clamp-2 text-lg leading-tight font-bold text-white drop-shadow-lg">
              {plotName}
            </h2>
            {creatorName && (
              <p className="mt-0.5 text-sm text-white/80 drop-shadow">
                {creatorName}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Fallback header when no image */
        <div className="px-5 pt-5 pb-2">
          <h2 className="line-clamp-2 text-lg leading-tight font-bold">
            {plotName}
          </h2>
          {creatorName && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {creatorName}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 px-5 py-4">
        {/* Stats + interaction count */}
        {interactionCount > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageCircle className="size-3.5" />{" "}
              {formatCount(interactionCount)} 回の会話
            </span>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((label, i) => (
              <Badge key={i} variant="secondary" className="text-[11px]">
                #{label}
              </Badge>
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
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
            {description}
          </p>
        ) : null}

        {/* About / 設定 section */}
        {aboutContents && aboutContents.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ScrollText className="size-3.5" /> 設定
              </h3>
              <div className="flex flex-col gap-2">
                {(aboutContents as Array<{ type: string; content: string; text?: string }>).map(
                  (
                    item: { type: string; content: string; text?: string },
                    i: number
                  ) => {
                    const aboutKey = `about-${i}`
                    const isExpanded = expandedIds.has(aboutKey)
                    const itemContent = item.content || item.text || ""
                    return (
                      <div
                        key={i}
                        className="cursor-pointer rounded-lg bg-secondary/30 px-3 py-2"
                        onClick={() => toggleExpand(aboutKey)}
                      >
                        <p className={`text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-4"}`}>
                          {itemContent}
                        </p>
                      </div>
                    )
                  }
                )}
              </div>
            </div>
          </>
        )}

        {/* Characters section */}
        {characters.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="size-3.5" /> キャラクター
              </h3>
              <div className="flex flex-col gap-2">
                {characters.map(
                  (char) => {
                    const charKey = `char-${char.id || char.name}`
                    const isExpanded = expandedIds.has(charKey)
                    const charDesc =
                      char.description ||
                      (char.id ? aboutCharMap[char.id] : null) ||
                      null
                    return (
                      <div
                        key={char.id || char.name}
                        className="flex cursor-pointer items-start gap-3 rounded-lg bg-secondary/30 px-3 py-2"
                        onClick={() => charDesc && toggleExpand(charKey)}
                      >
                        <Avatar className="mt-0.5 size-9 shrink-0">
                          <AvatarImage src={char.imageUrl} />
                          <AvatarFallback>
                            {(char.name || "?")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {char.name}
                          </p>
                          {charDesc && (
                            <p
                              className={`mt-0.5 text-xs whitespace-pre-wrap text-muted-foreground ${isExpanded ? "" : "line-clamp-2"}`}
                            >
                              {charDesc}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  }
                )}
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
                {introMessages.map(
                  (msg, i) => {
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
                          <p
                            className={`text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground/70 italic ${isExpanded ? "" : "line-clamp-3"}`}
                          >
                            {msg.content}
                          </p>
                        ) : (
                          <>
                            {char?.imageUrl && (
                              <Avatar className="mt-0.5 size-7 shrink-0">
                                <AvatarImage src={char.imageUrl} />
                                <AvatarFallback>
                                  {(char.name || "?")[0]}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className="min-w-0 flex-1">
                              {char?.name && (
                                <p className="mb-0.5 text-[10px] font-medium text-muted-foreground">
                                  {char.name}
                                </p>
                              )}
                              <div className="rounded-2xl rounded-tl-sm bg-secondary/50 px-3 py-2">
                                <p
                                  className={`text-xs leading-relaxed whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-3"}`}
                                >
                                  {msg.content}
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  }
                )}
              </div>
            </div>
          </>
        )}
      </div>
      </div>

      {/* Action footer */}
      <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border px-5 py-3">
        {isDesktop && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            閉じる
          </Button>
        )}
        {onStartChat && (
          <Button
            size="sm"
            onClick={handleStart}
            disabled={starting || loading}
          >
            {starting && <Spinner className="mr-1 size-3" />}
            <MessageCircle className="mr-1 size-4" />
            チャット開始
          </Button>
        )}
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-md gap-0 overflow-y-auto p-0 sm:max-w-lg">
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} snapPoints={[0.45, 0.95]} snapToSequentialPoint handleOnly>
      <DrawerContent className="gap-0 overflow-hidden p-0">
        <div className="flex max-h-[95vh] flex-col overflow-hidden">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
