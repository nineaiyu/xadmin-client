import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 系统设置信息架构：通知渠道与消息订阅分离，登录安全与账号安全分离。
 * 只验收页签归属，不触碰表单数据。
 */
test.describe("系统设置归类", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("渠道配置独立成「通知渠道」，消息通知只保留订阅与模板", async ({
    page
  }) => {
    await openMenuPath(page, ["系统设置"], "/settings/message");
    await expect(
      page.getByRole("tab", { name: "系统消息订阅", exact: true })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("tab", { name: "消息模板", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "钉钉", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("tab", { name: "邮件服务器", exact: true })
    ).toHaveCount(0);

    await openMenuPath(page, ["系统设置"], "/settings/channel");
    for (const name of [
      "邮件服务器",
      "钉钉",
      "企业微信",
      "飞书",
      "Webhook 通知"
    ]) {
      await expect(page.getByRole("tab", { name, exact: true })).toBeVisible({
        timeout: 15_000
      });
    }
  });

  test("登录安全与账号安全按账号生命周期拆分", async ({ page }) => {
    await openMenuPath(page, ["系统设置"], "/settings/security/index");
    for (const name of ["登录安全配置", "登录限制配置", "MFA 二次验证配置"]) {
      await expect(page.getByRole("tab", { name, exact: true })).toBeVisible({
        timeout: 15_000
      });
    }
    await expect(
      page.getByRole("tab", { name: "注册安全配置", exact: true })
    ).toHaveCount(0);

    await openMenuPath(page, ["系统设置"], "/settings/account-security");
    for (const name of [
      "注册安全配置",
      "重置密码配置",
      "密码规则配置",
      "绑定邮箱配置",
      "绑定手机配置",
      "邮件/短信验证码"
    ]) {
      await expect(page.getByRole("tab", { name, exact: true })).toBeVisible({
        timeout: 15_000
      });
    }
  });

  test("短信生效诊断只出现在「短信设置」页签，不混入服务商页签", async ({
    page
  }) => {
    await openMenuPath(page, ["系统设置"], "/settings/sms");

    const serverPanel = page.getByRole("tabpanel", { name: "短信设置" });
    await expect(
      serverPanel.getByTestId("setting-effective").first()
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("tab", { name: "阿里云短信", exact: true }).click();
    const backendPanel = page.getByRole("tabpanel", { name: "阿里云短信" });
    await expect(backendPanel.getByTestId("setting-effective")).toHaveCount(0);
  });
});
