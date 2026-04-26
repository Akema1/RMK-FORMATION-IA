import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias: { "@": path.resolve(__dirname, ".") } },
        test: {
          name: "api",
          include: ["api/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [react()],
        resolve: { alias: { "@": path.resolve(__dirname, ".") } },
        test: {
          name: "ui",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          globals: true,
        },
      },
    ],
  },
});
