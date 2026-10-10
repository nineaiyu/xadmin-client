import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 全局搜索 / 命令面板：顶栏搜索弹窗在菜单结果之外给出跨实体分组结果，
 * 点击分组项跳转到对应页面；无关键字时切换为命令面板（快捷键唤起 +
 * ↑↓/Enter 键盘导航 + 底部快捷键提示）。种子数据含 e2e_user（普通用户），超管可检索到。
 */

test("全局搜索：顶栏入口检索用户并跳转到用户管理", async ({ page }) => {
  await login(page);
  await page.locator("#header-search").first().click();
  const input = page.locator(".pure-search-dialog input").first();
  await input.fill("e2e_user");

  const userItem = page.getByTestId("global-search-item-user").first();
  await expect(userItem).toBeVisible({ timeout: 15_000 });
  await expect(userItem).toContainText("e2e_user");

  await userItem.click();
  await expect(page).toHaveURL(/#\/system\/user\/index/, { timeout: 15_000 });
});

test("全局搜索：无命中时不展示分组结果", async ({ page }) => {
  await login(page);
  await page.locator("#header-search").first().click();
  const input = page.locator(".pure-search-dialog input").first();
  await input.fill("__no_such_keyword__");
  await expect(page.getByTestId("global-search-item-user")).toHaveCount(0);
});

test("命令面板：Ctrl+K 唤起、↑↓ 移动指针、Enter 执行快捷动作", async ({
  page
}) => {
  await login(page);
  // 先离开首页：Enter 执行「返回首页」后地址变化可判定
  await openMenuPath(page, ["系统管理"], "/system/user/index");

  await page.keyboard.press("Control+k");
  const palette = page.getByTestId("command-palette");
  await expect(palette).toBeVisible({ timeout: 10_000 });
  await expect(palette).toContainText(/快捷动作|Quick actions/);
  // 底部快捷键提示（确定 / 切换 / 关闭）
  await expect(page.locator(".search-footer")).toContainText(/确定|Sure/);
  await expect(page.locator(".search-footer")).toContainText(/切换|Switch/);

  // 初始无选中态：↑ 直接落到最后一个动作「返回首页」，高亮随指针移动
  await page.keyboard.press("ArrowUp");
  const homeAction = page.getByTestId("command-home");
  await expect(homeAction).toHaveClass(/bg-\[#f5f5f5\]/);

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/welcome/, { timeout: 10_000 });
  await expect(palette).toBeHidden();
});
