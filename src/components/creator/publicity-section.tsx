import { useEffect, useState, type KeyboardEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  getCommentWindowStatus,
  searchHashtagSuggestions,
  setCommentWindowStatus,
  testKeywords,
} from "@/lib/api"
import { countChars } from "@/lib/plot-draft"
import { LIMIT_TEXT } from "@/lib/plot-limits"
import { usePlotEditor } from "@/components/creator/plot-editor-context"
import {
  Counter,
  FieldMessage,
  IssueMessage,
  SectionHeading,
  ToggleRow,
} from "@/components/creator/creator-ui"
import { useKeywordCheck } from "@/hooks/use-keyword-check"
import { KEYWORD_WARNING_TEXT, errorMessage } from "@/lib/creator-util"
import { LorebookSheet } from "@/components/creator/lorebook-sheet"
import { X } from "lucide-react"

export function PublicitySection() {
  const { ctrl, messageFor, plotId } = usePlotEditor()
  const d = ctrl.draft
  const limits = ctrl.limits
  const [lorebookOpen, setLorebookOpen] = useState(false)
  const aboutText = (d.about?.contents ?? []).map((b) => b.content ?? "").join("")
  const aboutCheck = useKeywordCheck()
  const commentCheck = useKeywordCheck()
  const shortCheck = useKeywordCheck()

  return (
    <div className="space-y-8">
      <section aria-labelledby="pub-short" className="space-y-3">
        <SectionHeading
          id="pub-short"
          title="簡単な説明文"
          description="カードや検索結果で、タイトルと一緒に表示されます。"
          aside={
            <Counter
              value={countChars(d.shortDescription)}
              max={limits.shortDescription}
            />
          }
        />
        <Input
          id="pub-short-input"
          aria-label="簡単な説明文"
          value={d.shortDescription ?? ""}
          onChange={(e) => {
            const v = e.target.value
            ctrl.edit("publicity", (x) => ({
              ...x,
              shortDescription: v.length > 0 ? v : null,
            }))
          }}
          onBlur={() =>
            void shortCheck.check("ABUSING_PLOT_PROMPT", d.shortDescription)
          }
          placeholder="題名と一緒に公開される紹介文を入力…"
          autoComplete="off"
          aria-invalid={messageFor("pub-short-input") ? true : undefined}
          aria-describedby="pub-short-msg"
        />
        <div id="pub-short-msg" className="space-y-1">
          {messageFor("pub-short-input") && (
            <FieldMessage>{messageFor("pub-short-input")}</FieldMessage>
          )}
          {shortCheck.warning && (
            <FieldMessage tone="warning">{shortCheck.warning}</FieldMessage>
          )}
        </div>
      </section>

      <section aria-labelledby="pub-tags" className="space-y-3">
        <SectionHeading
          id="pub-tags"
          title="ハッシュタグ"
          description="検索されやすい言葉を追加してください。"
          aside={<Counter value={d.hashtags.length} max={limits.hashtags} />}
        />
        <HashtagField />
      </section>

      <section aria-labelledby="pub-about" className="space-y-3">
        <SectionHeading
          id="pub-about"
          title="紹介文"
          description="プロンプトの代わりに、紹介文を公開することが可能です。"
          aside={
            <Counter value={countChars(aboutText)} max={limits.about} />
          }
        />
        <div className="space-y-1.5">
          <label htmlFor="pub-about-input" className="sr-only">
            紹介文
          </label>
          <Textarea
            id="pub-about-input"
            value={aboutText}
            rows={5}
            onChange={(e) => {
              const v = e.target.value
              ctrl.edit("publicity", (x) => {
                const base = x.about ?? { contents: [], characters: [] }
                const contents = [...(base.contents ?? [])]
                if (contents.length === 0)
                  contents.push({ type: "text", content: v })
                else contents[0] = { ...contents[0], content: v }
                return {
                  ...x,
                  about: {
                    ...base,
                    contents,
                    characters: base.characters ?? [],
                  },
                }
              })
            }}
            onBlur={() =>
              void aboutCheck.check("ABUSING_PLOT_PROMPT", aboutText)
            }
            aria-invalid={messageFor("pub-about-input") ? true : undefined}
            aria-describedby="pub-about-msg"
          />
          <div id="pub-about-msg" className="space-y-1">
            {messageFor("pub-about-input") && (
              <FieldMessage>{messageFor("pub-about-input")}</FieldMessage>
            )}
            {aboutCheck.warning && (
              <FieldMessage tone="warning">{aboutCheck.warning}</FieldMessage>
            )}
          </div>
        </div>
        <ToggleRow
          id="pub-about-public"
          label="紹介文を公開する"
          checked={d.isAboutPublic === true}
          disabled={!ctrl.editable}
          onChange={(checked) =>
            ctrl.edit("publicity", (x) => ({ ...x, isAboutPublic: checked }))
          }
        />
      </section>

      <section aria-labelledby="pub-comment" className="space-y-3">
        <SectionHeading
          id="pub-comment"
          title="クリエイターコメント"
          aside={
            <Counter
              value={countChars(d.creatorComment)}
              max={limits.creatorComment}
            />
          }
        />
        <Textarea
          id="pub-comment-input"
          aria-label="クリエイターコメント"
          value={d.creatorComment ?? ""}
          rows={4}
          onChange={(e) => {
            const v = e.target.value
            ctrl.edit("publicity", (x) => ({
              ...x,
              creatorComment: v.length > 0 ? v : null,
            }))
          }}
          onBlur={() =>
            void commentCheck.check("ABUSING_PLOT_PROMPT", d.creatorComment)
          }
          aria-invalid={messageFor("pub-comment-input") ? true : undefined}
          aria-describedby="pub-comment-msg"
        />
        <div id="pub-comment-msg" className="space-y-1">
          {messageFor("pub-comment-input") && (
            <FieldMessage>{messageFor("pub-comment-input")}</FieldMessage>
          )}
          {commentCheck.warning && (
            <FieldMessage tone="warning">{commentCheck.warning}</FieldMessage>
          )}
        </div>
        <ToggleRow
          id="pub-comment-public"
          label="クリエイターコメントを使用"
          checked={d.isCreatorCommentPublic === true}
          disabled={!ctrl.editable}
          onChange={(checked) =>
            ctrl.edit("publicity", (x) => ({
              ...x,
              isCreatorCommentPublic: checked,
            }))
          }
        />
      </section>

      <CommentWindowSection plotId={plotId} />

      <section aria-labelledby="pub-examples" className="space-y-2">
        <SectionHeading id="pub-examples" title="状況例の公開" />
        <ToggleRow
          id="pub-example-public"
          label="状況例を公開"
          description="状況例が他のユーザーに公開されます。"
          checked={d.isExampleConversationPublic === true}
          disabled={!ctrl.editable}
          onChange={(checked) =>
            ctrl.edit("publicity", (x) => ({
              ...x,
              isExampleConversationPublic: checked,
            }))
          }
        />
      </section>

      <section aria-labelledby="pub-lorebook" className="space-y-3">
        <SectionHeading
          id="pub-lorebook"
          title="設定集（ロアブック）"
          description={`キーワードが話題に出たとき、設定集の内容をAIに伝えます。1つのプロットに最大${limits.lorebooks}つまで連動できます。`}
          aside={
            <span className="text-xs text-muted-foreground tabular-nums">
              連動中 {d.lorebookIds.length}/{limits.lorebooks}件
            </span>
          }
        />
        <Button
          id="lb-open"
          type="button"
          variant="outline"
          className="min-h-11 cursor-pointer"
          aria-describedby={messageFor("lb-open") ? "lb-open-msg" : undefined}
          onClick={() => setLorebookOpen(true)}
        >
          設定集を連動…
        </Button>
        <IssueMessage id="lb-open-msg" message={messageFor("lb-open")} />
        <LorebookSheet open={lorebookOpen} onOpenChange={setLorebookOpen} />
      </section>
    </div>
  )
}

/**
 * Comment window on/off (GET/PATCH /v1/creator/plots/:id/comment-setting). This is not a
 * draft field: it takes effect at once and is not part of the autosave.
 */
function CommentWindowSection({ plotId }: { plotId: string }) {
  const [status, setStatus] = useState<"ON" | "OFF" | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCommentWindowStatus(plotId)
      .then((value) => {
        if (!cancelled) setStatus(value)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(errorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [plotId])

  async function change(checked: boolean) {
    const next = checked ? "ON" : "OFF"
    const previous = status
    setSaving(true)
    setStatus(next)
    try {
      setStatus(await setCommentWindowStatus(plotId, next))
    } catch (e: unknown) {
      setStatus(previous)
      toast.error(`コメント欄を変更できませんでした: ${errorMessage(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="pub-comment-window" className="space-y-2">
      <SectionHeading id="pub-comment-window" title="コメント欄" />
      {loadError && (
        <FieldMessage>{`読み込みに失敗しました（${loadError}）`}</FieldMessage>
      )}
      {!loadError && (
        <ToggleRow
          id="pub-comment-window-toggle"
          label="コメント欄を表示する"
          description="オフにすると、このプロットのコメント欄は表示されません。"
          checked={status === "ON"}
          disabled={status === null || saving}
          onChange={(checked) => void change(checked)}
        />
      )}
    </section>
  )
}

function HashtagField() {
  const { ctrl, messageFor } = usePlotEditor()
  const tags = ctrl.draft.hashtags
  const [input, setInput] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    const query = input.trim()
    if (!query) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      searchHashtagSuggestions(query)
        .then((list) => {
          if (!cancelled)
            setSuggestions(list.filter((t) => !tags.includes(t)).slice(0, 8))
        })
        .catch(() => {
          if (!cancelled) setSuggestions([])
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // `tags` is read only to filter suggestions; re-running on every change is harmless.
  }, [input, tags])

  async function addTag(raw: string) {
    const tag = raw.trim().replace(/^#/, "")
    if (!tag) return
    if (tags.includes(tag)) {
      setInput("")
      return
    }
    if (tags.length >= ctrl.limits.hashtags) {
      setWarning(LIMIT_TEXT.hashtags(ctrl.limits.hashtags))
      return
    }
    if (countChars(tag) > ctrl.limits.hashtagLength) {
      setWarning(LIMIT_TEXT.hashtagLength(ctrl.limits.hashtagLength))
      return
    }
    try {
      const flagged = await testKeywords("ABUSING_PLOT_HASHTAG", tag)
      if (flagged) {
        setWarning(KEYWORD_WARNING_TEXT)
        return
      }
    } catch {
      setWarning("キーワードの確認に失敗しました")
      return
    }
    ctrl.edit("publicity", (x) => ({ ...x, hashtags: [...x.hashtags, tag] }))
    setInput("")
    setSuggestions([])
    setWarning(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Enter confirms IME composition instead of adding the tag.
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter") {
      e.preventDefault()
      void addTag(input)
    }
  }

  const liveMessage = messageFor("pub-tag-input")
  const shownMessage = warning ?? liveMessage

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <ul
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="設定中のハッシュタグ"
        >
          {tags.map((tag) => (
            <li key={tag}>
              <span className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-muted pr-1 pl-3 text-sm">
                <span>#{tag}</span>
                <button
                  type="button"
                  aria-label={`#${tag} を削除`}
                  disabled={!ctrl.editable}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-background disabled:cursor-not-allowed"
                  onClick={() =>
                    ctrl.edit("publicity", (x) => ({
                      ...x,
                      hashtags: x.hashtags.filter((t) => t !== tag),
                    }))
                  }
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id="pub-tag-input"
          aria-label="ハッシュタグを入力"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setWarning(null)
          }}
          onKeyDown={onKeyDown}
          placeholder="例) 異世界…"
          autoComplete="off"
          aria-describedby="pub-tag-msg"
          aria-invalid={liveMessage ? true : undefined}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 cursor-pointer"
          disabled={!input.trim()}
          onClick={() => void addTag(input)}
        >
          追加
        </Button>
      </div>
      {suggestions.length > 0 && (
        <ul
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="ハッシュタグの候補"
        >
          {suggestions.map((s) => (
            <li key={s}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-9 cursor-pointer"
                onClick={() => void addTag(s)}
              >
                #{s}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div id="pub-tag-msg">
        {shownMessage && (
          <FieldMessage
            tone={shownMessage === KEYWORD_WARNING_TEXT ? "warning" : "error"}
          >
            {shownMessage}
          </FieldMessage>
        )}
      </div>
    </div>
  )
}
