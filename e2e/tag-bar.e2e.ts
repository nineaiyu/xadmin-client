import { expect, test, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 标签栏右键菜单：完整项展示（含此前被 slice(0, 6) 截断的「内容区全屏」）、
 * 右键「固定标签」（固定后不参与关闭全部）与「新窗口打开」。
 */

/** 打开两个动态标签，返回二者的标题文本 */
async function openTwoTabs(page: Page) {
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  await openMenuPath(page, ["系统管理"], "/system/menu/index");
  const tabs = page.locator(".tags-view .scroll-item");
  await expect(tabs).toHaveCount(3, { timeout: 15_000 }); // 首页 + 用户管理 + 菜单管理
  return tabs;
}

test.describe("标签栏右键菜单", () => {
  test("菜单项完整（内容区全屏可见），固定标签后不参与关闭全部", async ({
    page
  }) => {
    await login(page);
    const tabs = await openTwoTabs(page);

    // 右键第二个标签（用户管理，非当前激活）
    await tabs.nth(1).click({ button: "right" });
    const menu = page.locator(".contextmenu");
    await expect(menu).toBeVisible({ timeout: 10_000 });
    // 第 7 项「内容区全屏」此前被 slice(0, 6) 截断，必须可见
    await expect(menu).toContainText(/内容区全屏|Content FullScreen/);
    await expect(menu).toContainText(/固定标签|Pin Tab/);
    await expect(menu).toContainText(/新窗口打开|Open in new window/);

    // 固定该标签：标签获得 fixed-tag 标记（关闭按钮消失），且不被「关闭全部」清掉
    await menu.getByText(/固定标签|Pin Tab/).click();
    await expect(tabs.nth(1)).toHaveClass(/fixed-tag/, { timeout: 10_000 });
    await expect(
      tabs.nth(1).locator(".el-icon-close, .chrome-close-btn")
    ).toHaveCount(0);

    await tabs.nth(2).click({ button: "right" });
    await expect(menu).toBeVisible({ timeout: 10_000 });
    await menu.getByText(/关闭全部标签页|Close AllTabs/).click();
    await expect(tabs).toHaveCount(2, { timeout: 10_000 }); // 首页 + 被固定的用户管理
    await expect(tabs.nth(1)).toHaveClass(/fixed-tag/);
  });

  test("新窗口打开：以当前标签路径打开新页签", async ({ page, context }) => {
    await login(page);
    const tabs = await openTwoTabs(page);
    await tabs.nth(1).click({ button: "right" });
    const menu = page.locator(".contextmenu");
    await expect(menu).toBeVisible({ timeout: 10_000 });

    const popupPromise = context.waitForEvent("page", { timeout: 10_000 });
    await menu.getByText(/新窗口打开|Open in new window/).click();
    const popup = await popupPromise;
    expect(popup.url()).toContain("/system/user/index");
    await popup.close();
  });
});
