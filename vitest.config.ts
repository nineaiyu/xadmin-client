import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { alias } from "./build/utils";

export default defineConfig({
  resolve: { alias },
  plugins: [vue()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/api/**", "src/utils/**"],
      exclude: ["src/**/*.spec.ts", "src/**/types.d.ts", "src/**/types"],
      reporter: ["text", "html"]
    }
  }
});