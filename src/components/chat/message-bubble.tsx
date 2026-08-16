import { memo } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CachedAvatarImage } from "@/components/cached-avatar-image"
import { cn } from "@/lib/utils"
import { formatMessageText } from "@/lib/format-message"
import type { ContentItem } from "@/lib/types"

interface MessageBubbleProps {
  content: ContentItem
  avatarUrl?: string
  onAvatarTap?: () => void
}

export const MessageBubble = memo(function MessageBubble({
  content,
  avatarUrl,
  onAvatarTap,
}: MessageBubbleProps) {
  const pos = (content.position as string) || "LEFT"
  if (pos === "NARRATOR") {
    return (
      <div className="mx-auto my-2 max-w-full rounded-lg bg-muted/50 px-4 py-2 text-center text-sm whitespace-pre-wrap text-muted-foreground italic [overflow-wrap:anywhere] sm:max-w-md">
        {formatMessageText(content.text || "")}
      </div>
    )
  }
  const isRight = pos === "RIGHT"
  return (
    <div
      className={cn(
        "animate-msg-in my-1 flex min-w-0 gap-2",
        isRight ? "flex-row-reverse" : "flex-row"
      )}
    >
      {!isRight && (
        <Avatar
          className="size-8 shrink-0 cursor-pointer"
          onClick={onAvatarTap}
        >
          <CachedAvatarImage src={avatarUrl} />
          <AvatarFallback>{(content.speakerName || "?")[0]}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "min-w-0 max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isRight ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}
      >
        {!isRight && content.speakerName && (
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {content.speakerName}
          </p>
        )}
        <div className="[overflow-wrap:anywhere] whitespace-pre-wrap">
          {formatMessageText(content.text || "")}
        </div>
      </div>
    </div>
  )
})
