"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { X } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { CharacterImageCarousel } from "@/components/character-image-carousel"
import { CharacterThumbnailStrip } from "@/components/character-thumbnail-strip"
import { getCharacterImages } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Character, CharacterImageResponse } from "@/lib/types"

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
  const [showFullDesc, setShowFullDesc] = useState(false)

  const wrappedSetCurrentIndex = useCallback(
    (index: number) => {
      console.log(
        "[DetailSheet] setCurrentIndex called with",
        index,
        "| prev:",
        currentIndex
      )
      setCurrentIndex(index)
    },
    [currentIndex]
  )

  useEffect(() => {
    if (!open || !character || !plotId) return

    const fetchImages = async () => {
      try {
        const data = await getCharacterImages(plotId, character.id) as CharacterImageResponse
        console.log("[DetailSheet] images loaded", {
          count: data.images?.length,
        })
        setImages(data.images)
        setCurrentIndex(0)
      } catch (e) {
        console.warn("Failed to load character images:", e)
      }
    }
    fetchImages()
  }, [open, character, plotId])

  const isDesktop = useMediaQuery("(min-width: 768px)")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showFullDesc) {
      scrollRef.current?.scrollTo(0, 0)
    }
  }, [showFullDesc])

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && showFullDesc) {
        setShowFullDesc(false)
        return
      }
      onOpenChange(newOpen)
    },
    [showFullDesc, onOpenChange]
  )

  if (!character || !open) return null

  const desc = character.description || ""
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
          onClick={() =>
            showFullDesc ? setShowFullDesc(false) : onOpenChange(false)
          }
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
        {showFullDesc ? (
          <div className="min-h-full bg-popover/95 px-4 py-4 text-sm whitespace-pre-wrap text-muted-foreground backdrop-blur">
            {desc}
          </div>
        ) : (
          <>
            <div className="relative aspect-square bg-muted">
              <CharacterImageCarousel
                images={images}
                index={currentIndex}
                onIndexChange={wrappedSetCurrentIndex}
              />
            </div>

            <div className="px-4 py-4">
              <CharacterDescription
                description={desc}
                showReadMore={showReadMore}
                onReadMore={() => setShowFullDesc(true)}
              />
            </div>

            <CharacterThumbnailStrip
              images={images}
              currentIndex={currentIndex}
              onSelect={wrappedSetCurrentIndex}
            />
          </>
        )}
      </div>
    </>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">{character.name}</DialogTitle>
          {detailContent}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} direction="bottom" snapPoints={[0.45, 0.95]} snapToSequentialPoint handleOnly>
      <DrawerContent className="flex max-h-[95vh] flex-col">
        <DrawerTitle className="sr-only">{character.name}</DrawerTitle>
        {detailContent}
      </DrawerContent>
    </Drawer>
  )
}

function CharacterDescription({
  description,
  showReadMore,
  onReadMore,
}: {
  description: string
  showReadMore: boolean
  onReadMore: () => void
}) {
  if (!description) return null

  return (
    <div>
      <div
        className={cn(
          "text-left text-sm break-all whitespace-pre-wrap text-muted-foreground",
          "line-clamp-5"
        )}
      >
        {description}
      </div>
      {showReadMore && (
        <button
          type="button"
          onClick={onReadMore}
          className="mt-2 block text-center text-sm text-muted-foreground/50 underline"
        >
          続きを読む
        </button>
      )}
    </div>
  )
}
