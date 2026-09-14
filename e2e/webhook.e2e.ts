import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 出站 Webhook 主链路：
 * 建订阅（指向不可达地址）→ test 动作派发 ping → 投递审计页出现失败记录。
 * 签名/成功路径/重试退避由后端集成测试以进程内接收端覆盖。
 */

test("Webhook 订阅与投递审计主链路", async ({ page }) => {
  await login(page);

  // ---- 建订阅（指向不可达端口，触发失败路径） ----
  await openMenuPath(page, ["集成管理"], "/integration/subscription/index");
  await expect(page.getByTestId("webhook-table")).toBeVisible({
    timeout: 15_000
  });

  await page.getByRole("button", { name: "新建订阅" }).click();
  const dialog = page.locator(".el-dialog").filter({ hasText: "新建订阅" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("名称").fill("E2E外部系统");
  await dialog.getByLabel("地址").fill("http://127.0.0.1:9/hook");
  await dialog.getByLabel("签名密钥", { exact: false }).fill("e2e-secret");
  await pickOption(page, "订阅事件", "连接测试");
  await dialog.getByRole("button", { name: "确认" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByTestId("webhook-table").getByText("E2E外部系统")
  ).toBeVisible();

  // ---- 测试动作：派发 ping（不可达 → 投递失败） ----
  const subRow = page.getByRole("row", { name: /E2E外部系统/ });
  await subRow.getByRole("button", { name: "测试" }).click();
  await expect(page.getByText("测试事件已派发").first()).toBeVisible();

  // ---- 投递审计页：失败记录可见（指数退避重试中） ----
  await openMenuPath(page, ["集成管理"], "/integration/delivery/index");
  await expect(page.getByTestId("webhook-delivery-table")).toBeVisible({
    timeout: 15_000
  });
  const deliveryRow = page
    .getByTestId("webhook-delivery-table")
    .getByRole("row", { name: /E2E外部系统/ })
    .first();
  await expect(deliveryRow).toBeVisible({ timeout: 20_000 });
  await expect(deliveryRow.getByText(/failed|exhausted/)).toBeVisible();
});

/** el-select 选项选择（多选场景选完不关闭弹窗） */
async function pickOption(page: Page, formLabel: string, optionText: string) {
  await page
    .locator(`.el-dialog .el-form-item:has-text('${formLabel}') .el-select`)
    .first()
    .click();
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
      hasText: optionText
    })
    .first()
    .click();
  await page.keyboard.press("Escape");
}
