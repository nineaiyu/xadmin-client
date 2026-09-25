import { expect, test, type Page } from "@playwright/test";
import { ADMIN, login } from "./helpers";

/**
 * 暗色模式验证（主题正确性守护）。
 *
 * 判据：核心页在深色下必须是「深表面 + 浅文本」，切回浅色恢复原样——
 * 任何写死的浅色值（颜色清理项针对的那类）或只解析一次的颜色都会在这里暴露。
 *
 * 注意：整体风格是**服务端站点配置**（`WEB_SITE_CONFIG` 的 `DarkMode` / `ThemeMode`，
 * 改动即防抖 PATCH），与同库其它用例共享，visual 基线对底色敏感——
 * 因此本 spec 开头先归一为浅色、结尾（含 afterEach 兜底）还原浅色并等落库。
 */

const SITE_CONFIG_PATCH = (req: { method: () => string; url: () => string }) =>
  req.method() === "PATCH" &&
  req.url().includes("/api/system/configs/WEB_SITE_CONFIG");

/** 语言可能被其它用例/残留切到英文，文案一律中英双语匹配 */
const DARK_LABEL = /深色|Dark/;
const LIGHT_LABEL = /浅色|Light/;

const luminance = (color: string) => {
  const [r, g, b] = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** 页面 / 表面选择器（表面 = 该页最外层内容容器） */
const CASES: Array<{ path: string; label: string; surface: string }> = [
  { path: "/#/welcome", label: "工作台", surface: ".el-card" },
  { path: "/#/system/user/index", label: "用户管理", surface: ".el-table" },
  {
    path: "/#/account-settings",
    label: "账户设置侧栏",
    surface: ".pure-account-settings"
  }
];

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

/**
 * 切换整体风格：走顶栏「项目设置」面板里的分段控件（浅色 / 深色 / 自动）。
 * 不直接写 localStorage——布局在挂载与 resize 时会把内存态回写存储，外部写入会被覆盖；
 * 面板切换同时更新内存态、本地存储、服务端配置与 `html.dark`。
 */
async function switchTheme(page: Page, mode: "dark" | "light") {
  // 面板入口在主布局：账户设置等页面不渲染顶栏，先回工作台
  await page.goto("/#/welcome");
  await page.locator(".set-icon").first().waitFor({ timeout: 15_000 });
  if ((await isDark(page)) === (mode === "dark")) return;

  const saved = page
    .waitForRequest(SITE_CONFIG_PATCH, { timeout: 15_000 })
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
  await saved; // 等服务端落库：刷新恢复与跨设备一致依赖它
}

async function measure(page: Page, surface: string) {
  await page.locator(surface).first().waitFor({ timeout: 15_000 });
  return page
    .locator(surface)
    .first()
    .evaluate(el => {
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, color: style.color };
    });
}

test.describe("暗色模式主题一致性", () => {
  test.afterEach(async ({ page }) => {
    // 兜底还原：主题是服务端共享配置，深色残留会打穿 visual 基线与其它页断言
    await switchTheme(page, "light").catch(() => undefined);
  });

  test("深色下核心页转为深表面 + 浅文本，切回浅色恢复", async ({ page }) => {
    await login(page, ADMIN);
    await switchTheme(page, "light");

    for (const item of CASES) {
      await page.goto(item.path);
      await expect(page.locator("html")).not.toHaveClass(/dark/);
      const light = await measure(page, item.surface);
      expect(
        luminance(light.background),
        `${item.label} 浅色表面应为浅色：${JSON.stringify(light)}`
      ).toBeGreaterThan(0.8);
      expect(
        luminance(light.color),
        `${item.label} 浅色文本应为深色：${JSON.stringify(light)}`
      ).toBeLessThan(0.5);
    }

    await switchTheme(page, "dark");
    for (const item of CASES) {
      await page.goto(item.path);
      await expect(page.locator("html")).toHaveClass(/dark/);
      const dark = await measure(page, item.surface);
      expect(
        luminance(dark.background),
        `${item.label} 深色表面应为深色：${JSON.stringify(dark)}`
      ).toBeLessThan(0.35);
      expect(
        luminance(dark.color),
        `${item.label} 深色文本应为浅色：${JSON.stringify(dark)}`
      ).toBeGreaterThan(0.6);
    }

    await switchTheme(page, "light");
    await page.goto("/#/welcome");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    const back = await measure(page, ".el-card");
    expect(luminance(back.background)).toBeGreaterThan(0.8);
  });

  test("账户设置侧栏激活项在两态下都是白字（皮肤锚定后既生效也不外泄）", async ({
    page
  }) => {
    await login(page, ADMIN);
    await switchTheme(page, "light");

    const activeColor = async () => {
      await page.goto("/#/account-settings");
      const item = page
        .locator(".pure-account-settings-menu .el-menu-item.is-active")
        .first();
      await item.waitFor({ timeout: 15_000 });
      return item.evaluate(el => getComputedStyle(el).color);
    };

    expect(await activeColor()).toBe("rgb(255, 255, 255)");
    await switchTheme(page, "dark");
    expect(await activeColor()).toBe("rgb(255, 255, 255)");
  });
});
