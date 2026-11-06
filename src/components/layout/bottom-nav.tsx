import { NavLink, useLocation } from "react-router-dom"
import { Home, Search, Star, MessageCircle, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { to: "/", label: "ホーム", icon: Home, end: true },
  { to: "/search", label: "検索", icon: Search },
  { to: "/ranking", label: "ランキング", icon: Star },
  { to: "/rooms", label: "チャット", icon: MessageCircle },
  { to: "/settings", label: "設定", icon: Settings },
]

export function BottomNav() {
  const location = useLocation()

  return (
    <nav
      className="glass sticky bottom-0 z-50 mt-auto w-full border-t border-border"
      role="navigation"
      aria-label="メインナビゲーション"
    >
      <div className="mx-auto flex h-16 w-full max-w-lg items-stretch">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end || false}
            onClick={() => {
              if (to === "/" && location.pathname === "/") {
                window.dispatchEvent(new Event("refreshHome"))
              }
            }}
            className={({ isActive }: { isActive: boolean }) =>
              cn(
                "flex min-h-11 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1.5 text-[11px] transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <Icon className="size-5 shrink-0" />
            <span className="max-w-full truncate whitespace-nowrap">
              {label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
