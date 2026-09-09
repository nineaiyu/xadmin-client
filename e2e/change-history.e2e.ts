import { expect, test } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 行级变更历史（用户管理，object_pk 回溯操作日志）：
 * API 建用户 → UI 编辑昵称（AUDIT_DIFF_MODELS 含 system.UserInfo，E2E settings 已开）
 * → 行按钮「变更历史」弹窗含本次修改的字段级 diff。
 */

test("变更历史：编辑用户后行按钮弹窗展示字段级 diff", async ({ page }) => {
  await login(page);

  // API 直接建用户（create 权限走超管 JWT），避免 UI 新增的长链路
  const username = `e2e_hist_${Date.now()}`;
  const token = await getAccessToken(page);
  const createResponse = await page.request.post(
    `${BACKEND_URL}/api/system/user`,
    {
      data: {
        username,
        nickname: "变更历史原昵称",
        password: "E2E-Hist-2026!"
      },
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  expect(createResponse.status()).toBe(200);
  const created = (await createResponse.json()) as {
    data: { pk: string | number };
  };
  const userPk = created.data.pk;
  expect(userPk).toBeTruthy();

  await openMenuPath(page, ["系统管理"], "/system/user/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });

  // 打开该行的编辑弹层（行内「编辑」按钮），修改昵称并保存
  const row = page.locator(".el-table__row", { hasText: username }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole("button", { name: "编辑" }).first().click();
  const editDialog = page.locator(".el-dialog", { hasText: "编辑" }).first();
  await expect(editDialog).toBeVisible();
  const nicknameInput = editDialog
    .locator(".el-form-item", { hasText: "昵称" })
    .first()
    .locator("input")
    .first();
  await nicknameInput.fill("变更历史新昵称");
  await editDialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await expect(editDialog).not.toBeVisible({ timeout: 15_000 });

  // 行按钮「变更历史」：弹窗含本次 PATCH 记录与字段级 diff（old → new）
  await row.getByRole("button", { name: "变更历史" }).first().click();
  const historyDialog = page
    .locator(".el-dialog", { hasText: "变更历史" })
    .first();
  await expect(historyDialog).toBeVisible({ timeout: 15_000 });
  await expect(historyDialog).toContainText("变更历史新昵称");
  await expect(historyDialog).toContainText("变更历史原昵称");
});
