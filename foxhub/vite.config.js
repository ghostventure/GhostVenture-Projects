import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/firebase/auth")) return "firebase-auth";
          if (id.includes("/firebase/firestore")) return "firebase-firestore";
          if (id.includes("/firebase/app-check")) return "firebase-app-check";
          if (id.includes("/firebase/app")) return "firebase-core";
          if (id.includes("/react/") || id.includes("/react-dom/")) return "react-vendor";
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 4173
  }
});
