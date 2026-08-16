"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { X } from "lucide-react"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Button } from "@/components/ui/button"
import { CharacterImageCarousel } from "@/components/character-image-carousel"
import { CharacterThumbnailStrip } from "@/components/character-thumbnail-strip"
import { getCharacterImages, getPlot } from "@/lib/api"
import { cn, stripBackticks } from "@/lib/utils"
import type { Character } from "@/lib/types"

interface CharacterDetailSheetProps {
  character: Character | null
  plotId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CharacterDetailSheet({
  character,
  plotId,
  open,
  onOpenChange,
}: CharacterDetailSheetProps) {
  const [images, setImages] = useState<
    Array<{ imageUrl: string; aspectRatio: number }>
  >([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [fallbackDescription, setFallbackDescription] = useState("")

  useEffect(() => {
    if (!open || !character || !plotId) return

    const fetchImages = async () => {
      try {
        const data = await getCharacterImages(plotId, character.id)
        setImages(data.images)
        setCurrentIndex(0)
      } catch (e) {
        console.warn("Failed to load character images:", e)
      }
    }
    fetchImages()
  }, [open, character, plotId])

  useEffect(() => {
    if (!open || !character || !plotId) return
    if (character.description) {
      setFallbackDescription("")
      return
    }
    let cancelled = false
    const fetchDescription = async () => {
      try {
        const plot = await getPlot(plotId)
        if (cancelled) return
        const about = plot.about?.characters?.find(
          (c) => c.characterId === character.id
        )
        setFallbackDescription(about?.description || "")
      } catch (e) {
        if (!cancelled) console.warn("Failed to load character description:", e)
      }
    }
    fetchDescription()
    return () => {
      cancelled = true
    }
  }, [open, character, plotId])

  const scrollRef = useRef<HTMLDivElement>(null)

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  if (!character || !open) return null

  const desc = stripBackticks(
    character.description || fallbackDescription || ""
  )
  const showReadMore = desc.length > 100 || desc.includes("\n")

  const detailContent = (
    <>
      <div className="flex shrink-0 items-center justify-between bg-popover/95 px-4 py-3 backdrop-blur">
        <div className="flex-1" />
        <span className="text-center text-base font-medium">
          {character.name}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="relative aspect-square bg-muted">
          <CharacterImageCarousel
            images={images}
            index={currentIndex}
            onIndexChange={setCurrentIndex}
          />
        </div>

        <div className="px-4 py-4">
          <CharacterDescription
            description={desc}
            showReadMore={showReadMore}
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
          />
        </div>

        <CharacterThumbnailStrip
          images={images}
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
        />
      </div>
    </>
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={character.name}
      desktopClassName="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0"
      mobileClassName="flex max-h-[85vh] flex-col"
      showCloseButton={false}
    >
      {detailContent}
    </ResponsiveDialog>
  )
}

function CharacterDescription({
  description,
  showReadMore,
  expanded,
  onToggle,
}: {
  description: string
  showReadMore: boolean
  expanded: boolean
  onToggle: () => void
}) {
  if (!description) return null

  return (
    <div>
      <div
        className={cn(
          "text-left text-sm break-all whitespace-pre-wrap text-muted-foreground",
          !expanded && "line-clamp-5"
        )}
      >
        {description}
      </div>
      {showReadMore && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 block text-center text-sm text-muted-foreground/50 underline"
        >
          {expanded ? "閉じる" : "続きを読む"}
        </button>
      )}
    </div>
  )
}
