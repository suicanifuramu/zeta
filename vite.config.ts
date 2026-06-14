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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom")) return "vendor-react-dom"
            if (id.includes("react-router")) return "vendor-router"
            if (id.includes("radix-ui") || id.includes("vaul")) return "vendor-radix"
            if (id.includes("lucide-react")) return "vendor-icons"
            if (id.includes("sonner") || id.includes("next-themes")) return "vendor-ui"
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