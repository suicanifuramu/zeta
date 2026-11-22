import { useRef, useState } from "react"
import { Camera } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ImageCropDialog } from "@/components/image-crop-dialog"
import { getAccessToken } from "@/lib/auth"
import { APP_VERSION } from "@/lib/headers"
import { useSettingsSession } from "@/hooks/use-settings-session"
import { useSettingsAccounts } from "@/hooks/use-settings-accounts"
import { useSettingsOverview } from "@/hooks/use-settings-overview"
import { useSettingsProfiles } from "@/hooks/use-settings-profiles"
import { useSettingsQuiz } from "@/hooks/use-settings-quiz"
import { useSettingsCache } from "@/hooks/use-settings-cache"
import { MessageExportDialog } from "@/components/message-export-dialog"

function formatDate(ms: number) {
  if (!ms) return "-"
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(ms))
}

function formatSeconds(s: number) {
  if (!s) return "-"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}分`
  return `${Math.floor(m / 60)}時間${m % 60}分`
}

export function SettingsPage() {
  const {
    deviceId,
    setDeviceIdState,
    refreshToken,
    setRefreshToken,
    refreshing,
    handleRefreshSession,
    handleLogout,
    authState,
  } = useSettingsSession()

  const {
    accounts,
    activeAccountId,
    switchingId,
    switchAccount,
    deleteAccount,
  } = useSettingsAccounts()

  const { overview, loadingOverview, loadOverview } = useSettingsOverview()

  const {
    profiles,
    loadingProfiles,
    loadProfiles,
    editId,
    profileName,
    setProfileName,
    profileDesc,
    setProfileDesc,
    profileImageUrl,
    setProfileImageUrl,
    profileSaving,
    handleSaveProfile,
    handleSetDefault,
    handleDelete,
    handleEdit,
    resetForm,
  } = useSettingsProfiles()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    const valid = await new Promise<boolean>((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img.width >= 224 && img.height >= 224)
      img.onerror = () => resolve(false)
      img.src = objectUrl
    }).finally(() => URL.revokeObjectURL(objectUrl))
    // Reset on both paths so re-selecting the same file fires onChange again.
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (!valid) {
      toast.error("画像は224px以上である必要があります")
      return
    }
    setCropFile(file)
    setCropOpen(true)
  }

  const handleCropComplete = (imageUrl: string) => {
    setProfileImageUrl(imageUrl)
    setCropOpen(false)
    setCropFile(null)
  }

  const { quizStatus, runQuiz } = useSettingsQuiz()
  const { cacheCount, memoryCount, cacheDeleting, clearCache } =
    useSettingsCache()
  const [exportOpen, setExportOpen] = useState(false)

  const handleCopyAccessToken = async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("アクセストークンがありません")
      return
    }
    await navigator.clipboard.writeText(token)
    toast.success("アクセストークンをコピーしました")
  }

  const handleRunQuiz = async () => {
    const result = await runQuiz()
    if (result.startsWith("エラー") || result.startsWith("失敗")) {
      toast.error(result)
    } else {
      toast.success(result)
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="px-5 pt-[max(18px,env(safe-area-inset-top))] pb-3">
        <h1 className="text-2xl font-bold">設定</h1>
      </header>

      <div className="flex flex-col gap-4 px-5 pb-8">
        {/* Accounts Card */}
        <Card>
          <CardHeader>
            <CardTitle>アカウント切替</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ログイン中のアカウントはこの画面を開くと自動で保存されます。
              </p>
            ) : (
              accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-lg bg-secondary/30 p-3"
                >
                  <Avatar className="size-10">
                    <AvatarImage src={account.imageUrl || undefined} />
                    <AvatarFallback>{account.label?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {account.label}
                      </span>
                      {account.id === activeAccountId && (
                        <Badge variant="secondary" className="text-[10px]">
                          使用中
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      User ID: {account.userId || "-"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {account.id !== activeAccountId && (
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={switchingId !== null || refreshing}
                        onClick={() => switchAccount(account)}
                      >
                        {switchingId === account.id && (
                          <Spinner className="mr-1 size-3" />
                        )}
                        切替
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive"
                          disabled={switchingId !== null || refreshing}
                        >
                          削除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            「{account.label}」を削除しますか？
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {account.id === activeAccountId
                              ? "このアカウントは使用中です。削除するとログアウトします。"
                              : "この端末に保存された認証情報を削除します。"}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteAccount(account)}
                          >
                            削除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Session Card */}
        <Card>
          <CardHeader>
            <CardTitle>ログイン / セッション</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Access Token", authState.hasAccessToken ? "有効" : "なし"],
                ["Refresh Token", authState.hasRefreshToken ? "保存済み" : "なし"],
                ["有効期限", formatDate(authState.expiresAt)],
                ["残り時間", formatSeconds(authState.expiresInSeconds)],
                ["User ID", authState.userId || "-"],
                ["Timezone", authState.timezone || "-"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  role="button"
                  tabIndex={label === "Access Token" ? 0 : undefined}
                  aria-label={
                    label === "Access Token" ? "アクセストークンをコピー" : undefined
                  }
                  onClick={
                    label === "Access Token" ? handleCopyAccessToken : undefined
                  }
                  onKeyDown={
                    label === "Access Token"
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            handleCopyAccessToken()
                          }
                        }
                      : undefined
                  }
                  className={
                    label === "Access Token"
                      ? "cursor-pointer rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary"
                      : "rounded-lg bg-secondary/50 p-3"
                  }
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 truncate text-sm font-medium tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium">Device ID</label>
              <Input
                value={deviceId}
                onChange={(e) => setDeviceIdState(e.target.value)}
              />
              <label className="text-sm font-medium">Refresh Token</label>
              <Textarea
                rows={2}
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={switchingId !== null || refreshing}
                  >
                    ログアウト
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ログアウトしますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      このアカウントの保存済み認証情報を削除してログアウトします。他の保存済みアカウントは残ります。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout}>
                      ログアウト
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                size="sm"
                onClick={handleRefreshSession}
                disabled={refreshing || switchingId !== null}
              >
                {refreshing && <Spinner className="mr-1 size-3" />}
                セッション更新
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle>アカウント概要</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOverview ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
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
                    <p className="mt-1 text-sm font-medium tabular-nums">
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">未取得</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={loadOverview}
              disabled={loadingOverview}
            >
              概要を取得
            </Button>
          </CardContent>
        </Card>

        {/* Profile Management Card */}
        <Card>
          <CardHeader>
            <CardTitle>トークプロフィール管理</CardTitle>
            <CardDescription>
              チャットで使用するプロフィールの作成・管理
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loadingProfiles ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : profiles.length > 0 ? (
              <div className="flex flex-col gap-2">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg bg-secondary/30 p-3"
                  >
                    <Avatar className="size-10">
                      <AvatarImage src={p.profileImageUrl} />
                      <AvatarFallback>{(p.name || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {p.name || "名称なし"}
                        </span>
                        {p.selected && (
                          <Badge variant="secondary" className="text-[10px]">
                            選択中
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {!p.selected && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleSetDefault(p.id)}
                        >
                          選択
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleEdit(p)}
                      >
                        編集
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        onClick={() => handleDelete(p.id, p.name || "")}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                プロフィール一覧を取得してください
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={loadProfiles}
              disabled={loadingProfiles}
            >
              一覧を取得
            </Button>

            <Separator />
            <h3 className="text-sm font-medium">
              {editId ? "編集" : "新規作成"}
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="group relative cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={profileSaving}
                >
                  <Avatar className="size-16">
                    <AvatarImage src={profileImageUrl || undefined} />
                    <AvatarFallback className="text-xl">
                      {profileName ? profileName[0] : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="size-5 text-white" />
                  </div>
                </button>
                <p className="text-xs text-muted-foreground">
                  画像をタップして変更
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              <Input
                placeholder="名前"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
              <Textarea
                placeholder="説明"
                rows={4}
                value={profileDesc}
                onChange={(e) => setProfileDesc(e.target.value)}
              />
              <div className="flex gap-2">
                {editId && (
                  <Button variant="ghost" size="sm" onClick={resetForm}>
                    キャンセル
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                >
                  {profileSaving && <Spinner className="mr-1 size-3" />}
                  {editId ? "更新" : "作成"}
                </Button>
              </div>
            </div>

            {cropFile && (
              <ImageCropDialog
                open={cropOpen}
                onOpenChange={(v) => {
                  setCropOpen(v)
                  if (!v) setCropFile(null)
                }}
                file={cropFile}
                onCropComplete={handleCropComplete}
              />
            )}
          </CardContent>
        </Card>

        {/* Quiz Card */}
        <Card>
          <CardHeader>
            <CardTitle>クイズ自動化</CardTitle>
            <CardDescription>
              デイリークイズの参加と報酬受け取りを実行
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              ステータス: {quizStatus}
            </p>
            <Button variant="outline" size="sm" onClick={handleRunQuiz}>
              手動実行
            </Button>
          </CardContent>
        </Card>

        {/* Message Export Card */}
        <Card>
          <CardHeader>
            <CardTitle>メッセージエクスポート</CardTitle>
            <CardDescription>
              ルームの全メッセージをJSON形式で保存
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
            >
              メッセージエクスポート
            </Button>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card>
          <CardHeader>
            <CardTitle>アプリ情報</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Zeta Chat Client — React + shadcn/ui
            </p>
            <p className="text-sm text-muted-foreground tabular-nums">
              エミュレート中のクライアントバージョン: {APP_VERSION}
            </p>
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
              キャッシュされた画像:{" "}
              <span className="font-medium tabular-nums">{cacheCount}</span> 件
              {memoryCount > 0 && (
                <>
                  {" "}
                  （メモリ{" "}
                  <span className="font-medium tabular-nums">
                    {memoryCount}
                  </span>{" "}
                  件）
                </>
              )}
            </p>
            <Button
              variant="destructive"
              size="sm"
              disabled={cacheDeleting}
              onClick={clearCache}
            >
              {cacheDeleting && <Spinner className="mr-1 size-3" />}
              画像キャッシュを削除
            </Button>
          </CardContent>
        </Card>
      </div>

      <MessageExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  )
}
