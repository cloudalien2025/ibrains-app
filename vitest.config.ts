import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@/src": path.resolve(__dirname, "src"),
      "@/lib": path.resolve(__dirname, "lib"),
      "@/app": path.resolve(__dirname, "app"),
      "@/tests": path.resolve(__dirname, "tests"),
      "server-only": path.resolve(__dirname, "tests/__mocks__/server-only.ts"),
    },
  },
});
