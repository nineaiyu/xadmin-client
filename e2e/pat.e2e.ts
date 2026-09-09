import { expect, test } from "@playwright/test";

import { BACKEND_URL, login } from "./helpers";

/**
 * 个人访问令牌（PAT）全流程：
 * 个人中心创建 token（明文仅展示一次）→ `Authorization: Pat <token>` 调 API 200
 * → UI 吊销 → 同凭证 401（服务端即时失效）。
 */

test("访问令牌：创建 → Pat 头调 API → 吊销后 401", async ({ page }) => {
  await login(page);
  await page.goto("/#/account-settings");
  // 进入「访问令牌」页签
  await page.locator(".el-menu-item", { hasText: "访问令牌" }).first().click();

  // 创建令牌：明文弹窗仅展示一次
  const tokenName = `e2e-pat-${Date.now()}`;
  await page
    .locator(".el-form-item", { hasText: "令牌名称" })
    .first()
    .locator("input")
    .first()
    .fill(tokenName);
  await page.getByRole("button", { name: "创建令牌" }).first().click();
  const tokenDialog = page
    .locator(".el-dialog", { hasText: "令牌创建成功" })
    .first();
  await expect(tokenDialog).toBeVisible({ timeout: 15_000 });
  const codeBlock = tokenDialog.locator("code").first();
  await expect(codeBlock).toBeVisible();
  const plainToken = (await codeBlock.textContent()) ?? "";
  expect(plainToken.startsWith("pat_")).toBeTruthy();

  // 关闭弹窗（明文不可再见），列表出现该令牌（仅前缀）
  await page.keyboard.press("Escape");
  await expect(tokenDialog).not.toBeVisible({ timeout: 10_000 });
  const row = page.locator(".el-table__row", { hasText: tokenName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  // Pat 头调 API：200（权限与账号一致）
  const listResponse = await page.request.get(
    `${BACKEND_URL}/api/system/personal-access-tokens`,
    { headers: { Authorization: `Pat ${plainToken}` } }
  );
  expect(listResponse.status()).toBe(200);

  // UI 吊销（确认弹层「确定」）→ 同凭证立即 401
  await row.getByRole("button", { name: "吊销" }).first().click();
  const confirm = page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  }
  await expect(row).toContainText("禁用", { timeout: 15_000 });

  const revokedResponse = await page.request.get(
    `${BACKEND_URL}/api/system/personal-access-tokens`,
    { headers: { Authorization: `Pat ${plainToken}` } }
  );
  expect(revokedResponse.status()).toBe(401);
});
