import { expect, test, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 标签栏右键菜单：完整项展示（含此前被 slice(0, 6) 截断的第 7 项）、
 * 右键「固定标签」（固定后不参与关闭全部）、「最大化 / 还原」与「新窗口打开」。
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
  test("菜单项完整（最大化可见），固定标签后不参与关闭全部", async ({
    page
  }) => {
    await login(page);
    const tabs = await openTwoTabs(page);

    // 右键第二个标签（用户管理，非当前激活）
    await tabs.nth(1).click({ button: "right" });
    const menu = page.locator(".contextmenu");
    await expect(menu).toBeVisible({ timeout: 10_000 });
    // 第 7 项此前被 slice(0, 6) 截断，必须可见
    await expect(menu).toContainText(/最大化|Maximize/);
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

  test("最大化 / 还原：隐藏顶栏与侧栏，菜单文案随态切换", async ({ page }) => {
    await login(page);
    const tabs = await openTwoTabs(page);
    const menu = page.locator(".contextmenu");

    await tabs.nth(1).click({ button: "right" });
    await expect(menu).toBeVisible({ timeout: 10_000 });
    await menu.getByText(/最大化|Maximize/).click();

    // 顶栏与侧栏一起隐藏，内容区占满（main-hidden 扩展 + fixed-header 撑满）
    await expect(page.locator(".main-container")).toHaveClass(/main-hidden/, {
      timeout: 10_000
    });
    await expect(page.locator(".fixed-header .navbar")).toBeHidden();
    await expect(page.locator(".sidebar-container")).toBeHidden();

    // 页签条保留（还原入口），菜单文案切到「还原」
    await expect(tabs).toHaveCount(3);
    await tabs.nth(2).click({ button: "right" });
    await expect(menu).toBeVisible({ timeout: 10_000 });
    await menu.getByText(/还原|Restore/).click();

    await expect(page.locator(".main-container")).not.toHaveClass(
      /main-hidden/,
      { timeout: 10_000 }
    );
    await expect(page.locator(".fixed-header .navbar")).toBeVisible();
    await expect(page.locator(".sidebar-container")).toBeVisible();
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
