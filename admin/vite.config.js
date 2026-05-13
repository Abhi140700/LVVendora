import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key: fs.readFileSync("../certs/localhost-key.pem"),
      cert: fs.readFileSync("../certs/localhost-cert.pem"),
    },
    proxy: {
      "/api": {
        target: "https://127.0.0.1:2000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
