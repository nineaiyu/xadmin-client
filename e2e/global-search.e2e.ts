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
  // 跳转携带承接字段 query（用户分组 search_field=username），列表页
  // （RePlusPage 的 route.query → 搜索默认值装配）直接过滤到命中行
  await expect(page).toHaveURL(/#\/system\/user\/index\?username=e2e_user/, {
    timeout: 15_000
  });
  await expect(page.locator(".el-table__row").first()).toBeVisible({
    timeout: 15_000
  });
  await expect(page.locator(".el-table__row")).toHaveCount(1, {
    timeout: 15_000
  });
});

test("全局搜索：无命中时不展示分组结果", async ({ page }) => {
  await login(page);
  await page.locator("#header-search").first().click();
  const input = page.locator(".pure-search-dialog input").first();
  await input.fill("__no_such_keyword__");
  await expect(page.getByTestId("global-search-item-user")).toHaveCount(0);
});

test("问 AI：搜索词直达 AI 控制台（可用时预填输入框）", async ({ page }) => {
  await login(page);
  await page.locator("#header-search").first().click();
  const input = page.locator(".pure-search-dialog input").first();
  await input.fill("如何配置数据权限");

  // 无命中也有「问 AI」出口（权限同问答入口；未命中不再显示空态）
  const askEntry = page.getByTestId("ask-ai-entry");
  await expect(askEntry).toBeVisible({ timeout: 10_000 });
  await expect(askEntry).toContainText("如何配置数据权限");

  await askEntry.click();
  await expect(page).toHaveURL(/#\/integration\/ai\/index/, {
    timeout: 15_000
  });
  // AI 已启用且已配置时输入框可见且预填（未启用时页面显示引导占位，
  // 强断言版本见 ai.e2e.ts——该文件首个用例会开启全局开关）
  const askInput = page.getByTestId("ai-ask-input");
  if (await askInput.isVisible()) {
    await expect(askInput).toHaveValue("如何配置数据权限");
  }
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
  // 选中态以 data-active 判定（高亮样式类是设计令牌，会随主题体系改名漂移）
  await page.keyboard.press("ArrowUp");
  const homeAction = page.getByTestId("command-home");
  await expect(homeAction).toHaveAttribute("data-active", "true");

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/welcome/, { timeout: 10_000 });
  await expect(palette).toBeHidden();
});
