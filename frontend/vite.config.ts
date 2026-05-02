import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      // Allow serving files from the parent shared/ directory.
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname)],
    },
  },
});
