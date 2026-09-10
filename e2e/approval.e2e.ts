import { expect, test, type Page } from "@playwright/test";

import { AesEncrypted } from "../src/utils/aes";

import {
  APPROVER,
  BACKEND_URL,
  FRONT_URL,
  getAccessToken,
  login,
  openMenuPath
} from "./helpers";

/**
 * 敏感操作审批 E2E：开启拦截 → 管理员删除用户 → 提示已提交审批（1002）→
 * 审批人（第二超管，申请人不能自审）在审批中心通过 → 管理员重发删除成功。
 *
 * 拦截由 APPROVAL_REQUIRED_PATHS 系统配置控制（默认空 = 休眠）：用例内经
 * 系统配置 API 开启，finally 复位，避免污染其他用例的删除链路。
 * 一次性通行令牌由前端 http 层暂存并在重发时自动携带（X-Approval-Id）。
 */

const APPROVAL_PATHS_CONFIG_PK = "e9a6b7c8-d9e0-4f1a-9b2c-3d4e5f6a7b0f";

async function setApprovalPaths(page: Page, token: string, paths: string[]) {
  // router 为 trailing_slash=False：detail 路由不能带尾斜杠（否则 Django 404 HTML 页）
  const response = await page.request.patch(
    `${BACKEND_URL}/api/system/config/system/${APPROVAL_PATHS_CONFIG_PK}`,
    { headers: { Authorization: `Bearer ${token}` }, data: { value: paths } }
  );
  expect(response.ok(), await response.text()).toBeTruthy();
}

test("敏感操作审批：删除用户 → 提交审批 → 审批中心通过 → 重发成功", async ({
  page
}) => {
  const username = `e2e_approve_u_${Date.now()}`;
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };

  try {
    // 开启审批拦截（仅用户详情 DELETE；批量销毁同挂拦截点）
    await setApprovalPaths(page, token, ["^/api/system/user/[^/]+$"]);

    // API 创建待删除用户
    const created = await page.request.post(`${BACKEND_URL}/api/system/user`, {
      headers,
      data: {
        username,
        nickname: username,
        password: AesEncrypted(username, "E2E-Approve-2026!")
      }
    });
    expect(created.ok(), await created.text()).toBeTruthy();

    // 用户管理页行删除 → popconfirm 确认
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    const table = page.locator(".el-table").first();
    await expect(table).toBeVisible({ timeout: 15_000 });
    const row = page.locator(".el-table__row", { hasText: username }).first();
    await row.waitFor({ state: "visible", timeout: 15_000 });
    await row.getByRole("button", { name: "删除" }).first().click();
    await page
      .locator(".el-popconfirm, .el-popper, .el-message-box")
      .getByRole("button", { name: "确定" })
      .first()
      .click();

    // 1002 提示：已提交审批，行仍在（业务未执行）；从提示提取单号（pk 前 8 位）
    const approvalMsg = page.locator(".el-message").first();
    await expect(approvalMsg).toBeVisible({ timeout: 10_000 });
    await expect(approvalMsg).toContainText("已提交审批");
    const approvalNo = ((await approvalMsg.innerText()).match(
      /[0-9a-f]{8}/i
    ) ?? [""])[0].toLowerCase();
    expect(approvalNo).not.toBe("");
    await expect(
      page.locator(".el-table__row", { hasText: username }).first()
    ).toBeVisible({ timeout: 10_000 });

    // 审批人（第二超管）在审批中心通过：申请人 xadmin 不能自审。
    // 通过后该单离开「待我审批」（scope=pending 仅 PENDING），断言行消失
    const browser = page.context().browser();
    const contextB = await browser!.newContext({
      baseURL: FRONT_URL,
      locale: "zh-CN"
    });
    const pageB = await contextB.newPage();
    await login(pageB, APPROVER);
    await openMenuPath(pageB, ["系统管理"], "/system/approval/index");
    const approvalTable = pageB.locator(".el-table").first();
    await expect(approvalTable).toBeVisible({ timeout: 15_000 });
    const approvalRow = pageB
      .locator(".el-table__row", { hasText: approvalNo })
      .first();
    await approvalRow.waitFor({ state: "visible", timeout: 15_000 });
    await approvalRow.getByRole("button", { name: "通过" }).first().click();
    await pageB
      .locator(".el-popconfirm, .el-popper, .el-message-box")
      .getByRole("button", { name: "确定" })
      .first()
      .click();
    await expect(
      pageB.locator(".el-table__row", { hasText: approvalNo })
    ).toHaveCount(0, { timeout: 15_000 });
    await contextB.close();

    // 申请人等「审批通过」WS 通知弹窗（5s 自动关闭）消失后再重发
    await page
      .locator(".el-notification")
      .first()
      .waitFor({ state: "detached", timeout: 12_000 })
      .catch(() => undefined);

    // 重发同一删除请求：http 层自动携带审批令牌，删除成功，行消失
    const rowAfter = page
      .locator(".el-table__row", { hasText: username })
      .first();
    await rowAfter.getByRole("button", { name: "删除" }).first().click();
    await page
      .locator(".el-popconfirm, .el-popper, .el-message-box")
      .getByRole("button", { name: "确定" })
      .first()
      .click();
    await expect(
      page.locator(".el-table__row", { hasText: username })
    ).toHaveCount(0, { timeout: 15_000 });
  } finally {
    // 复位拦截清单：其他用例的删除链路不依赖审批
    await setApprovalPaths(page, token, []).catch(() => undefined);
  }
});
