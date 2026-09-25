import { expect, test, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 视觉回归门禁：核心页基线截图比对，为视觉观感改动提供安全网。
 * 按需运行：`pnpm test:e2e:visual`（E2E_VISUAL=1），不进常规全量——
 * 截图基线按平台目录存放（playwright 自动带 -linux/-darwin 后缀），跨平台像素
 * 必然差异，CI 侧等 ubuntu 基线生成入库后再启用常态比对。
 *
 * 基线更新：`pnpm test:e2e:visual -- --update-snapshots`
 * 判定：maxDiffPixelRatio 2%（容忍字体渲染亚像素差），全页截图、禁用动画。
 *
 * 页面选择口径：结构稳定、数据稳定的核心页（静态骨架 / 种子数据）；
 * 数据随运行时刻变化的页面不入基线，避免 flaky。实测排除（2026-09-25）：
 * - 系统监控：心跳/告警数据与图表时间轴随运行时刻变化（差 3%）；
 * - AI 控制台：对话历史服务端持久化，跑批会累积消息（差 3%）；
 * - 操作日志：日志行数据依赖其它用例产生的操作记录。
 * 注：chat 页依赖「公共聊天室为空」的 seed 初始态，若后续出现同类 flaky 按同口径移除。
 */

test.skip(
  process.env.E2E_VISUAL !== "1",
  "视觉回归按需运行：E2E_VISUAL=1 pnpm test:e2e:visual"
);

/** 内置示例大屏主键（load_init_json 的「示例-运营大屏」） */
const SCREEN_PK = "5eed0003-0000-4000-8000-000000000003";

interface CorePage {
  name: string;
  /** 页面骨架锚点（默认 layout 的 #main-content；无 layout 的独立页给自有根） */
  root?: string;
  /** 是否先登录（默认 true；登录页等未登录形态设 false） */
  auth?: boolean;
  open: (page: Page) => Promise<void>;
}

const CORE_PAGES: CorePage[] = [
  {
    name: "login",
    auth: false,
    root: ".login-box",
    open: async page => {
      // 新 context 无凭证，直接进登录页（已登录访问会被守卫重定向）
      await page.goto("/#/login");
    }
  },
  {
    name: "welcome",
    open: async page => {
      // 首页侧边栏链接即 #/（路由 /welcome，不在种子菜单里单列）
      await openMenuPath(page, [], "/");
    }
  },
  {
    name: "system-user",
    open: async page => {
      await openMenuPath(page, ["系统管理"], "/system/user/index");
    }
  },
  {
    name: "system-menu",
    open: async page => {
      await openMenuPath(page, ["系统管理"], "/system/menu/index");
    }
  },
  {
    name: "analysis-dashboard",
    open: async page => {
      await openMenuPath(page, ["数据分析"], "/analysis/dashboard/index");
    }
  },
  {
    name: "analysis-screen",
    root: ".screen-root",
    open: async page => {
      // 全屏投屏页（无 layout 静态路由），示例大屏仅一张看板、不轮播
      await page.goto(`/#/analysis/screen/display?pk=${SCREEN_PK}`);
    }
  },
  {
    name: "chat",
    open: async page => {
      await openMenuPath(page, [], "/default/chat/index");
    }
  }
];

async function stabilize(page: Page) {
  // 停入场动画/过渡与光标闪烁：像素比对的最大噪声源
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; " +
      "transition-duration: 0s !important; transition-delay: 0s !important; caret-color: transparent !important; }"
  });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // 字体就绪后再截图，避免首帧字体回退
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // ECharts 走 canvas 内部动画（CSS 禁不掉），默认时长 ~1s：等它画完再比对
  await page.waitForTimeout(1500);
}

for (const core of CORE_PAGES) {
  test(`视觉基线：${core.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    if (core.auth !== false) await login(page);
    await core.open(page);
    // 等主内容出现（页面骨架异步渲染，登录跳转后即刻截图会拿到空壳）
    await expect(page.locator(core.root ?? "#main-content")).toBeVisible({
      timeout: 20_000
    });
    await stabilize(page);
    await expect(page).toHaveScreenshot(`core-${core.name}.png`, {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.02
    });
  });
}
