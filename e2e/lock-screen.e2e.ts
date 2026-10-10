import { expect, test } from "@playwright/test";
import { ADMIN, login, openMenuPath } from "./helpers";

/**
 * 锁屏（顶栏一键锁屏 → 口令解锁）。
 *
 * 覆盖：遮罩铺满视口（盖住顶栏入口与设置面板）；错误口令内联提示且保持锁定；
 * 正确口令解锁；「返回登录页」兜底出口。
 * 口令核验走后端 `POST /api/identity/userinfo/verify-password`（只校验，不签发凭证）。
 */

test.describe("锁屏与解锁", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await openMenuPath(page, ["系统管理"], "/system/user/index");
  });

  test("顶栏锁屏：错误口令保持锁定，正确口令解锁", async ({ page }) => {
    await page.locator("#header-lock").click();
    const lock = page.locator(".lock-screen");
    await expect(lock).toBeVisible({ timeout: 10_000 });

    // 遮罩铺满视口：被遮挡的界面不可再交互（顶栏入口在遮罩之下）
    const box = await lock.boundingBox();
    const viewport = page.viewportSize();
    expect(Math.round(box?.width ?? 0)).toBe(viewport?.width);
    expect(Math.round(box?.height ?? 0)).toBe(viewport?.height);

    // 错误口令：内联提示，仍处于锁定态
    await page.locator("#lock-screen-password").fill("WrongPass@123");
    await page.getByRole("button", { name: /解锁|Unlock/ }).click();
    await expect(page.locator(".lock-screen__error")).toBeVisible({
      timeout: 10_000
    });
    await expect(lock).toBeVisible();

    // 正确口令（回车提交）：遮罩消失，页面恢复可交互
    await page.locator("#lock-screen-password").fill(ADMIN.password);
    await page.locator("#lock-screen-password").press("Enter");
    await expect(lock).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator("#header-lock")).toBeVisible();
    // 解锁后页面状态未受影响：列表页仍在
    await expect(page.locator(".el-table__row").first()).toBeVisible({
      timeout: 15_000
    });
  });

  test("锁屏卡片提供「返回登录页」兜底出口", async ({ page }) => {
    await page.locator("#header-lock").click();
    await expect(page.locator(".lock-screen")).toBeVisible({ timeout: 10_000 });

    await page
      .getByRole("button", { name: /返回登录页|Back to login/ })
      .click();
    // 退出登录后回到登录页（账号输入框出现，登录页输入以 placeholder 定位）
    await expect(page).toHaveURL(/#\/login/, { timeout: 20_000 });
    await expect(page.getByPlaceholder(/账号|Account/)).toBeVisible({
      timeout: 20_000
    });
    await expect(page.locator(".lock-screen")).toHaveCount(0);
  });
});
