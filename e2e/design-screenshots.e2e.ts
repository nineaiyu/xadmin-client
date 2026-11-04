import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { devices, expect, test, type Page } from "@playwright/test";

import { login } from "./helpers";

/**
 * UI 整改改前/改后对照截图（design 专项，常设工具）。
 * 通过 DESIGN_SHOT_DIR 环境变量控制输出目录（如 docs/design/screenshots/after），
 * 不进常规全量（`E2E_DESIGN_SHOT=1` 按需运行）；UI 观感改动时复跑产出评审对照。
 * 口径与 visual.e2e.ts 一致：干净种子、禁动画、字体就绪、菜单装配稳定。
 */

const SITE_CONFIG_URL = "/api/system/configs/WEB_SITE_CONFIG";
const DARK_LABEL = /深色|Dark/;
const LIGHT_LABEL = /浅色|Light/;

const outDir = resolve(
  process.cwd(),
  process.env.DESIGN_SHOT_DIR ?? "docs/design/screenshots/before"
);

test.skip(
  process.env.E2E_DESIGN_SHOT !== "1",
  "改前/改后对照截图按需运行：E2E_DESIGN_SHOT=1"
);

interface ShotPage {
  name: string;
  auth: boolean;
  root: string;
  /** hash 直达路由：导航不依赖侧栏形态（移动端侧栏是抽屉态，openMenuPath 打不开） */
  hash: string;
}

const PAGES: ShotPage[] = [
  {
    name: "login",
    auth: false,
    root: ".login-box",
    hash: "/#/login"
  },
  {
    name: "welcome",
    auth: true,
    root: "#main-content",
    hash: "/#/welcome"
  },
  {
    name: "system-user",
    auth: true,
    root: "#main-content",
    hash: "/#/system/user/index"
  },
  {
    name: "analysis-dashboard",
    auth: true,
    root: "#main-content",
    hash: "/#/analysis/dashboard/index"
  }
];

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

/** 与 theme-dark.e2e.ts 同源：走设置面板切换并等服务端落库（复制自该 spec，临时用） */
async function switchTheme(page: Page, mode: "dark" | "light") {
  await page.goto("/#/welcome");
  await page.locator(".set-icon").first().waitFor({ timeout: 15_000 });
  if ((await isDark(page)) === (mode === "dark")) return;
  const expectedDark = mode === "dark";
  const saved = page
    .waitForResponse(
      resp =>
        resp.request().method() === "PATCH" &&
        resp.url().includes(SITE_CONFIG_URL) &&
        new RegExp(`"DarkMode"\\s*:\\s*${expectedDark}`).test(
          resp.request().postData() ?? ""
        ),
      { timeout: 15_000 }
    )
    .catch(() => null);
  await page.locator(".set-icon").first().click();
  const panel = page.locator(".right-panel");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await panel
    .locator(".pure-segmented")
    .first()
    .locator(".pure-segmented-item", {
      hasText: mode === "dark" ? DARK_LABEL : LIGHT_LABEL
    })
    .click();
  await page.waitForFunction(
    dark => document.documentElement.classList.contains("dark") === dark,
    mode === "dark"
  );
  const response = await saved;
  await response?.finished().catch(() => null);
  await page.reload();
  await page.waitForFunction(
    dark => document.documentElement.classList.contains("dark") === dark,
    mode === "dark",
    { timeout: 15_000 }
  );
  await page.locator(".set-icon").first().waitFor({ timeout: 15_000 });
}

async function stabilize(page: Page) {
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; " +
      "transition-duration: 0s !important; transition-delay: 0s !important; caret-color: transparent !important; }"
  });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(2500);
}

async function shoot(page: Page, name: string, tag: string, root: string) {
  await expect(page.locator(root)).toBeVisible({ timeout: 20_000 });
  await stabilize(page);
  await page.screenshot({
    path: resolve(outDir, `${name}-${tag}.png`),
    fullPage: true
  });
}

for (const viewportTag of ["desktop", "mobile"] as const) {
  test.describe(`截图 · ${viewportTag}`, () => {
    // 移动轮必须带移动 UA（iPhone 13 同款，与 mobile.e2e.ts 一致）：
    // deviceDetection() 是 UA 判定而非宽度判定，纯 390 视口仍会渲染 desktop 布局；
    // devices 描述符整体含 defaultBrowserType（describe 组内 test.use 不允许），
    // 只取视口 / UA / 触摸三件
    const iphone = devices["iPhone 13"];
    test.use(
      viewportTag === "desktop"
        ? { viewport: { width: 1440, height: 900 } }
        : {
            viewport: iphone.viewport,
            userAgent: iphone.userAgent,
            isMobile: true,
            hasTouch: true
          }
    );

    for (const theme of ["light", "dark"] as const) {
      test(`对照截图：${theme} × ${viewportTag}`, async ({ page }) => {
        test.setTimeout(300_000);
        mkdirSync(outDir, { recursive: true });

        // 主题切换（设置面板交互）依赖 desktop 布局（移动端下面板形态与选择器
        // 不同）；主题是服务端站点配置，在 desktop 上下文落库后，目标视口的
        // 页面登录即读取正确主题——**不做 resize**：从宽屏缩到 390 会让侧栏
        // 残留 desktop 展开态，不再是真实移动端的抽屉形态
        if (viewportTag === "mobile") {
          const browser = page.context().browser();
          const dctx = await browser?.newContext({
            viewport: { width: 1440, height: 900 }
          });
          const dpage = await dctx?.newPage();
          if (!dpage) throw new Error("无法创建 desktop 上下文");
          try {
            await login(dpage);
            await switchTheme(dpage, theme);
          } finally {
            await dctx?.close();
          }
        }

        // 顺序：先鉴权页（登录 + 导航），后匿名页（login 页跟随站点配置渲染
        // 明暗，若放在切主题之前，暗色轮会截到浅色登录页）
        for (const item of [
          ...PAGES.filter(p => p.auth),
          ...PAGES.filter(p => !p.auth)
        ]) {
          if (item.auth) {
            await login(page);
          } else {
            // 登录页必须匿名 context：已登录会话访问 /#/login 会被守卫重定向，
            // .login-box 永不可见（与 visual.e2e.ts 的 login 口径一致）
            const ctx = await page
              .context()
              .browser()
              ?.newContext({ viewport: page.viewportSize() ?? undefined });
            const anon = await ctx?.newPage();
            if (!anon) continue;
            try {
              await anon.goto(item.hash);
              await shoot(
                anon,
                item.name,
                `${theme}-${viewportTag}`,
                item.root
              );
            } finally {
              await ctx?.close();
            }
            continue;
          }

          await page.goto(item.hash);
          await shoot(page, item.name, `${theme}-${viewportTag}`, item.root);
        }
      });
    }
  });
}

/** 结尾归一浅色：整体风格是服务端站点配置，别把暗色残留留给同库后续用例 */
test.afterEach(async ({ page }) => {
  if (await isDark(page).catch(() => false)) {
    await switchTheme(page, "light").catch(() => undefined);
  }
});
