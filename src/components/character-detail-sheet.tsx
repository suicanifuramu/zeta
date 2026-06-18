"use client"

import { useEffect, useState, useCallback } from "react"
import { X } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { CharacterImageCarousel } from "@/components/character-image-carousel"
import { CharacterThumbnailStrip } from "@/components/character-thumbnail-strip"
import { getCharacterImages } from "@/lib/api"
import { cn } from "@/lib/utils"
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
  const [images, setImages] = useState<Array<{ imageUrl: string; aspectRatio: number }>>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showFullDesc, setShowFullDesc] = useState(false)

  const wrappedSetCurrentIndex = useCallback((index: number) => {
    console.log("[DetailSheet] setCurrentIndex called with", index, "| prev:", currentIndex)
    setCurrentIndex(index)
  }, [currentIndex])

  useEffect(() => {
    if (!open || !character || !plotId) return

    const fetchImages = async () => {
      try {
        const data = await getCharacterImages(plotId, character.id)
        console.log("[DetailSheet] images loaded", { count: data.images?.length })
        setImages(data.images)
        setCurrentIndex(0)
      } catch (e) {
        console.warn("Failed to load character images:", e)
      }
    }
    fetchImages()
  }, [open, character, plotId])

  const isDesktop = useMediaQuery("(min-width: 768px)")

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && showFullDesc) {
      setShowFullDesc(false)
      return
    }
    onOpenChange(newOpen)
  }, [showFullDesc, onOpenChange])

  if (!character || !open) return null

  const desc = character.description || ""
  const showReadMore = desc.length > 100 || desc.includes("\n")

  const detailContent = (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-popover/95 backdrop-blur shrink-0">
        <div className="flex-1" />
        <span className="text-base font-medium text-center">{character.name}</span>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <div className={showFullDesc ? "opacity-30 pointer-events-none select-none" : ""}>
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
              showReadMore={showFullDesc ? false : showReadMore}
              onReadMore={() => setShowFullDesc(true)}
            />
          </div>

          <CharacterThumbnailStrip
            images={images}
            currentIndex={currentIndex}
            onSelect={wrappedSetCurrentIndex}
          />
        </div>

        {showFullDesc && (
          <div className="absolute inset-0 z-20 overflow-y-auto">
            <div className="min-h-full bg-popover/80 backdrop-blur-sm">
              <div className="relative px-4 py-4 whitespace-pre-wrap text-sm text-muted-foreground">
                <Button variant="ghost" size="icon" onClick={() => setShowFullDesc(false)} className="absolute top-2 right-2 z-30 text-muted-foreground hover:text-foreground" aria-label="閉じる">
                  <X className="size-4" />
                </Button>
                {desc}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 max-h-[85vh] flex flex-col" showCloseButton={false}>
          <DialogTitle className="sr-only">{character.name}</DialogTitle>
          {detailContent}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} direction="bottom">
      <DrawerContent className="max-h-[85vh] flex flex-col">
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
          "text-sm whitespace-pre-wrap break-all text-left text-muted-foreground",
          "line-clamp-5"
        )}
      >
        {description}
      </div>
      {showReadMore && (
        <button
          type="button"
          onClick={onReadMore}
          className="text-sm text-muted-foreground/50 underline mt-2 block text-center"
        >
          続きを読む
        </button>
      )}
    </div>
  )
}
