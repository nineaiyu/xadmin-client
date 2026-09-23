import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * Passkey（F-9）浏览器侧链路 E2E：CDP 虚拟认证器走完
 * `navigator.credentials.create` → 服务端验签 → 落库 → 列表回显 → 删除。
 *
 * 仅 chromium：虚拟认证器依赖 CDP（`WebAuthn.enable` / `WebAuthn.addVirtualAuthenticator`），
 * webkit 无对应通道；真实认证器依赖系统级凭据（本地不可编程），登录侧
 * `navigator.credentials.get` 与后端验签同源，仍由后端用例覆盖（ADR-052 §5）。
 */
test.describe("Passkey 凭据", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "CDP 虚拟认证器仅 chromium 可用"
  );

  test("注册 → 列表回显 → 删除（虚拟认证器）", async ({ page, context }) => {
    const client = await context.newCDPSession(page);
    await client.send("WebAuthn.enable");
    const { authenticatorId } = await client.send(
      "WebAuthn.addVirtualAuthenticator",
      {
        options: {
          protocol: "ctap2",
          transport: "usb",
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true
        }
      }
    );
    expect(authenticatorId).toBeTruthy();

    // 双浏览器共享库：名称唯一 + 用例末尾删除，保证重复运行幂等
    const credentialName = `E2E-Passkey-${Date.now()}`;
    await login(page);
    await page.goto("/#/settings/security/index");

    const tabs = page.locator(".el-tabs--border-card").first();
    const passkeyTab = tabs.getByRole("tab", { name: "Passkey 凭据" });
    await expect(passkeyTab).toBeVisible({ timeout: 15_000 });
    await passkeyTab.click();
    const pane = tabs.getByRole("tabpanel", { name: "Passkey 凭据" });

    await pane.getByRole("button", { name: "添加 Passkey" }).click();
    const nameBox = page.locator(".el-message-box").last();
    await nameBox.locator("input").fill(credentialName);
    await nameBox.getByRole("button", { name: "确定" }).click();

    // 服务端验签通过（passkey.registerSuccess）→ 列表回显该凭据
    await expect(page.getByText("Passkey 绑定成功").last()).toBeVisible({
      timeout: 20_000
    });
    const row = pane.locator(".el-table__row", { hasText: credentialName });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // 删除（二次确认）→ 行消失（幂等收尾）
    await row.getByRole("button", { name: "删除" }).click();
    const confirmBox = page.locator(".el-message-box").last();
    await confirmBox.getByRole("button", { name: "确定" }).click();
    await expect(
      pane.locator(".el-table__row", { hasText: credentialName })
    ).toHaveCount(0, { timeout: 15_000 });
  });
});
