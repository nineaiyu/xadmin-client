import { expect, test } from "@playwright/test";

import { FRONT_URL, login, openMenuPath } from "./helpers";

/**
 * 请假申请（ADR-032）：审批流引擎接入的第一个真实业务页面。
 *
 * 覆盖：菜单可达 → 元数据列与字典标签渲染 → 行内「提交审批/撤回」按钮随状态显隐 →
 * 新增弹窗字段齐全 → 删除清理。
 *
 * 数据经同源接口创建（携带会话 Cookie）：E2E 超管 xadmin 没有所属部门（种子未配），
 * 请假流程首节点是「部门负责人」，故提交会被引擎 fail-closed 拒绝并保留草稿——
 * 这本身就是要断言的业务语义（不静默直通、不丢用户数据），用例据此断言草稿态。
 */
test("请假申请：列表渲染、状态按钮与删除清理", async ({ page }) => {
  await login(page);

  const reason = `E2E请假事由-${Date.now()}`;
  const created = await page.request.post(`${FRONT_URL}/api/system/leaves`, {
    data: {
      leave_type: "annual",
      start_date: "2026-12-01",
      end_date: "2026-12-02",
      days: "2.0",
      reason
    }
  });
  const payload = await created.json();
  expect(payload.code, `create leave: ${JSON.stringify(payload)}`).toBe(1000);
  expect(payload.data.status.value).toBe("DRAFT");

  try {
    await openMenuPath(page, ["系统管理"], "/system/leave/index");
    const table = page.locator(".el-table").first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // 列来自后端 search-columns 元数据，标签走前端 i18n（locale-name=leaveApply）
    await expect(
      table.getByRole("columnheader", { name: "请假类型" })
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "当前节点" })
    ).toBeVisible();

    const row = page.getByRole("row", { name: new RegExp(reason) });
    await expect(row).toBeVisible();
    // 状态列：数据字典 leave_status 驱动的彩色标签
    await expect(row.locator(".el-tag", { hasText: "草稿" })).toBeVisible();
    // 草稿行给「提交审批」、不给「撤回」
    await expect(row.getByRole("button", { name: "提交审批" })).toBeVisible();
    await expect(row.getByRole("button", { name: "撤回" })).toHaveCount(0);

    // 新增弹窗：请假类型为字典下拉、事由为多行文本域、起止日期与天数为必填项
    await page.getByRole("button", { name: "新增" }).first().click();
    const dialog = page.locator(".el-dialog");
    await expect(dialog).toBeVisible();
    for (const label of [
      "请假类型",
      "开始日期",
      "结束日期",
      "请假天数",
      "请假事由"
    ]) {
      await expect(
        dialog.locator(".el-form-item", { hasText: label }).first()
      ).toBeVisible();
    }
    await expect(
      dialog.locator(".el-form-item:has-text('请假类型') .el-select").first()
    ).toBeVisible();
    await expect(
      dialog.locator(".el-form-item:has-text('请假事由') textarea").first()
    ).toBeVisible();
    await dialog.getByRole("button", { name: "取消" }).click();
    await expect(dialog).not.toBeVisible();

    // 删除（行内按钮 + 二次确认）
    await row.getByRole("button", { name: "删除" }).first().click();
    await page
      .locator(".el-popconfirm, .el-popper, .el-message-box")
      .getByRole("button", { name: "确定" })
      .first()
      .click();
    await expect(page.getByText(reason)).toHaveCount(0);
  } finally {
    // 兜底清理：UI 删除未生效时不残留用例数据
    const listed = await page.request.get(
      `${FRONT_URL}/api/system/leaves?reason=${encodeURIComponent(reason)}`
    );
    const listedPayload = await listed.json();
    for (const item of listedPayload?.data?.results ?? []) {
      await page.request.delete(`${FRONT_URL}/api/system/leaves/${item.pk}`);
    }
  }
});
