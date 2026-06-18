import { useEffect, useState, useRef, useCallback } from "react"
import { BookOpen, MessageCircle, ScrollText, Users, X } from "lucide-react"
import { toast } from "sonner"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import type { Plot } from "@/lib/types"
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

export function PlotDetailDialog({ plot, open, onOpenChange, onStartChat }: PlotDetailDialogProps) {
  const [detail, setDetail] = useState<any /* eslint-disable-line @typescript-eslint/no-explicit-any */ | null>(null)
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open || !plot?.id) { setDetail(null); return }
    setLoading(true)
    getPlot(plot.id)
       
      .then((data: unknown) => setDetail(data as any /* eslint-disable-line @typescript-eslint/no-explicit-any */))
      .catch((e: unknown) => {
        toast.error(`プロット取得失敗: ${e instanceof Error ? e.message : String(e)}`)
         
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
  const characters = (d.characters as any /* eslint-disable-line @typescript-eslint/no-explicit-any */[]) || []
  const tags: string[] = ((d.hashtags || d.hashTags || d.tags || []) as any  []).map((t: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ | string) =>
    typeof t === "string" ? t : (t.name as string) || (t.label as string) || ""
  ).filter(Boolean)
  const interactionCount = d.interactionCount || d.chatCount || d.viewCount || 0

  // About section (world-building text + detailed character descriptions)
  const aboutObj = d.about as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ | undefined
  const aboutContents: any  [] = (d.isAboutPublic || d.about) ? (aboutObj?.contents as any /* eslint-disable-line @typescript-eslint/no-explicit-any */[] || []) : []
  const aboutCharacters: any  [] = (aboutObj?.characters as any /* eslint-disable-line @typescript-eslint/no-explicit-any */[]) || []

  // Build lookup from about.characters by characterId for description fallback
  const aboutCharMap: Record<string, string> = {}
  for (const ac of aboutCharacters) {
    if (ac.characterId && ac.description) aboutCharMap[ac.characterId as string] = ac.description as string
  }

  // Intro messages
  const introMessages: any  [] = ((d.intros as any  [])?.[0]?.conversation as any  )?.messages as any /* eslint-disable-line @typescript-eslint/no-explicit-any */[] || []
  // Build character lookup for avatars
  const charMap: Record<string, any /* eslint-disable-line @typescript-eslint/no-explicit-any */> = {}
  for (const c of characters) { if (c.id) charMap[c.id as string] = c }

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
    <>
      {/* Hero image */}
        {heroImg ? (
          <div
            ref={heroRef}
            className={`relative w-full cursor-pointer ${showPlotImage ? "" : "h-52 sm:h-64 overflow-hidden"}`}
            onClick={toggleImage}
          >
            <CachedImage
              src={heroImg}
              alt={plotName}
              className={showPlotImage ? "w-full h-auto max-w-none" : "size-full object-cover"}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent pointer-events-none" />
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

            {/* About / 設定 section */}
            {aboutContents.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ScrollText className="size-3.5" /> 設定
                  </h3>
                  <div className="flex flex-col gap-2">
                    {aboutContents.map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, i: number) => {
                      const aboutKey = `about-${i}`
                      const isExpanded = expandedIds.has(aboutKey)
                      return (
                        <div
                          key={i}
                          className="cursor-pointer rounded-lg bg-secondary/30 px-3 py-2"
                          onClick={() => toggleExpand(aboutKey)}
                        >
                          <p className={`text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-4"}`}>
                            {(item.content as string) || (item.text as string) || ""}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Characters */}
            {characters.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Users className="size-3.5" /> キャラクター
                  </h3>
                  <div className="flex flex-col gap-2">
                    {characters.map((char: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
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
                            <AvatarImage src={char.imageUrl as string} />
                            <AvatarFallback>{((char.name as string) || "?")[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{char.name as string}</p>
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

            {/* Intro conversation preview */}
            {introMessages.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <BookOpen className="size-3.5" /> イントロ
                  </h3>
                  <div className="flex flex-col gap-2">
                    {introMessages.map((msg: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, i: number) => {
                      const isNarrator = msg.senderId === "_NARRATOR_"
                      const char = charMap[msg.senderId as string]
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
                              {msg.content as string}
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
                                  <p className="mb-0.5 text-[10px] font-medium text-muted-foreground">{char.name as string}</p>
                                )}
                                <div className="rounded-2xl rounded-tl-sm bg-secondary/50 px-3 py-2">
                                  <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-3"}`}>
                                    {msg.content as string}
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
        <DialogContent className="max-w-md gap-0 overflow-y-auto p-0 sm:max-w-lg max-h-[85vh]">
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] gap-0 p-0 overflow-hidden">
        <div className="overflow-y-auto overscroll-contain touch-scrollable max-h-[85vh]">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
