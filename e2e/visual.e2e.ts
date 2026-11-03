import { expect, test, type Page } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 视觉回归门禁：核心页基线截图比对，为视觉观感改动提供安全网。
 * 按需运行：`pnpm test:e2e:visual`（E2E_VISUAL=1），不进常规全量——
 * 截图基线按平台目录存放（playwright 自动带 -linux/-darwin 后缀），跨平台像素
 * 必然差异，CI 侧等 ubuntu 基线生成入库后再启用常态比对。
 *
 * 基线更新：`pnpm test:e2e:visual -- --update-snapshots`
 * 判定：maxDiffPixelRatio 2%（容忍字体渲染亚像素差），全页截图、禁用动画。
 * 复核/录制必须使用干净种子（勿设 E2E_SEED=0）：复用被其它用例写脏的库会让
 * 首页计数与未读徽标变化，welcome 曾因此 flaky。
 *
 * 页面选择口径：结构稳定、数据稳定的核心页（静态骨架 / 种子数据）；
 * 数据随运行时刻变化的页面不入基线，避免 flaky。实测排除（2026-09-25）：
 * - 系统监控：心跳/告警数据与图表时间轴随运行时刻变化（差 3%）；
 * - AI 控制台：对话历史服务端持久化，跑批会累积消息（差 3%）；
 * - 操作日志：日志行数据依赖其它用例产生的操作记录；
 * - 聊天室：公共房间历史由 chat / notice-push 等用例持续写入且无可用的清空接口，
 *   非 fresh 库上整页截图必然漂移，已移出基线面。
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
    // 第二个典型列表页（system 域）：搜索卡 + 工具栏 + 表格（角色数据随种子固定）
    name: "system-role",
    open: async page => {
      await openMenuPath(page, ["系统管理", "权限管理"], "/system/role/index");
    }
  },
  {
    // 业务列表代表：二开样板页（generate_crud 产物，菜单由 e2e_seed 现场生成）
    name: "demo-book",
    open: async page => {
      await page.goto("/#/default/demo/book/index");
    }
  },
  {
    // 详情/表单页代表：账户设置（当前用户资料，种子内稳定）
    name: "account-settings",
    open: async page => {
      await page.goto("/#/account-settings");
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
  // 侧栏菜单是登录后按 routes 渐进装配的（分组逐段插入）：等菜单项计数
  // 连续两个观察窗不再增长再截图，否则基线可能截到「只有部分菜单」的中间态，
  // 复跑时菜单补全引发整页布局偏移、击穿 2% 容差（实测 system-user 命中过）
  await page
    .evaluate(async () => {
      const count = () =>
        document.querySelectorAll(".sidebar-container .el-menu-item").length;
      let previous = count();
      let stable = 0;
      for (let i = 0; i < 40 && stable < 2; i++) {
        await new Promise(resolve => setTimeout(resolve, 250));
        const current = count();
        if (current === previous) stable += 1;
        else {
          stable = 0;
          previous = current;
        }
      }
    })
    .catch(() => undefined);
  // 字体就绪后再截图，避免首帧字体回退
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // ECharts 走 canvas 内部动画（CSS 禁不掉），默认时长 ~1s；首页数字滚动 2.2s，
  // 统一取 2.5s 观察窗，避免截图落在计数动画中间态（welcome 曾因此 flaky）。
  await page.waitForTimeout(2500);
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

/**
 * 表单弹窗校验错误态基线：用户新增弹窗空表单提交，覆盖必填校验文案与
 * 表单错误排版（i18n 静态词条，逐帧稳定；只截弹窗本体，页面其余部分不进场）。
 */
test("视觉基线：system-user-add-dialog-invalid", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 20_000
  });

  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog.getByLabel("用户名")).toBeVisible({ timeout: 20_000 });
  // 空表单提交触发校验错误态（不满足必填即留在弹窗内，不产生写库副作用）
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog.locator(".el-form-item__error").first()).toBeVisible({
    timeout: 10_000
  });
  await stabilize(page);
  await expect(dialog).toHaveScreenshot(
    "core-system-user-add-dialog-invalid.png",
    { animations: "disabled", maxDiffPixelRatio: 0.02 }
  );
});

/**
 * 浅色主题投屏基线：示例大屏临时切 `theme=light` 截图后还原（深色档由上面的
 * `analysis-screen` 覆盖）。手写用例而非并入 CORE_PAGES——它需要改数据再还原。
 */
test("视觉基线：analysis-screen-light", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const patch = (theme: string) =>
    page.request.patch(`${BACKEND_URL}/api/dataset/screens/${SCREEN_PK}`, {
      headers,
      data: { theme }
    });

  expect((await (await patch("light")).json()).code).toBe(1000);
  try {
    await page.goto(`/#/analysis/screen/display?pk=${SCREEN_PK}`);
    await expect(page.locator(".screen-root")).toBeVisible({
      timeout: 20_000
    });
    await stabilize(page);
    await expect(page).toHaveScreenshot("core-analysis-screen-light.png", {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.02
    });
  } finally {
    await patch("dark");
  }
});
