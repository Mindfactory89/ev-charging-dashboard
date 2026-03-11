import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return null;
          if (id.includes("node_modules/recharts")) return "vendor-charts";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
});
