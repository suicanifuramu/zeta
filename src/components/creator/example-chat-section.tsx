import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { streamExampleChat, type ExampleChatRequestMessage } from "@/lib/api"
import { errorMessage } from "@/lib/creator-util"
import {
  countChars,
  exampleTotalChars,
  newExampleConversation,
} from "@/lib/plot-draft"
import { LIMIT_TEXT } from "@/lib/plot-limits"
import type {
  DraftExampleConversation,
  DraftExampleMessage,
  PlotDraft,
} from "@/lib/types"
import { usePlotEditor } from "@/components/creator/plot-editor-context"
import {
  ConfirmDialog,
  Counter,
  FieldMessage,
  IssueMessage,
  SectionHeading,
} from "@/components/creator/creator-ui"
import { Trash2 } from "lucide-react"

const NARRATOR_SPEAKER = "_NARRATOR_"

function toRequestMessage(
  message: DraftExampleMessage
): ExampleChatRequestMessage {
  const isUser = message.sender === "USER"
  return {
    senderType: isUser ? "USER" : "BOT",
    contents: [
      {
        type: "TEXT",
        ...(!isUser && message.senderName
          ? { speakerName: message.senderName }
          : {}),
        position: isUser ? "RIGHT" : "LEFT",
        text: message.content ?? "",
      },
    ],
    messageTime: new Date().toISOString(),
  }
}

export function ExampleChatSection() {
  const { plotId, ctrl, messageFor } = usePlotEditor()
  const d = ctrl.draft
  const total = exampleTotalChars(d)
  const [removeIndex, setRemoveIndex] = useState<number | null>(null)
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null)
  const [preview, setPreview] = useState("")
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  function updateExample(
    index: number,
    fn: (ex: DraftExampleConversation) => DraftExampleConversation
  ) {
    ctrl.edit("examples", (x) => ({
      ...x,
      exampleConversations: x.exampleConversations.map((ex, i) =>
        i === index ? fn(ex) : ex
      ),
    }))
  }

  async function generate(index: number) {
    const example = d.exampleConversations[index]
    if (!example || example.messages.length === 0) {
      toast.error("先に状況の文章を入力してください")
      return
    }
    if (total >= ctrl.limits.exampleTotal) {
      toast.error(LIMIT_TEXT.exampleTotal(ctrl.limits.exampleTotal))
      return
    }
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setGeneratingIndex(index)
    setPreview("")
    try {
      // Each reply part is stored as its own message, the way the official app does.
      const replyParts: { speakerName: string | null; text: string }[] = []
      await streamExampleChat(plotId, example.messages.map(toRequestMessage), {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.event === "IN_PROGRESS") {
            // Chunks carry the text generated so far, so each one replaces the preview.
            const text = (event.chunkMessage?.contents ?? [])
              .map((c) => c.text ?? "")
              .join("")
            setPreview(text)
          } else if (event.event === "EXAMPLE_CHAT_COMPLETE") {
            for (const part of event.replyMessage?.contents ?? []) {
              const text = (part.text ?? "").trimEnd()
              if (text.length === 0) continue
              replyParts.push({ speakerName: part.speakerName ?? null, text })
            }
          }
        },
      })
      if (replyParts.length > 0) {
        const added = replyParts.reduce((sum, p) => sum + countChars(p.text), 0)
        const flags = { lost: false, overflow: false }
        ctrl.edit("examples", (x) => {
          if (!x.exampleConversations[index]) {
            flags.lost = true
            return x
          }
          const next = x.exampleConversations.map((ex, i) =>
            i === index
              ? {
                  ...ex,
                  messages: [
                    ...ex.messages,
                    ...replyParts.map((p) => ({
                      sender: "BOT",
                      senderName: p.speakerName,
                      content: p.text,
                    })),
                  ],
                }
              : ex
          )
          // Text is never dropped here. Going over the limit only blocks saving (see the counter).
          flags.overflow =
            exampleTotalChars({
              ...x,
              exampleConversations: next,
            } as PlotDraft) > ctrl.limits.exampleTotal
          return { ...x, exampleConversations: next }
        })
        if (flags.lost) {
          toast.error(
            "生成結果を追加できませんでした。状況例が変更されています"
          )
        } else if (flags.overflow) {
          toast.warning(
            `${LIMIT_TEXT.exampleTotal(ctrl.limits.exampleTotal)}（${added}字を追加しました。保存するには文字数を減らしてください）`
          )
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        toast.error(
          `生成に失敗しました: ${errorMessage(error)}`
        )
      }
    } finally {
      setGeneratingIndex(null)
      setPreview("")
    }
  }

  const characterOptions = d.characters.filter((c) => c.id && c.name?.trim())

  return (
    <section
      id="ex-section"
      tabIndex={-1}
      aria-labelledby="example-heading"
      aria-describedby={messageFor("ex-section") ? "ex-section-msg" : undefined}
      className="space-y-4 focus-visible:outline-none"
    >
      <SectionHeading
        id="example-heading"
        title="状況例"
        description="状況の文章を書いて「続きを生成」を押すと、AIが例文の続きを作ります。"
        aside={<Counter value={total} max={ctrl.limits.exampleTotal} />}
      />
      {total > ctrl.limits.exampleTotal && (
        <FieldMessage id="ex-total">
          {LIMIT_TEXT.exampleTotal(ctrl.limits.exampleTotal)}
        </FieldMessage>
      )}
      <IssueMessage id="ex-section-msg" message={messageFor("ex-section")} />

      {d.exampleConversations.length === 0 && (
        <p className="text-sm text-muted-foreground">
          状況例はまだありません。
        </p>
      )}

      {d.exampleConversations.map((example, index) => (
        <div
          key={index}
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">状況例 {index + 1}</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 cursor-pointer text-destructive hover:text-destructive"
              onClick={() => setRemoveIndex(index)}
            >
              <Trash2 aria-hidden="true" />
              削除…
            </Button>
          </div>

          <ol className="space-y-2" aria-label={`状況例 ${index + 1} の会話`}>
            {example.messages.map((message, mi) => (
              <li
                key={mi}
                className="space-y-1.5 rounded-lg border border-border p-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor={`ex-${index}-${mi}-speaker`}
                    className="sr-only"
                  >
                    話者
                  </label>
                  <select
                    id={`ex-${index}-${mi}-speaker`}
                    value={speakerValue(message, d)}
                    onChange={(e) => {
                      const v = e.target.value
                      updateExample(index, (ex) => ({
                        ...ex,
                        messages: ex.messages.map((m, j) =>
                          j === mi ? applySpeaker(m, v, d) : m
                        ),
                      }))
                    }}
                    className="h-11 max-w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground"
                  >
                    <option value="narrator">ナレーター</option>
                    <option value="user">ユーザー</option>
                    {characterOptions.map((c) => (
                      <option key={c.id} value={`char:${c.id}`}>
                        {c.name}
                      </option>
                    ))}
                    {currentSpeakerMissing(message, d) && (
                      <option value={speakerValue(message, d)}>
                        {message.senderName}
                      </option>
                    )}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-11 cursor-pointer text-destructive hover:text-destructive"
                    aria-label={`状況例 ${index + 1} の ${mi + 1} 件目を削除`}
                    onClick={() =>
                      updateExample(index, (ex) => ({
                        ...ex,
                        messages: ex.messages.filter((_, j) => j !== mi),
                      }))
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                <label htmlFor={`ex-${index}-${mi}-text`} className="sr-only">
                  発言 {mi + 1}
                </label>
                <Textarea
                  id={`ex-${index}-${mi}-text`}
                  value={message.content ?? ""}
                  rows={2}
                  onChange={(e) => {
                    const v = e.target.value
                    updateExample(index, (ex) => ({
                      ...ex,
                      messages: ex.messages.map((m, j) =>
                        j === mi ? { ...m, content: v } : m
                      ),
                    }))
                  }}
                />
              </li>
            ))}
          </ol>

          {generatingIndex === index && (
            <div
              aria-live="polite"
              className="space-y-1 rounded-lg bg-muted p-3"
            >
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="size-3.5" /> 生成中…
              </p>
              {preview && (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {preview}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 cursor-pointer"
              onClick={() =>
                updateExample(index, (ex) => ({
                  ...ex,
                  messages: [
                    ...ex.messages,
                    { content: "", sender: "USER", senderName: null },
                  ],
                }))
              }
            >
              発言を追加
            </Button>
            <Button
              type="button"
              className="min-h-11 cursor-pointer"
              disabled={generatingIndex !== null}
              onClick={() => void generate(index)}
            >
              続きを生成
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="min-h-11 cursor-pointer"
        onClick={() =>
          ctrl.edit("examples", (x) => ({
            ...x,
            exampleConversations: [
              ...x.exampleConversations,
              newExampleConversation(),
            ],
          }))
        }
      >
        状況例を追加
      </Button>

      <ConfirmDialog
        open={removeIndex !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveIndex(null)
        }}
        title="状況例を削除しますか？"
        confirmLabel="削除する"
        onConfirm={() => {
          if (removeIndex !== null) {
            const target = removeIndex
            ctrl.edit("examples", (x) => ({
              ...x,
              exampleConversations: x.exampleConversations.filter(
                (_, i) => i !== target
              ),
            }))
          }
          setRemoveIndex(null)
        }}
      />
    </section>
  )
}

/** Select value for a message: "user", "narrator", "char:<id>" or a preserved unknown name. */
function speakerValue(message: DraftExampleMessage, d: PlotDraft): string {
  if (message.sender === "USER") return "user"
  if (message.senderName === NARRATOR_SPEAKER || !message.senderName)
    return "narrator"
  const character = d.characters.find(
    (c) => c.id && c.name === message.senderName
  )
  return character?.id ? `char:${character.id}` : `name:${message.senderName}`
}

function currentSpeakerMissing(
  message: DraftExampleMessage,
  d: PlotDraft
): boolean {
  if (
    message.sender === "USER" ||
    !message.senderName ||
    message.senderName === NARRATOR_SPEAKER
  )
    return false
  return !d.characters.some((c) => c.name === message.senderName)
}

/** Stores the speaker the way the official app does: narrator = "_NARRATOR_", characters by name. */
function applySpeaker(
  message: DraftExampleMessage,
  value: string,
  d: PlotDraft
): DraftExampleMessage {
  if (value === "user") return { ...message, sender: "USER", senderName: null }
  if (value === "narrator")
    return { ...message, sender: "BOT", senderName: NARRATOR_SPEAKER }
  if (value.startsWith("char:")) {
    const id = value.slice("char:".length)
    const character = d.characters.find((c) => c.id === id)
    return { ...message, sender: "BOT", senderName: character?.name ?? null }
  }
  return message
}
