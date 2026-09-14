import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * 全局搜索：顶栏搜索弹窗在菜单结果之外给出跨实体分组结果，
 * 点击分组项跳转到对应页面。种子数据含 e2e_user（普通用户），超管可检索到。
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
