import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import Icons from "unplugin-icons/vite";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import { parse } from "yaml";
import { alias, pathResolve } from "./build/utils";

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
  // 与主构建 getPluginsList 对齐测试所需子集：vueJsx（.tsx 渲染器）、
  // Icons（~icons 虚拟模块）、i18n（locales 语言包编译）
  plugins: [
    vue(),
    vueJsx(),
    VueI18nPlugin({ include: [pathResolve("../locales/**")] }),
    Icons({ compiler: "vue3", scale: 1 }),
    yamlLoader
  ],
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
      include: [
        "src/api/**",
        "src/utils/**",
        "src/store/modules/**",
        // 注册表（input_type -> 渲染器）纳入覆盖统计
        "src/components/RePlusPage/src/utils/registry.ts",
        "src/components/RePlusPage/src/utils/renders.tsx"
      ],
      exclude: ["src/**/*.spec.ts", "src/**/types.d.ts", "src/**/types"],
      reporter: ["text", "html"],
      thresholds: {
        // 覆盖率门禁（含 api/utils/store 三域），实测基线打平后随补测逐步上调
        statements: 50,
        branches: 42,
        functions: 38,
        lines: 50
      }
    }
  }
});
