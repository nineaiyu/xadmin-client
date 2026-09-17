import { expect, test, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 出站 Webhook 主链路：
 * 建订阅（指向不可达地址）→ test 动作派发 ping → 投递审计页出现失败记录。
 * 签名/成功路径/重试退避由后端集成测试以进程内接收端覆盖。
 */

test("Webhook 订阅与投递审计主链路", async ({ page }) => {
  await login(page);

  // 名称唯一约束（WebhookSubscription.name unique）+ 双浏览器共享同一 sqlite 库：
  // 固定名字会让后跑的浏览器撞唯一约束（同 dashboard/analysis 的既有教训，见 e2e/README）
  const subName = `E2E外部系统-${Math.random().toString(36).slice(2, 8)}`;

  // ---- 建订阅（指向不可达端口，触发失败路径） ----
  await openMenuPath(page, ["集成管理"], "/integration/subscription/index");
  // RePlusPage 列表以工具栏按钮为加载锚点（表格行需等种子/新建数据）
  await expect(page.getByRole("button", { name: "新建订阅" })).toBeVisible({
    timeout: 15_000
  });

  await page.getByRole("button", { name: "新建订阅" }).click();
  const dialog = page.locator(".el-dialog").filter({ hasText: "新建订阅" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("名称").fill(subName);
  await dialog.getByLabel("地址").fill("http://127.0.0.1:9/hook");
  await dialog.getByLabel("签名密钥", { exact: false }).fill("e2e-secret");
  await pickOption(page, "订阅事件", "连接测试");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible();
  const subRow = page.getByRole("row", { name: subName });
  await expect(subRow).toBeVisible({ timeout: 15_000 });

  // ---- 测试动作：派发 ping（不可达 → 投递失败） ----
  await subRow.getByRole("button", { name: "测试" }).click();
  await expect(page.getByText("测试事件已派发").first()).toBeVisible();

  // ---- 投递审计页：失败记录可见（指数退避重试中） ----
  await openMenuPath(page, ["集成管理"], "/integration/delivery/index");
  const deliveryRow = page.getByRole("row", { name: subName }).first();
  await expect(deliveryRow).toBeVisible({ timeout: 20_000 });
  // 状态列为 LabeledChoiceField：渲染中文 label。必须用锚定正则精确匹配 tag 文本——
  // 宽容的 /failed/i 会同时命中 response_body 里的 "Failed to establish a new
  // connection"（strict mode violation）
  await expect(deliveryRow.getByText(/^(失败（重试中）|已耗尽)$/)).toBeVisible({
    timeout: 15_000
  });
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
