import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { parse } from "yaml";
import { alias } from "./build/utils";

// 主构建链路原生支持 yaml 语言包，vitest 侧补同等转换
const yamlLoader = {
  name: "yaml-loader",
  transform(code: string, id: string) {
    if (id.endsWith(".yaml") || id.endsWith(".yml")) {
      return {
        code: `export default ${JSON.stringify(parse(code))}`,
        map: null
      };
    }
  }
};

export default defineConfig({
  resolve: { alias },
  plugins: [vue(), yamlLoader],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    // 测试态环境默认值（与 .env.development 对齐）
    env: {
      VITE_ROUTER_HISTORY: "hash",
      VITE_PUBLIC_PATH: "/",
      VITE_CDN: "false",
      VITE_COMPRESSION: "none",
      VITE_HIDE_HOME: "false"
    },
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/api/**", "src/utils/**", "src/store/modules/**"],
      exclude: ["src/**/*.spec.ts", "src/**/types.d.ts", "src/**/types"],
      reporter: ["text", "html"],
      thresholds: {
        // T4.2：覆盖率门禁（含 api/utils/store 三域），实测基线打平后随补测逐步上调
        statements: 50,
        branches: 42,
        functions: 38,
        lines: 50
      }
    }
  }
});
