import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/proxy/donki": {
        target: "https://kauai.ccmc.gsfc.nasa.gov",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/donki/, "/DONKI/WS/get")
      },
      "/proxy/helioviewer": {
        target: "https://api.helioviewer.org",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/helioviewer/, "/v2")
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
