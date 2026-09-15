import { expect, test, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 视觉回归门禁（C4 前置）：核心页基线截图比对，为「T2 !important 存量清零」
 * 提供安全网。按需运行：`pnpm test:e2e:visual`（E2E_VISUAL=1），不进常规全量——
 * 截图基线按平台目录存放（playwright 自动带 -linux/-darwin 后缀），跨平台像素
 * 必然差异，CI 侧等 ubuntu 基线生成入库后再启用常态比对。
 *
 * 基线更新：`pnpm test:e2e:visual -- --update-snapshots`
 * 判定：maxDiffPixelRatio 2%（容忍字体渲染亚像素差），全页截图、禁用动画。
 */

test.skip(
  process.env.E2E_VISUAL !== "1",
  "视觉回归按需运行：E2E_VISUAL=1 pnpm test:e2e:visual"
);

const CORE_PAGES: Array<{ name: string; open: (page: Page) => Promise<void> }> =
  [
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
      name: "integration-ai",
      open: async page => {
        await openMenuPath(page, ["集成管理"], "/integration/ai/index");
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
    await login(page);
    await core.open(page);
    // 等主内容出现（页面骨架异步渲染，登录跳转后即刻截图会拿到空壳）
    await expect(page.locator("#main-content")).toBeVisible({
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
