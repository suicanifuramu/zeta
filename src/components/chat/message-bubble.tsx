import { memo } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CachedAvatarImage } from "@/components/cached-avatar-image"
import { cn } from "@/lib/utils"
import { useLongPress } from "@/hooks/use-long-press"
import type { ContentItem } from "@/lib/types"

function formatMessageText(text: string) {
  if (!text) return null
  const parts = text.split(/(\*\*?[^*]+\*\*?)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <i key={i} className="opacity-80">
          {part.slice(2, -2)}
        </i>
      )
    } else if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <i key={i} className="opacity-80">
          {part.slice(1, -1)}
        </i>
      )
    }
    return part
  })
}

interface MessageBubbleProps {
  content: ContentItem
  avatarUrl?: string
  onAvatarTap?: () => void
  onUserMessageTap?: () => void
}

export const MessageBubble = memo(function MessageBubble({
  content,
  avatarUrl,
  onAvatarTap,
  onUserMessageTap,
}: MessageBubbleProps) {
  const pos = (content.position as string) || "LEFT"
  const longPressHandlers = useLongPress(onUserMessageTap ?? (() => {}))
  if (pos === "NARRATOR") {
    return (
      <div className="mx-auto my-2 max-w-md rounded-lg bg-muted/50 px-4 py-2 text-center text-sm whitespace-pre-wrap text-muted-foreground italic">
        {formatMessageText(content.text || "")}
      </div>
    )
  }
  const isRight = pos === "RIGHT"
  return (
    <div
      className={cn(
        "animate-msg-in my-1 flex gap-2",
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
          "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isRight
            ? "cursor-pointer bg-primary text-primary-foreground"
            : "bg-secondary"
        )}
        {...(isRight && onUserMessageTap ? longPressHandlers : {})}
      >
        {!isRight && content.speakerName && (
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {content.speakerName}
          </p>
        )}
        <div className="break-words whitespace-pre-wrap">
          {formatMessageText(content.text || "")}
        </div>
      </div>
    </div>
  )
})
