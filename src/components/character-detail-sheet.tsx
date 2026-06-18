"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)

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

  if (!character || !open) return null

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-popover/95 backdrop-blur sticky top-0 z-10">
          <div className="flex-1" />
          <DrawerTitle className="text-base font-medium text-center">
            {character.name}
          </DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" aria-label="Close">
              <X className="size-4" />
            </Button>
          </DrawerClose>
        </div>

        <div className="relative flex-1 overflow-y-auto">
          <div className="relative aspect-square bg-muted">
            <CharacterImageCarousel
              images={images}
              initialIndex={0}
              onIndexChange={setCurrentIndex}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-popover/95 to-transparent pointer-events-none" />
            <div className="px-4 py-4 pb-24">
              <CharacterDescription
                description={character.description || ""}
                isExpanded={descriptionExpanded}
                onToggle={() => setDescriptionExpanded((prev) => !prev)}
              />
            </div>
          </div>

          <CharacterThumbnailStrip
            images={images}
            currentIndex={currentIndex}
            onSelect={setCurrentIndex}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function CharacterDescription({
  description,
  isExpanded,
  onToggle,
}: {
  description: string
  isExpanded: boolean
  onToggle: () => void
}) {
  if (!description) return null

  return (
    <div className="relative">
      <div className="px-4">
        <div
          className={cn(
            "text-sm whitespace-pre-wrap break-all text-left text-muted-foreground",
            isExpanded ? "" : "line-clamp-5"
          )}
        >
          {description}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-sm text-muted-foreground/50 underline mt-2 block text-center"
        >
          {isExpanded ? "閉じる" : "続きを読む"}
        </button>
      </div>
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-popover/95 to-transparent pointer-events-none" />
    </div>
  )
}
