import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    pure: ["console.log"],
    drop: ["debugger"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              ["react", "react-dom", "react-router-dom"].some((pkg) =>
                id.includes(pkg)
              )
            ) {
              return "react-core"
            }
            if (id.includes("@radix-ui")) {
              return "radix-ui"
            }
            return "vendor"
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
})
