import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  ADMIN,
  PLAIN_USER,
  clickUserAction,
  login,
  openList,
  openUserPanel
} from "./helpers";

/**
 * 用户模拟 E2E：模拟 → 顶栏横幅 → 退出恢复身份（全链路 UI 验证）。
 *
 * 覆盖：
 * - 管理抽屉「模拟用户」动作（密码二次确认弹窗由 412 user_confirm_required 自动唤起，
 *   E2E 档固定关闭门禁时跳过）；
 * - 换签后整页刷新，顶栏出现「正在模拟用户」横幅（userinfo 下发 impersonator）；
 * - 模拟态下 token 即被模拟用户：菜单/权限按其身份重建；
 * - 退出恢复：顶栏横幅点击 / 头像下拉「退出模拟」两条路径均可退出。
 */
test.use({ viewport: { width: 1280, height: 1080 } });

/** 前置：以管理员登录并进入对 e2e_user 的模拟态（横幅可见） */
async function impersonatePlainUser(page: Page): Promise<Locator> {
  await login(page);

  await openList(page, "/system/user/index", {
    placeholder: "请输入用户名",
    value: PLAIN_USER.username
  });
  const row = page
    .locator(".el-table__row")
    .filter({ hasText: PLAIN_USER.username })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  // 管理抽屉 → 模拟用户 → 二次确认
  const panel = await openUserPanel(page, row);
  await clickUserAction(panel, "impersonate");
  const confirmBox = page
    .locator(".el-message-box")
    .filter({ hasText: "确认开始模拟" })
    .first();
  await expect(confirmBox).toBeVisible({ timeout: 10_000 });
  await confirmBox.getByRole("button", { name: "确定" }).click();

  // 敏感操作密码二次验证：后端开启 SECURITY_MFA_CONFIRM_ENABLED 时 412 自动唤起
  // ReMfaConfirm 弹窗；E2E 档固定关闭门禁（tests/settings_e2e.py），此处条件兼容
  const mfaDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "敏感操作确认" })
    .first();
  const dialogShown = await mfaDialog
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (dialogShown) {
    await mfaDialog.locator("input").first().fill(ADMIN.password);
    await mfaDialog.getByRole("button", { name: "确认验证" }).click();
  }

  // 换签成功后整页刷新：顶栏出现模拟横幅（以 e2e_user 身份使用后台）
  const banner = page.locator(".impersonation-banner");
  await expect(banner).toBeVisible({ timeout: 30_000 });
  await expect(banner).toContainText("正在模拟用户");
  await expect(banner).toContainText(PLAIN_USER.nickname);
  return banner;
}

test("用户模拟：进入模拟态出现横幅，点击横幅退出恢复", async ({ page }) => {
  const banner = await impersonatePlainUser(page);

  // 点击横幅退出模拟：整页刷新恢复管理员身份，横幅不再渲染
  await banner.click();
  await expect(banner).toHaveCount(0, { timeout: 30_000 });
});

test("用户模拟：头像下拉「退出模拟」同样可退出", async ({ page }) => {
  const banner = await impersonatePlainUser(page);

  // 右上角头像下拉出现「退出模拟」专属项（模拟态才渲染）
  await page.locator(".el-dropdown-link").first().click();
  const dropdownExit = page
    .locator(".el-dropdown-menu__item")
    .filter({ hasText: "退出模拟" })
    .first();
  await expect(dropdownExit).toBeVisible({ timeout: 10_000 });
  await dropdownExit.click();

  await expect(banner).toHaveCount(0, { timeout: 30_000 });
});
