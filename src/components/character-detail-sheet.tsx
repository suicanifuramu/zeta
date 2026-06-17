"use client"

import { useEffect, useState } from "react"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
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

// Debug flag for character detail sheet
const DEBUG_SHEET = true
function debugLogSheet(...args: unknown[]) {
  if (DEBUG_SHEET) console.log("[CharacterDetailSheet]", ...args)
}

// Fetch images when sheet opens
  useEffect(() => {
    if (!open || !character || !plotId) return

    const fetchImages = async () => {
      try {
        debugLogSheet("Fetching images", { plotId, characterId: character.id })
        const data = await getCharacterImages(plotId, character.id)
        debugLogSheet("Received images", { images: data.images })
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
      <DrawerContent className="max-h-full bg-gray-main flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gray-main/95 backdrop-blur sticky top-0 z-10">
          <div className="flex-1" />
          <h2 className="title16 text-white text-center">{character.name}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:text-white/70"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="relative flex-1 overflow-y-auto">
          {/* Image Carousel */}
          <div className="relative aspect-square bg-black">
            <CharacterImageCarousel
              images={images}
              initialIndex={0}
              onIndexChange={setCurrentIndex}
            />
          </div>

          {/* Description with Gradient Fade */}
          <div className="relative">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-gray-main/95 to-transparent pointer-events-none" />
            <div className="px-4 py-4 pb-24">
              <CharacterDescription
                description={character.description || ""}
                isExpanded={descriptionExpanded}
                onToggle={() => setDescriptionExpanded((prev) => !prev)}
              />
            </div>
          </div>

          {/* Thumbnail Strip */}
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
            "body1 whitespace-pre-wrap break-all text-left text-white/70",
            isExpanded ? "" : "line-clamp-5"
          )}
        >
          {description}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="body1 mx-4 text-white/50 underline mt-2 block text-center"
        >
          {isExpanded ? "閉じる" : "続きを読む"}
        </button>
      </div>
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-gray-main/95 to-transparent pointer-events-none" />
    </div>
  )
}
