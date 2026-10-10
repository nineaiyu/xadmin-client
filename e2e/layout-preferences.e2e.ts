import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers";

/**
 * 布局偏好（项目设置面板「通用」页签）：内容区紧凑模式、顶栏滚动自动隐藏。
 *
 * 两项都实时落库（站点配置自动保存 PATCH），且会改变后续页面观感 ——
 * 用例结束必须复位，否则污染其它用例与视觉基线（与 theme-dark 同口径）。
 */

const SITE_CONFIG_URL = "/api/system/configs/WEB_SITE_CONFIG";

/**
 * 等待面板触发的站点配置 PATCH 落库（自动保存防抖 600ms）。
 *
 * 只认「目标字段值」的那一次保存：切换前后可能各有一次在途的旧配置保存，
 * 只等第一个 PATCH 会等到旧值、随后的刷新断言落空。
 */
async function waitForSiteConfigPatch(
  page: Page,
  field: "CompactMode" | "HeaderAutoHide",
  value: boolean,
  action: () => Promise<void>
) {
  const saved = page
    .waitForResponse(
      resp =>
        resp.request().method() === "PATCH" &&
        resp.url().includes(SITE_CONFIG_URL) &&
        new RegExp(`"${field}"\\s*:\\s*${value}`).test(
          resp.request().postData() ?? ""
        ),
      { timeout: 15_000 }
    )
    .catch(() => null);
  await action();
  const response = await saved;
  await response?.finished().catch(() => undefined);
}

/** 打开项目设置面板（收起态只是 translate 出视口，按 boundingBox 判定开合） */
async function openPanel(page: Page) {
  await page.goto("/#/welcome");
  await page.locator(".set-icon").first().waitFor({ timeout: 15_000 });
  const panel = page.locator(".right-panel").first();
  const width = page.viewportSize()?.width ?? 1280;
  const box = await panel.boundingBox();
  if (!box || box.x >= width - 20) {
    await page.locator(".set-icon").first().click();
  }
  await expect(panel).toBeVisible({ timeout: 15_000 });
}

/** 切换「通用」页签下的开关（el-switch 根元素无 aria-checked，用内部 checkbox 判定） */
async function setSwitch(
  page: Page,
  label: string,
  value: boolean,
  field: "CompactMode" | "HeaderAutoHide"
) {
  const row = page
    .locator(".right-panel .setting li")
    .filter({ hasText: label })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  const input = row.locator("input[type=checkbox]").first();
  if ((await input.isChecked()) !== value) {
    await waitForSiteConfigPatch(page, field, value, async () => {
      await row.locator(".el-switch").click();
    });
  }
}

async function switchTab(page: Page, label: string) {
  const tab = page.locator(".right-panel .el-tabs__item").filter({
    hasText: label
  });
  await tab.first().click();
}

test.describe("布局偏好（紧凑模式 / 顶栏自动隐藏）", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    // 复位：两项都关回默认，避免污染其它用例与视觉基线
    await openPanel(page).catch(() => undefined);
    await switchTab(page, "通用").catch(() => undefined);
    await setSwitch(page, "紧凑模式", false, "CompactMode").catch(
      () => undefined
    );
    await setSwitch(page, "顶栏自动隐藏", false, "HeaderAutoHide").catch(
      () => undefined
    );
  });

  test("偏好抽屉为三页签结构，紧凑模式实时生效并持久化", async ({ page }) => {
    await openPanel(page);
    const tabs = page.locator(".right-panel .el-tabs__item");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveText(/外观|Appearance/);
    await expect(tabs.nth(1)).toHaveText(/布局|Layout/);
    await expect(tabs.nth(2)).toHaveText(/通用|General/);

    await switchTab(page, "通用");
    await expect(
      page.locator(".right-panel .setting li").filter({ hasText: "紧凑模式" })
    ).toBeVisible();

    // 开启紧凑模式：内容区行高密度档位（24 → 16）并居中限宽
    await setSwitch(page, "紧凑模式", true, "CompactMode");
    const section = page.locator("section.app-main").first();
    await expect(section).toHaveClass(/compact/, { timeout: 10_000 });
    await expect
      .poll(async () =>
        section.evaluate(el =>
          getComputedStyle(el).getPropertyValue("--content-gap").trim()
        )
      )
      .toBe("16px");

    // 刷新后仍生效（站点配置已落库）
    await page.reload();
    await expect(page.locator("section.app-main").first()).toHaveClass(
      /compact/,
      { timeout: 15_000 }
    );

    // 关闭后恢复缺省留白
    await openPanel(page);
    await switchTab(page, "通用");
    await setSwitch(page, "紧凑模式", false, "CompactMode");
    await expect(page.locator("section.app-main").first()).not.toHaveClass(
      /compact/,
      { timeout: 10_000 }
    );
  });

  test("顶栏滚动自动隐藏：下滑隐藏、上滑恢复", async ({ page }) => {
    await openPanel(page);
    await switchTab(page, "通用");
    await setSwitch(page, "顶栏自动隐藏", true, "HeaderAutoHide");

    // 复核开关已落本地存储（hook 读同一来源），避免把点选失败误判成动效失效
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("responsive-configure");
      return raw ? JSON.parse(raw).headerAutoHide === true : false;
    });
    expect(stored, "顶栏自动隐藏开关应已开启（存储已更新）").toBe(true);

    // 关闭面板：面板自身也是滚动容器，开着会干扰顶栏状态的判定
    await page.mouse.click(600, 400);
    await expect
      .poll(
        async () =>
          (await page.locator(".right-panel").first().boundingBox())?.x ?? 0,
        { timeout: 10_000 }
      )
      .toBeGreaterThan((page.viewportSize()?.width ?? 1280) - 20);

    const header = page.locator(".fixed-header").first();
    const scrollWrap = page.locator(".app-main .el-scrollbar__wrap").first();
    await expect(scrollWrap).toBeVisible({ timeout: 10_000 });

    // 向下滚动超过阈值：固定头部整块移出视口
    const hiddenTop = await scrollWrap.evaluate(el => {
      el.scrollTop = 600;
      return el.scrollTop;
    });
    expect(hiddenTop).toBeGreaterThan(96);
    await expect(header).toHaveClass(/header-hidden/, { timeout: 10_000 });
    // 位移判定用 getBoundingClientRect（移出视口后 boundingBox() 返回 null）
    await expect
      .poll(async () => header.evaluate(el => el.getBoundingClientRect().y), {
        timeout: 10_000
      })
      .toBeLessThan(0);

    // 向上滚动：立即恢复
    await scrollWrap.evaluate(el => {
      el.scrollTop = 0;
    });
    await expect(header).not.toHaveClass(/header-hidden/, { timeout: 10_000 });
    await expect
      .poll(async () => header.evaluate(el => el.getBoundingClientRect().y))
      .toBeGreaterThanOrEqual(0);
  });
});
