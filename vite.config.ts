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

function localAuthPlugin(): Plugin {
  return {
    name: "zeta-local-auth-store",
    configureServer(server) {
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
