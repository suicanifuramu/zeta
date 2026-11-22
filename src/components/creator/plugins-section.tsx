import { useEffect, useState, type ComponentType } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import {
  getDiceThemes,
  getPhoneWallpaperPresets,
  getPlotPlugins,
  putPlotPlugin,
} from "@/lib/api"
import { countChars, withPluginEntry } from "@/lib/plot-draft"
import {
  BGM_MAX_TRACKS,
  BGM_USAGE_MAX,
  DEDICATED_PLUGIN_IDS,
  HUD_CAPACITY,
  HUD_FULL_MESSAGE,
  HUD_SLOTS,
  NO_CONFIG_PLUGIN_IDS,
  asObj,
  hudSlotsUsed,
  pluginDefaultValue,
  validateBgmTracks,
} from "@/lib/plugin-rules"
import type {
  DiceTheme,
  DraftPluginEntry,
  PlotPluginState,
  WallpaperPreset,
} from "@/lib/types"
import { errorMessage } from "@/lib/creator-util"
import { usePlotEditor } from "@/components/creator/plot-editor-context"
import {
  Counter,
  FieldMessage,
  IssueMessage,
  SectionHeading,
  ToggleRow,
} from "@/components/creator/creator-ui"
import {
  AnonymousBoardEditor,
  ClockEditor,
  DiceEditor,
  LiveChatEditor,
  MessageEditor,
  PhonePeekEditor,
  QuestEditor,
  RankChartEditor,
  RelationshipEditor,
  SuddenEventEditor,
  type EditorContext,
  type EditorProps,
  type Obj,
} from "@/components/creator/plugin-editors"

const EDITORS: Record<string, ComponentType<EditorProps>> = {
  dice: DiceEditor,
  message: MessageEditor,
  "rank-chart": RankChartEditor,
  "live-chat": LiveChatEditor,
  clock: ClockEditor,
  quest: QuestEditor,
  "anonymous-board": AnonymousBoardEditor,
  "phone-peek": PhonePeekEditor,
  sudden_event: SuddenEventEditor,
  "relationship-chart": RelationshipEditor,
}

const DESCRIPTIONS: Record<string, string> = {
  bgm: "このプロットのサウンドトラックと、曲ごとの再生条件を設定します。",
  "phone-peek":
    "選択したキャラクターのプロフィール画像を参考に生成します。トークプロフィールを含めて最大10人まで選べます。",
}

/** Plugins whose settings are made in the app (publishing them from here is not supported). */
const APP_ONLY_IDS: readonly string[] = ["event-cut"]

const MODEL_NOTICE = "プラグインは現在、「koji」、「luca」モデル限定でご利用いただけます。"

interface PluginRow {
  pluginId: string
  displayName: string
  paid: boolean
  enabled: boolean
  entry: DraftPluginEntry | undefined
}

interface LibraryItem {
  assetId: string
  title: string
  available: boolean
}

interface BgmTrack {
  assetId: string
  usageInstruction: string
  isStarting: boolean
}

/** Whether a draft entry counts as enabled. bgm is on only when its stored value says so. */
function isOn(pluginId: string, entry: DraftPluginEntry | undefined): boolean {
  if (!entry) return false
  if (pluginId === "bgm") return asObj(entry.value).enabled === true
  if (DEDICATED_PLUGIN_IDS.includes(pluginId)) return asObj(entry.value).enabled !== false
  return true
}

function readLibrary(state: PlotPluginState | undefined): LibraryItem[] {
  const raw = asObj(state?.draftValue).library
  if (!Array.isArray(raw)) return []
  return raw
    .map(asObj)
    .filter((item) => typeof item.assetId === "string")
    .map((item) => {
      const assetId = item.assetId as string
      return {
        assetId,
        title: typeof item.title === "string" && item.title ? item.title : assetId,
        available: item.available !== false,
      }
    })
}

function readTracks(value: Obj): BgmTrack[] {
  const raw = Array.isArray(value.tracks) ? value.tracks : []
  return raw
    .map(asObj)
    .filter((t) => typeof t.assetId === "string")
    .map((t) => ({
      assetId: t.assetId as string,
      usageInstruction: typeof t.usageInstruction === "string" ? t.usageInstruction : "",
      isStarting: t.isStarting === true,
    }))
}

export function PluginsSection() {
  const { plotId, ctrl, messageFor } = usePlotEditor()
  const entries = ctrl.draft.plugins ?? []
  const [states, setStates] = useState<PlotPluginState[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [diceThemes, setDiceThemes] = useState<DiceTheme[]>([])
  const [wallpapers, setWallpapers] = useState<WallpaperPreset[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  /** bgm track picker is open while bgm is off: turning it on only opens the picker (LIVE B1). */
  const [bgmPicking, setBgmPicking] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([
      getPlotPlugins(plotId),
      getDiceThemes(),
      getPhoneWallpaperPresets(),
    ]).then(([plugins, themes, presets]) => {
      if (cancelled) return
      if (plugins.status === "fulfilled") setStates(plugins.value)
      else setLoadError(errorMessage(plugins.reason))
      if (themes.status === "fulfilled") setDiceThemes(themes.value)
      if (presets.status === "fulfilled") setWallpapers(presets.value)
    })
    return () => {
      cancelled = true
    }
  }, [plotId])

  const hudUsed = hudSlotsUsed(entries)
  const byId = new Map((states ?? []).map((s) => [s.pluginId, s]))
  const entryById = new Map(entries.map((e) => [e.pluginId, e]))
  const bgmEntry = entryById.get("bgm")
  const bgmOn = isOn("bgm", bgmEntry)

  // Catalog order from the server, then any draft entry the server did not list (kept as is).
  const rows: PluginRow[] = [
    ...(states ?? []).map((s) => ({
      pluginId: s.pluginId,
      displayName: s.displayName || s.pluginId,
      paid: s.paid,
      enabled: isOn(s.pluginId, entryById.get(s.pluginId)),
      entry: entryById.get(s.pluginId),
    })),
    ...entries
      .filter((e) => !byId.has(e.pluginId))
      .map((e) => ({
        pluginId: e.pluginId,
        displayName: e.pluginId,
        paid: false,
        enabled: isOn(e.pluginId, e),
        entry: e,
      })),
  ]

  const ctx = (pluginId: string): EditorContext => ({
    idPrefix: `pl-${pluginId}`,
    characters: ctrl.draft.characters.map((c) => ({ id: c.id ?? "", name: c.name ?? "" })),
    chatProfiles: ctrl.draft.chatProfiles.map((cp) => ({ id: cp.id, name: cp.name ?? "" })),
    limits: ctrl.limits,
    diceThemes,
    wallpapers,
  })

  function removePlugin(pluginId: string) {
    ctrl.edit("plugins", (d) => ({
      ...d,
      plugins: withPluginEntry(d.plugins ?? [], pluginId, undefined),
    }))
  }

  function setPluginValue(pluginId: string, next: Obj) {
    ctrl.edit("plugins", (d) => ({
      ...d,
      plugins: (d.plugins ?? []).map((e) =>
        e.pluginId === pluginId ? { ...e, value: next } : e
      ),
    }))
  }

  /**
   * bgm is saved only with PUT (LIVE C2; a PATCH entry is dropped by the server, LIVE B1).
   * The local entry is replaced by the value the server returns, so a later plugins PATCH
   * sends what the server actually holds. A failed PUT changes nothing locally.
   */
  async function putBgm(next: { enabled: boolean; tracks: BgmTrack[] }) {
    setBusy("bgm")
    setNotice(null)
    try {
      // Pending autosave is sent first. If another section is blocked, the BGM PUT still goes
      // ahead: it does not depend on that section.
      await ctrl.flush().catch(() => undefined)
      const stored = await putPlotPlugin(plotId, "bgm", next)
      const mirror = stored.value ?? next
      ctrl.setLocal((d) => ({
        ...d,
        plugins: withPluginEntry(d.plugins ?? [], "bgm", mirror),
      }))
      setBgmPicking(false)
      toast.success(next.enabled ? "BGM設定を保存しました" : "BGMをオフにしました")
    } catch (e: unknown) {
      setNotice(`BGMを保存できませんでした: ${errorMessage(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function setEnabled(pluginId: string, on: boolean) {
    setNotice(null)
    if (pluginId === "bgm") {
      if (on) {
        setBgmPicking(true)
      } else if (bgmOn) {
        await putBgm({ enabled: false, tracks: [] })
      } else {
        setBgmPicking(false)
      }
      return
    }
    if (!on) {
      removePlugin(pluginId)
      return
    }
    if (APP_ONLY_IDS.includes(pluginId)) {
      setNotice("このプラグインはアプリで設定してください。")
      return
    }
    const slots = HUD_SLOTS[pluginId] ?? 0
    if (slots > 0 && hudUsed + slots > HUD_CAPACITY) {
      setNotice(HUD_FULL_MESSAGE)
      return
    }
    ctrl.edit("plugins", (d) => ({
      ...d,
      plugins: withPluginEntry(d.plugins ?? [], pluginId, pluginDefaultValue(pluginId) ?? {}),
    }))
  }

  const bgmState = byId.get("bgm")
  const bgmOpen = bgmPicking || bgmOn

  return (
    <section
      id="plugins"
      tabIndex={-1}
      aria-labelledby="plugins-heading"
      className="space-y-4 focus-visible:outline-none"
    >
      <SectionHeading
        id="plugins-heading"
        title="プラグイン"
        description="ストーリーに追加の演出や仕組みを足します。オフにすると設定は削除されます。"
        aside={<Counter value={hudUsed} max={HUD_CAPACITY} />}
      />
      <FieldMessage tone="hint">{MODEL_NOTICE}</FieldMessage>

      {loadError && (
        <FieldMessage>{`プラグインの一覧を読み込めませんでした（${loadError}）`}</FieldMessage>
      )}
      {states === null && !loadError && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" /> 読み込み中…
        </p>
      )}
      {notice && <FieldMessage>{notice}</FieldMessage>}
      <IssueMessage id="plugins-hud-msg" message={messageFor("plugins-hud")} />
      <IssueMessage id="plugins-msg" message={messageFor("plugins")} />

      <ul className="space-y-3" role="list">
        {rows.map((row) => {
          const Editor = EDITORS[row.pluginId]
          const isAppOnly = APP_ONLY_IDS.includes(row.pluginId)
          const isBgm = row.pluginId === "bgm"
          const isDedicated = DEDICATED_PLUGIN_IDS.includes(row.pluginId)
          const description =
            DESCRIPTIONS[row.pluginId] ?? (isAppOnly ? "アプリで設定してください。" : undefined)
          const pluginMessage = messageFor(`plugin-${row.pluginId}`)
          const value = asObj(row.entry?.value)
          const checked = isBgm ? bgmOpen : row.enabled
          return (
            <li
              key={row.pluginId}
              id={`plugin-${row.pluginId}`}
              tabIndex={-1}
              aria-describedby={row.enabled && pluginMessage ? `plugin-msg-${row.pluginId}` : undefined}
              className="space-y-3 rounded-xl border border-border bg-card p-4 focus-visible:outline-none"
            >
              <ToggleRow
                id={`plugin-toggle-${row.pluginId}`}
                label={`${row.displayName}${row.paid ? "（有料）" : ""}`}
                description={description}
                checked={checked}
                disabled={!ctrl.editable || busy !== null || (!checked && isAppOnly)}
                onChange={(on) => void setEnabled(row.pluginId, on)}
              />

              <IssueMessage id={`plugin-msg-${row.pluginId}`} message={row.enabled ? pluginMessage : null} />

              {isBgm && bgmOpen && (
                <BgmEditor
                  // Remounted when the saved tracks change, so unsaved picks never outlive a save.
                  key={bgmOn ? `on-${JSON.stringify(readTracks(value))}` : "picking"}
                  picking={!bgmOn}
                  value={value}
                  library={readLibrary(bgmState)}
                  saving={busy === "bgm"}
                  disabled={!ctrl.editable || busy !== null}
                  onSave={(tracks) => void putBgm({ enabled: true, tracks })}
                  onCancel={() => setBgmPicking(false)}
                />
              )}

              {row.enabled && !isBgm && !isDedicated && Editor && (
                <div className="border-t border-border pt-3">
                  <Editor
                    value={value}
                    onChange={(next) => setPluginValue(row.pluginId, next)}
                    ctx={ctx(row.pluginId)}
                  />
                </div>
              )}

              {row.enabled && !isBgm && !Editor && !isDedicated && (
                <FieldMessage tone="hint">
                  {NO_CONFIG_PLUGIN_IDS.includes(row.pluginId)
                    ? "このプラグインに追加の設定はありません。"
                    : "この画面では詳細を設定できません。現在の設定は保持されます。"}
                </FieldMessage>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * BGM track picker and editor. `picking` = bgm is off and the user is choosing the first
 * tracks (nothing is saved until Save with 1..12 tracks). Otherwise it edits the saved tracks.
 */
function BgmEditor({
  picking,
  value,
  library,
  saving,
  disabled,
  onSave,
  onCancel,
}: {
  picking: boolean
  value: Obj
  library: LibraryItem[]
  saving: boolean
  disabled: boolean
  onSave: (tracks: BgmTrack[]) => void
  onCancel: () => void
}) {
  const saved = picking ? [] : readTracks(value)
  const savedKey = JSON.stringify(saved)
  const [tracks, setTracks] = useState<BgmTrack[]>(saved)

  const dirty = JSON.stringify(tracks) !== savedKey
  const titleOf = (assetId: string) =>
    library.find((item) => item.assetId === assetId)?.title ?? assetId
  const hasIntro = tracks.some((t) => t.isStarting)
  const selectedIds = new Set(tracks.map((t) => t.assetId))
  const tooManyChars = tracks.some((t) => countChars(t.usageInstruction) > BGM_USAGE_MAX)
  const saveError = validateBgmTracks(tracks, false)

  function toggleTrack(assetId: string, on: boolean) {
    if (on) {
      if (tracks.length >= BGM_MAX_TRACKS) return
      setTracks([...tracks, { assetId, usageInstruction: "", isStarting: tracks.length === 0 }])
      return
    }
    const remaining = tracks.filter((t) => t.assetId !== assetId)
    // Keep exactly one intro track while any track remains.
    if (remaining.length > 0 && !remaining.some((t) => t.isStarting)) {
      remaining[0] = { ...remaining[0], isStarting: true }
    }
    setTracks(remaining)
  }

  return (
    <div className="space-y-4 border-t border-border pt-3">
      <h4 className="text-sm font-semibold">
        サウンドトラック（{tracks.length}/{BGM_MAX_TRACKS}曲）
      </h4>
      {library.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          ライブラリに曲がありません。曲の追加や生成はアプリで行ってください。
        </p>
      ) : (
        <fieldset className="space-y-1">
          <legend className="mb-1 text-sm font-medium">ライブラリから選ぶ</legend>
          <div
            className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2"
            tabIndex={0}
            role="group"
            aria-label="ライブラリの曲"
          >
            {library.map((item) => {
              const checked = selectedIds.has(item.assetId)
              return (
                <label
                  key={item.assetId}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm disabled:cursor-not-allowed"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={
                      disabled ||
                      !item.available ||
                      (!checked && tracks.length >= BGM_MAX_TRACKS)
                    }
                    onChange={(e) => toggleTrack(item.assetId, e.target.checked)}
                    className="size-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <span className="min-w-0 truncate">{item.title}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}

      {tracks.length > 0 && (
        <ul className="space-y-3" role="list" aria-label="選んだ曲">
          {tracks.map((track, index) => (
            <li key={track.assetId} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">
                  {index + 1}. {titleOf(track.assetId)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 shrink-0 cursor-pointer text-destructive hover:text-destructive"
                  disabled={disabled}
                  aria-label={`${titleOf(track.assetId)} を外す`}
                  onClick={() => toggleTrack(track.assetId, false)}
                >
                  外す
                </Button>
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="bgm-intro"
                  checked={track.isStarting}
                  disabled={disabled}
                  onChange={() =>
                    setTracks(tracks.map((t) => ({ ...t, isStarting: t.assetId === track.assetId })))
                  }
                  className="size-4 accent-primary"
                />
                イントロ曲にする
              </label>
              <div className="space-y-1.5">
                <div className="flex items-end justify-between gap-2">
                  <label htmlFor={`bgm-usage-${index}`} className="text-sm font-medium">
                    再生指示
                  </label>
                  <Counter value={countChars(track.usageInstruction)} max={BGM_USAGE_MAX} />
                </div>
                <Textarea
                  id={`bgm-usage-${index}`}
                  value={track.usageInstruction}
                  rows={2}
                  disabled={disabled}
                  placeholder="例) 明るい日常会話や軽い場面転換で再生…"
                  onChange={(e) =>
                    setTracks(
                      tracks.map((t) =>
                        t.assetId === track.assetId ? { ...t, usageInstruction: e.target.value } : t
                      )
                    )
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {saveError && <FieldMessage>{saveError}</FieldMessage>}
      {!saveError && tracks.length > 0 && !hasIntro && (
        <FieldMessage tone="hint">イントロBGMを1曲選んでください（公開に必要です）。</FieldMessage>
      )}
      {tooManyChars && (
        <FieldMessage>{`再生指示は${BGM_USAGE_MAX}文字以内で入力してください`}</FieldMessage>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!picking && dirty && <FieldMessage tone="hint">未保存のBGM設定があります</FieldMessage>}
        {picking && (
          <Button type="button" variant="outline" className="min-h-11 cursor-pointer" disabled={saving} onClick={onCancel}>
            キャンセル
          </Button>
        )}
        <Button
          type="button"
          className="min-h-11 cursor-pointer"
          disabled={
            (!picking && !dirty) || saving || disabled || saveError !== null || tooManyChars
          }
          onClick={() => onSave(tracks)}
        >
          {saving && <Spinner className="size-4" />}
          {saving ? "保存しています…" : picking ? "BGMをオンにして保存" : "BGM設定を保存"}
        </Button>
      </div>
    </div>
  )
}
