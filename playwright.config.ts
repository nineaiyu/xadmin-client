import { defineConfig } from "@playwright/test";

/**
 * xadmin E2E 配置（T4.4 环境固化后支持单命令 `pnpm test:e2e` 从零拉起）。
 *
 * 架构：
 * - 后端：xadmin-server 以 tests.settings_e2e 运行（sqlite 文件库 tmp/e2e.sqlite3 +
 *   进程内 FakeRedis + 关验证码/加密），不触碰本机 config.yml（见规划风险措施 4）
 * - 前端：vite dev server（代理 /api /media /ws → 后端端口，见 vite.config.ts）
 * - 种子：scripts/e2e_seed.py 一键重置（migrate + init_data + E2E 用户）
 *
 * 环境变量：
 * - E2E_SERVER_DIR      xadmin-server 仓库路径（默认 ../xadmin-server；CI 中检出为 ./xadmin-server）
 * - E2E_API_PORT        后端端口（默认 8896；本机 8896 被占用时换端口即可并行开发）
 * - E2E_FRONT_PORT      前端 dev server 端口（默认 8848）
 * - E2E_BASE_URL        覆盖前端地址（默认 http://localhost:${E2E_FRONT_PORT}）
 * - E2E_PYTHON          后端解释器（默认 ${E2E_SERVER_DIR}/.venv/bin/python）
 * - E2E_ADMIN_PASSWORD  超管密码（默认 E2E-Admin-2026!）
 * - E2E_SEED=0          跳过种子重置（复用既有库）
 * - CI=1                失败重试 2 次 + reuseExistingServer 关闭
 */
const serverDir = process.env.E2E_SERVER_DIR ?? "../xadmin-server";
const apiPort = process.env.E2E_API_PORT ?? "8896";
const frontPort = process.env.E2E_FRONT_PORT ?? "8848";
const apiURL = `http://127.0.0.1:${apiPort}`;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${frontPort}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  outputDir: "./test-results",
  use: {
    baseURL,
    locale: "zh-CN",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    // 兜底 CI 全新检出的冷启动首屏（无 vite 预打包缓存时模块按需冷转换），
    // 首次页面加载可能超过默认 30s 导航超时
    navigationTimeout: 120_000
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    // T4.3 验收：双浏览器。本机未安装 webkit 时可用 --project=chromium 运行
    { name: "webkit", use: { browserName: "webkit" } }
  ],
  webServer: [
    {
      // 种子先行：重置 sqlite 库并写入基础数据（E2E_SEED=0 可跳过），随后拉起后端。
      // 必须用 daphne 以 ASGI 承载：manage.py runserver（channels 未入 INSTALLED_APPS）
      // 是纯 WSGI，/ws/message/* 升级请求一律 404，站内信实时推送用例无法工作
      command:
        `PYTHON=${process.env.E2E_PYTHON ?? `${serverDir}/.venv/bin/python`}; ` +
        `ADMIN='${process.env.E2E_ADMIN_PASSWORD ?? "E2E-Admin-2026!"}'; ` +
        `export DJANGO_SETTINGS_MODULE=tests.settings_e2e XADMIN_ADMIN_PASSWORD="$ADMIN"; ` +
        `${process.env.E2E_SEED !== "0" ? `$PYTHON scripts/e2e_seed.py && ` : ""}` +
        `$PYTHON -m daphne -b 127.0.0.1 -p ${apiPort} server.asgi:application`,
      cwd: serverDir,
      url: `${apiURL}/api/common/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: `pnpm dev --port ${frontPort} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
