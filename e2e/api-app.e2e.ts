import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 开放平台 API 应用：管理页新建应用 → 一次性密钥只展示一次。
 * 换发/限流/回调的服务端口径由 tests/integration/system/test_api_application.py 钉死。
 */

test("API 应用：新建应用并展示一次性密钥", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["集成管理"], "/integration/api-app/index");
  await expect(page.getByTestId("api-app-create")).toBeVisible({
    timeout: 15_000
  });

  await page.getByTestId("api-app-create").click();
  // 编辑弹窗按标题定位：页面存在多个「保存」按钮（弹窗外的配置面板），必须限定在弹窗内
  const createDialog = page.locator(".el-dialog", { hasText: "新建应用" });
  await createDialog.locator("input").first().fill("E2E 应用");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确定」）
  await createDialog.getByRole("button", { name: "保存" }).click();

  // 创建响应携带一次性明文密钥：弹窗立即展示（列表不回传明文）
  const credentialDialog = page.locator(".el-dialog", {
    hasText: "一次性密钥"
  });
  await expect(credentialDialog.locator("input").nth(1)).toHaveValue(/^aps_/, {
    timeout: 15_000
  });
  await page.getByRole("button", { name: "确定" }).last().click();
  await expect(page.getByText("E2E 应用").first()).toBeVisible();
});

/**
 * 接口范围勾选：与访问令牌同款勾选器（选项来自 `scope-options`，按本人权限收口）。
 *
 * 勾选即写入锚定正则，列表列只显示条数（条目明细在 tooltip 里还原为可读路径）——
 * 本用例只钉住「能勾、能存、列表条数正确」，scope 的放行/拦截行为由
 * tests/integration/system/test_api_application.py 钉死。
 */
test("API 应用：接口范围勾选后列表显示条数", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["集成管理"], "/integration/api-app/index");
  await expect(page.getByTestId("api-app-create")).toBeVisible({
    timeout: 15_000
  });

  const name = `E2E 范围应用 ${Date.now()}`;
  await page.getByTestId("api-app-create").click();
  const createDialog = page.locator(".el-dialog", { hasText: "新建应用" });
  await createDialog.getByTestId("api-app-name").fill(name);
  // 选项按本人权限异步下发：等加载遮罩消失再展开下拉（否则点击会被遮罩吃掉）
  await expect(createDialog.locator(".el-loading-mask")).toHaveCount(0, {
    timeout: 15_000
  });
  await createDialog.getByTestId("api-scope-select").click();
  const firstOption = page.locator(".el-select-dropdown__item:visible").first();
  await expect(firstOption).toBeVisible({ timeout: 15_000 });
  await firstOption.click();
  await page.keyboard.press("Escape");
  await createDialog.getByRole("button", { name: "保存" }).click();

  // 创建成功先弹一次性密钥（列表不回传明文），关闭后回到列表看接口范围列
  const credentialDialog = page.locator(".el-dialog", {
    hasText: "一次性密钥"
  });
  await expect(credentialDialog).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "确定" }).last().click();

  const row = page.locator(".el-table__row", { hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText("接口范围：1 条", { timeout: 15_000 });
});
