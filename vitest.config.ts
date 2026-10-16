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
      // 2026-09-27 口径复核：曾试验把 views/components/layout/router/directives 纳入
      // include，全仓实测仅 13.01/11.1/9.45/13.08（UI 层守护由 Playwright E2E 承担，
      // 单测不覆盖 SFC 模板属既定分工）——若跟随扩面，门禁将跌至装饰性阈值，且分域
      // glob 阈值与本版 vitest 的报告口径不一致（src/api 域引擎值 ≠ 报告值），故维持
      // 「逻辑三域」实质门禁不变；扩面待 views 单测补足后再议（server/docs/metrics.md
      // 2026-09-27 回填行已定量登记该盲区）
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
        // 2026-09-26 第三步：api 域契约补测（system/user/chat 薄封装 + SSE 分发）
        // 后实测 66.59/57.79/61.25/67.08，各 −1 上调；statements 达成 2.8 目标 65
        statements: 65,
        branches: 56,
        functions: 60,
        lines: 66
      }
    }
  }
});
