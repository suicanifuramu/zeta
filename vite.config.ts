import path from "path"
import fs from "node:fs/promises"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const sessionFile = path.resolve(process.cwd(), ".zeta-session.json")

async function readBody(req: import("http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString("utf8")
}

let backgroundRefreshTimer: NodeJS.Timeout | null = null

function startBackgroundRefresh() {
  if (backgroundRefreshTimer) return
  backgroundRefreshTimer = setInterval(async () => {
    try {
      const current = JSON.parse(await fs.readFile(sessionFile, "utf8").catch(() => "{}") || "{}")
      const { deviceId, refreshToken, accessToken } = current
      if (!deviceId || !refreshToken || !accessToken) return
      
      const parts = String(accessToken).split('.')
      if (parts.length !== 3) return
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
      const expiry = payload.exp ? payload.exp * 1000 : 0
      
      if (expiry - Date.now() < 600000) {
        console.log(`[Vite Background] Token expiring within 10 mins. Auto-refreshing...`)
        const response = await fetch("https://api.zeta-ai.io/v1/auth/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ deviceId, type: "refresh", refreshToken })
        })
        
        if (response.ok) {
          const data = await response.json() as Record<string, string>
          if (data.accessToken) {
            current.accessToken = data.accessToken
            if (data.refreshToken) current.refreshToken = data.refreshToken
            await fs.writeFile(sessionFile, `${JSON.stringify(current, null, 2)}\n`, "utf8")
            console.log(`[Vite Background] Background session refresh successful.`)
          }
        } else {
          console.error(`[Vite Background] Refresh failed: ${response.status}`)
        }
      }
    } catch (e) {
      console.error(`[Vite Background] Auto-refresh error:`, e)
    }
  }, 60000)
}

function localAuthPlugin(): Plugin {
  return {
    name: "zeta-local-auth-store",
    configureServer(server) {
      startBackgroundRefresh()
      server.middlewares.use("/local-auth", async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        try {
          if (req.method === "GET") {
            const text = await fs.readFile(sessionFile, "utf8").catch(() => "{}")
            res.end(text || "{}")
            return
          }
          if (req.method === "PUT" || req.method === "POST") {
            const current = JSON.parse(await fs.readFile(sessionFile, "utf8").catch(() => "{}") || "{}")
            const incoming = JSON.parse(await readBody(req) || "{}")
            const next = {
              deviceId: incoming.deviceId ?? current.deviceId ?? "",
              refreshToken: incoming.refreshToken ?? current.refreshToken ?? "",
              accessToken: incoming.accessToken ?? current.accessToken ?? "",
            }
            await fs.writeFile(sessionFile, `${JSON.stringify(next, null, 2)}\n`, "utf8")
            res.end(JSON.stringify({ ok: true }))
            return
          }
          if (req.method === "DELETE") {
            await fs.rm(sessionFile, { force: true })
            res.end(JSON.stringify({ ok: true }))
            return
          }
          res.statusCode = 405
          res.end(JSON.stringify({ error: "Method Not Allowed" }))
        } catch (e: unknown) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localAuthPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "https://api.zeta-ai.io",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
        secure: true,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes, req, res) => {
            const ct = proxyRes.headers["content-type"] || ""
            if (ct.includes("text/event-stream") || req.url?.includes("/stream")) {
              res.setHeader("Cache-Control", "no-cache")
              res.setHeader("X-Accel-Buffering", "no")
            }
          })
        },
      },
    },
  },
})
