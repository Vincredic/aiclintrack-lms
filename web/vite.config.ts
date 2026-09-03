import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { prerenderCatalogPlugin } from "./prerender";
import {
  YOUTUBE_CHANNEL_ID,
  YOUTUBE_FEED_PATH,
} from "./src/config/youtubeChannel";

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), tailwindcss(), prerenderCatalogPlugin()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      [YOUTUBE_FEED_PATH]: {
        target: "https://www.youtube.com",
        changeOrigin: true,
        rewrite: () => `/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`,
      },
    },
  },
  build: {
    outDir: "build",
    sourcemap: false,
  },
});
