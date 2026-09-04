import { defineConfig } from "@playwright/test";

/**
 * E2E 冒烟测试配置
 *
 * 运行前提：
 * 1. 后端：xadmin-server 本地 config.yml（sqlite + 关闭验证码）+ `python manage.py runserver 127.0.0.1:8896`
 * 2. 前端：`pnpm dev`（vite 代理 /api -> 8896）
 * 可通过 E2E_BASE_URL 覆盖前端地址
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"]],
  outputDir: "./test-results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8848",
    locale: "zh-CN",
    screenshot: "only-on-failure",
    actionTimeout: 10_000
  }
});
