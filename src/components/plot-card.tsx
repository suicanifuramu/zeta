import { memo } from "react"
import { MessageCircle } from "lucide-react"
import { CachedImage } from "@/components/cached-image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { optimizeImageUrl } from "@/lib/image-url"
import { cn } from "@/lib/utils"

interface PlotCardProps {
  plot: {
    id: string
    name: string
    imageUrl?: string
    shortDescription?: string
    interactionCount?: number
    hashtags?: string[]
    rank?: number
    rankDiff?: number
    isNew?: boolean
  }
  onClick?: () => void
  onTagClick?: (tag: string) => void
  className?: string
  cached?: boolean
  /** Eager-load the cover (use for the first visible row). */
  priority?: boolean
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export const PlotCard = memo(function PlotCard({
  plot,
  onClick,
  onTagClick,
  className,
  cached = true,
  priority = false,
}: PlotCardProps) {
  const tags = (plot.hashtags || []).slice(0, 3)
  const coverSrc = optimizeImageUrl(plot.imageUrl, 384)

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden border-border/50 bg-card/50 transition-all duration-300",
        "hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_4px_30px_oklch(0.65_0.25_290/15%)]",
        className
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      {plot.rank && (
        <div className="absolute top-2 left-2 z-10 flex size-7 items-center justify-center rounded-full bg-primary/90 text-xs font-bold text-primary-foreground">
          {plot.rank}
        </div>
      )}
      {plot.imageUrl && (
        <div className="aspect-[3/4] overflow-hidden">
          <CachedImage
            src={coverSrc}
            alt={plot.name}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            noCache={!cached}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <CardContent className="p-3">
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold">
          {plot.name}
        </h3>
        {plot.shortDescription && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {plot.shortDescription}
            {plot.rankDiff !== undefined && plot.rankDiff > 0 && (
              <span className="ml-1 text-green-400">↑{plot.rankDiff}</span>
            )}
            {plot.rankDiff !== undefined && plot.rankDiff < 0 && (
              <span className="ml-1 text-destructive">
                ↓{Math.abs(plot.rankDiff)}
              </span>
            )}
            {plot.isNew && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                NEW
              </Badge>
            )}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MessageCircle className="size-3" />
          <span className="tabular-nums">
            {formatCount(plot.interactionCount || 0)}
          </span>
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag) =>
              onTagClick ? (
                <button
                  key={tag}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTagClick(tag)
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="inline-flex min-h-5 items-center rounded-full border border-border px-2 text-[10px] font-normal text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label={`#${tag} で検索`}
                >
                  {tag}
                </button>
              ) : (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] font-normal"
                >
                  {tag}
                </Badge>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
