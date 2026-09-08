import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * MFA 功能入口回归：
 * 1. 系统设置→安全设置：MFA tab 正常渲染（menu.json 缺失对应权限码时空白页的
 *    回归），且 MFA「验证方式」渲染为带候选值的多选下拉（ListField
 *    child.choices，而非 TagInput 手动输入）
 * 2. 系统设置→基本设置：资源告警 tab 渲染阈值字段（资源告警已从安全设置迁移）
 * 3. 右上角账户设置页（/account-settings）包含「MFA 安全」面板（复用个人中心
 *    OTP 绑定组件）
 * 4. 个人中心包含「MFA 安全」tab，可进入 OTP 绑定
 * 5. 用户管理行操作「…」下拉包含「重置MFA」（缺失 resetMfa:SystemUser 权限码
 *    时按钮隐藏的回归）
 *
 * 注意：安全设置页的 el-tabs 为 border-card 类型，以此与右上角 lay-notice
 * 内的 tabs 区分，避免 tabpanel 断言命中两套 DOM 导致 strict violation。
 */

test.describe("MFA 功能入口", () => {
  test("安全设置：MFA tab 渲染且验证方式为多选下拉", async ({ page }) => {
    await login(page);
    await page.goto("/#/settings/security/index");

    const tabs = page.locator(".el-tabs--border-card").first();
    const mfaTab = tabs.getByRole("tab", { name: "MFA 二次验证配置" });
    await expect(mfaTab).toBeVisible({ timeout: 15_000 });
    await mfaTab.click();

    const mfaPane = tabs.getByRole("tabpanel", {
      name: "MFA 二次验证配置"
    });
    await expect(mfaPane.getByRole("button", { name: "保存" })).toBeVisible();

    // 验证方式：带候选值的多选下拉（otp/sms/email/password）
    const methodSelect = mfaPane.locator(".el-select").first();
    await expect(methodSelect).toBeVisible();
    await methodSelect.click();
    const visibleDropdown = page.locator(".el-select-dropdown:visible");
    await expect(
      visibleDropdown.getByText("OTP 动态验证码", { exact: true })
    ).toBeVisible();
    await expect(
      visibleDropdown.getByText("登录密码", { exact: true })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("基本设置：资源告警 tab 渲染阈值字段", async ({ page }) => {
    await login(page);
    // 基本设置菜单路径为 /settings/basic（无 /index 后缀，见 loadjson menu.json）
    await page.goto("/#/settings/basic");

    const monitorTab = page.getByRole("tab", { name: "资源告警" });
    await expect(monitorTab).toBeVisible({ timeout: 15_000 });
    await monitorTab.click();
    const monitorPane = page.getByRole("tabpanel", { name: "资源告警" });
    await expect(monitorPane.getByText("磁盘使用率阈值（%）")).toBeVisible();
    await expect(monitorPane.getByText("CPU 负载阈值（单核）")).toBeVisible();
    await expect(
      monitorPane.getByRole("button", { name: "保存" })
    ).toBeVisible();
  });

  test("账户设置：包含 MFA 安全面板", async ({ page }) => {
    await login(page);
    await page.goto("/#/account-settings");

    const mfaItem = page.getByRole("menuitem", { name: "MFA 安全" });
    await expect(mfaItem).toBeVisible({ timeout: 15_000 });
    await mfaItem.click();
    await expect(page.getByRole("button", { name: "绑定 OTP" })).toBeVisible();
  });

  test("个人中心：包含 MFA 安全 tab", async ({ page }) => {
    await login(page);
    await page.goto("/#/user/info/index");

    const mfaTab = page.getByRole("tab", { name: "MFA 安全" }).first();
    await expect(mfaTab).toBeVisible({ timeout: 15_000 });
    await mfaTab.click();
    await expect(page.getByRole("button", { name: "绑定 OTP" })).toBeVisible();
  });

  test("用户管理：行操作下拉包含重置MFA", async ({ page }) => {
    await login(page);
    await page.goto("/#/system/user/index");
    const table = page.locator(".el-table").first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const lastRow = page.locator(".el-table__body-wrapper tr").last();
    const moreButton = lastRow.locator("button", { hasText: /…|⋯/ }).first();
    if (await moreButton.count()) {
      await moreButton.click();
    } else {
      await lastRow.locator(".el-button").last().click();
    }
    await expect(
      page.locator(".el-dropdown-menu:visible").getByText("重置MFA")
    ).toBeVisible();
  });
});
