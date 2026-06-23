import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import { clearAllCache } from "@/lib/cache-cleanup"
import {
  clearSession, getAuthState, getDeviceId,
  getRefreshToken, importTokens, refreshSession, setDeviceId,
} from "@/lib/auth"
import {
  checkUserChatProfileAbuse, createUserChatProfile, deleteUserChatProfile,
  getSessionOverview, getUserChatProfiles, selectUserChatProfile, updateUserChatProfile,
} from "@/lib/api"
import type { UserChatProfile, SessionOverview } from "@/lib/types"

function formatDate(ms: number) {
  if (!ms) return "-"
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "medium" }).format(new Date(ms))
}

function formatSeconds(s: number) {
  if (!s) return "-"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}分`
  return `${Math.floor(m / 60)}時間${m % 60}分`
}

export function SettingsPage() {
  const [deviceId, setDeviceIdState] = useState(getDeviceId())
  const [refreshToken, setRefreshToken] = useState(getRefreshToken())
  const [refreshing, setRefreshing] = useState(false)

  // Overview
  const [overview, setOverview] = useState<SessionOverview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(false)

  // Profiles
  const [profiles, setProfiles] = useState<UserChatProfile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [editId, setEditId] = useState("")
  const [profileName, setProfileName] = useState("")
  const [profileDesc, setProfileDesc] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)

  // Quiz
  const [quizStatus, setQuizStatus] = useState("確認中...")

  // Cache
  const [cacheCount, setCacheCount] = useState(0)
  const [cacheDeleting, setCacheDeleting] = useState(false)

  useEffect(() => {
    caches.open("plot-images").then((c) => c.keys().then((k) => setCacheCount(k.length))).catch(() => {})
  }, [])

  useEffect(() => {
    import("@/lib/quiz-client").then(async (mod) => {
      try { setQuizStatus(await mod.getQuizStatus()) } catch { setQuizStatus("取得失敗") }
    }).catch(() => setQuizStatus("モジュール読み込み失敗"))
  }, [])

  const handleRefreshSession = async () => {
    setRefreshing(true)
    try {
      setDeviceId(deviceId)
      if (refreshToken) importTokens(refreshToken)
      await refreshSession()
      setRefreshToken(getRefreshToken())
      toast.success("セッションを更新しました")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshing(false)
    }
  }

  const handleLogout = async () => {
    await clearSession()
    setRefreshToken("")
    toast.info("ローカルセッションを削除しました")
  }

  const loadOverview = async () => {
    setLoadingOverview(true)
    try { setOverview(await getSessionOverview() as SessionOverview) } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setLoadingOverview(false) }
  }

  const loadProfiles = async () => {
    setLoadingProfiles(true)
    try {
      const data = await getUserChatProfiles(50) as Record<string, UserChatProfile[]>
      const list = data.userChatProfiles || data.profiles || data || []
      setProfiles(Array.isArray(list) ? list : [])
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setLoadingProfiles(false) }
  }

  const resetForm = () => { setEditId(""); setProfileName(""); setProfileDesc("") }

  const handleSaveProfile = async () => {
    if (!profileName.trim()) { toast.error("名前を入力してください"); return }
    setProfileSaving(true)
    try {
      if (editId) {
        await updateUserChatProfile(editId, { name: profileName, description: profileDesc })
        toast.success("プロフィールを更新しました")
      } else {
        await createUserChatProfile({ name: profileName, description: profileDesc })
        toast.success("プロフィールを作成しました")
      }
      resetForm()
      await loadProfiles()
    } catch (e: unknown) { toast.error(`${editId ? "更新" : "作成"}失敗: ${e instanceof Error ? e.message : String(e)}`) }
    finally { setProfileSaving(false) }
  }

  const state = getAuthState()

  return (
    <div className="animate-fade-in">
      <header className="px-5 pt-[max(18px,env(safe-area-inset-top))] pb-3">
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-sm text-muted-foreground">セッション管理・プロフィール設定</p>
      </header>

      <div className="flex flex-col gap-4 px-5 pb-8">
        {/* Session Card */}
        <Card>
          <CardHeader>
            <CardTitle>ログイン / セッション</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Access Token", state.hasAccessToken ? "有効" : "なし"],
                ["Refresh Token", state.hasRefreshToken ? "保存済み" : "なし"],
                ["有効期限", formatDate(state.expiresAt)],
                ["残り時間", formatSeconds(state.expiresInSeconds)],
                ["User ID", state.userId || "-"],
                ["Timezone", state.timezone || "-"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 truncate text-sm font-medium tabular-nums">{value}</p>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium">Device ID</label>
              <Input value={deviceId} onChange={(e) => setDeviceIdState(e.target.value)} />
              <label className="text-sm font-medium">Refresh Token</label>
              <Textarea rows={2} value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleLogout}>ログアウト</Button>
              <Button variant="outline" size="sm" onClick={() => {
                setDeviceId(deviceId)
                if (refreshToken) importTokens(refreshToken)
                toast.success("Token を保存しました")
              }}>Token を保存</Button>
              <Button size="sm" onClick={handleRefreshSession} disabled={refreshing}>
                {refreshing && <Spinner className="mr-1 size-3" />}
                セッション更新
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Device ID / Refresh Token を入力して「Token を保存」するとローカルストレージに保存されます。
            </p>
          </CardContent>
        </Card>

        {/* Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle>アカウント概要</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOverview ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : overview ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ["コイン", overview.coin?.balance ?? "-"],
                  ["Zeta Pass", overview.subscription?.type ?? "-"],
                  ["フォロー", overview.creatorStats?.followingCount ?? "-"],
                  ["フォロワー", overview.creatorStats?.followerCount ?? "-"],
                  ["作品数", overview.creatorStats?.plotCount ?? "-"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-medium tabular-nums">{String(value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">未取得</p>
            )}
            <Button variant="outline" size="sm" className="mt-3" onClick={loadOverview} disabled={loadingOverview}>
              概要を取得
            </Button>
          </CardContent>
        </Card>

        {/* Profile Management Card */}
        <Card>
          <CardHeader>
            <CardTitle>トークプロフィール管理</CardTitle>
            <CardDescription>チャットで使用するプロフィールの作成・管理</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loadingProfiles ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : profiles.length > 0 ? (
              <div className="flex flex-col gap-2">
                {profiles.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg bg-secondary/30 p-3">
                    <Avatar className="size-10">
                      <AvatarImage src={p.profileImageUrl} />
                      <AvatarFallback>{(p.name || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{p.name || "名称なし"}</span>
                        {p.selected && <Badge variant="secondary" className="text-[10px]">選択中</Badge>}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {!p.selected && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={async () => {
                          try { await selectUserChatProfile(p.id); toast.success("選択しました"); await loadProfiles() }
                          catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
                        }}>選択</Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                        setEditId(p.id); setProfileName(p.name || ""); setProfileDesc(p.description || "")
                      }}>編集</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={async () => {
                        if (!confirm(`「${p.name}」を削除しますか?`)) return
                        try { await deleteUserChatProfile(p.id); toast.success("削除しました"); await loadProfiles() }
                        catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
                      }}>削除</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">プロフィール一覧を取得してください</p>
            )}
            <Button variant="outline" size="sm" onClick={loadProfiles} disabled={loadingProfiles}>一覧を取得</Button>

            <Separator />
            <h3 className="text-sm font-medium">{editId ? "編集" : "新規作成"}</h3>
            <div className="flex flex-col gap-3">
              <Input placeholder="名前" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
              <Textarea placeholder="説明" rows={4} value={profileDesc} onChange={(e) => setProfileDesc(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={async () => {
                  try {
                    const data = await checkUserChatProfileAbuse({ name: profileName, description: profileDesc }) as Record<string, boolean>
                    toast(data.isAbusing ? "内容チェック: NG" : "内容チェック: OK")
                  } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
                }}>内容チェック</Button>
                {editId && <Button variant="ghost" size="sm" onClick={resetForm}>キャンセル</Button>}
                <Button size="sm" onClick={handleSaveProfile} disabled={profileSaving}>
                  {profileSaving && <Spinner className="mr-1 size-3" />}
                  {editId ? "更新" : "作成"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quiz Card */}
        <Card>
          <CardHeader>
            <CardTitle>クイズ自動化</CardTitle>
            <CardDescription>デイリークイズの参加と報酬受け取りを実行</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">ステータス: {quizStatus}</p>
            <Button variant="outline" size="sm" onClick={async () => {
              setQuizStatus("実行中...")
              const mod = await import("@/lib/quiz-client")
              const result = await mod.runQuizAutomation()
              setQuizStatus(result)
              if (result.startsWith("エラー") || result.startsWith("失敗")) {
                toast.error(result)
              } else {
                toast.success(result)
              }
            }}>手動実行</Button>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card>
          <CardHeader>
            <CardTitle>アプリ情報</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Zeta Chat Client v2.0.0 — React + shadcn/ui</p>
            <p className="text-sm text-muted-foreground">API: api.zeta-ai.io</p>
          </CardContent>
        </Card>

        {/* Cache Management */}
        <Card>
          <CardHeader>
            <CardTitle>キャッシュ管理</CardTitle>
            <CardDescription>画像キャッシュのクリア</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              キャッシュされた画像: <span className="font-medium tabular-nums">{cacheCount}</span> 件
            </p>
            <Button
              variant="destructive"
              size="sm"
              disabled={cacheDeleting || cacheCount === 0}
              onClick={async () => {
                setCacheDeleting(true)
                try {
                  const { deletedCount } = await clearAllCache()
                  setCacheCount(0)
                  toast.success(`${deletedCount} 件のキャッシュを削除しました`)
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : String(e))
                } finally {
                  setCacheDeleting(false)
                }
              }}
            >
              {cacheDeleting && <Spinner className="mr-1 size-3" />}
              画像キャッシュを削除
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
