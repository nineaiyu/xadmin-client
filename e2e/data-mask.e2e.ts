import { expect, test } from "@playwright/test";

import {
  DP_USER,
  FRONT_URL,
  login,
  logout,
  openMenuPath,
  openUserManagement
} from "./helpers";

/**
 * 字段级数据脱敏：
 * 1) 规则管理 + 预览链路（工具栏入口、行内预填当前行规则、批量样例逐条结果）；
 * 2) 原文通道闭环（非超管 + 该地址有更新权限）：列表见掩码 → 编辑表单见原文 →
 *    原样保存后库内仍是原文。
 *
 * 掩码规则的作用面按「角色」收窄，避免用例期间影响其他账号。
 */
test("脱敏规则：创建、列表展示、预览（行内预填 + 批量样例）与删除", async ({
  page
}) => {
  await login(page);

  const model = "system.userinfo";
  // 用不存在的字段名建规则：只验证管理/预览链路，不影响真实用户数据展示
  const field = `phone_${Date.now()}`;
  const createResp = await page.request.post(
    `${FRONT_URL}/api/system/mask-rules`,
    {
      data: {
        model,
        field,
        mask_type: "phone",
        // 与下方预览结果口径一致：保留前 3 后 2 → 138******78
        keep_head: 3,
        keep_tail: 2,
        is_active: true,
        description: "E2E脱敏规则"
      }
    }
  );
  const payload = await createResp.json();
  expect(payload.code, `create rule: ${JSON.stringify(payload)}`).toBe(1000);
  const pk = payload.data.pk;

  // 打开脱敏规则页：规则行可见
  await openMenuPath(page, ["系统管理"], "/system/mask/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  const ruleRow = page.locator(".el-table__row", { hasText: field }).first();
  await expect(ruleRow).toBeVisible();

  // 行内「脱敏预览」：预填当前行规则（展示规则归属 + 保留位数沿用该行）
  await ruleRow.getByRole("button", { name: "脱敏预览" }).first().click();
  const rowDialog = page.locator(".el-dialog:visible").first();
  await expect(rowDialog).toBeVisible({ timeout: 15_000 });
  await expect(rowDialog).toContainText(`${model}.${field}`);
  const sample = rowDialog
    .locator(".el-form-item:has-text('样例值') textarea")
    .first();
  await sample.fill("13812345678");
  await rowDialog.getByRole("button", { name: "预览" }).click();
  await expect(
    rowDialog.locator(".el-alert", { hasText: "138******78" }).first()
  ).toBeVisible({ timeout: 15_000 });

  // 批量样例：换行分隔 → 逐条结果
  await sample.fill("13812345678\n13900000000");
  await rowDialog.getByRole("button", { name: "预览" }).click();
  await expect(
    rowDialog.locator(".el-alert", { hasText: "139******00" }).first()
  ).toBeVisible({ timeout: 15_000 });

  // 工具栏入口（不预填）：默认规则同样可预览
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "脱敏预览" }).first().click();
  const toolbarDialog = page.locator(".el-dialog:visible").first();
  await expect(toolbarDialog).toBeVisible({ timeout: 15_000 });
  await toolbarDialog
    .locator(".el-form-item:has-text('样例值') textarea")
    .first()
    .fill("13812345678");
  await toolbarDialog.getByRole("button", { name: "预览" }).click();
  await expect(
    toolbarDialog.locator(".el-alert", { hasText: "138******78" }).first()
  ).toBeVisible({ timeout: 15_000 });

  // 关闭弹窗并删除规则；删除后刷新页面确保表格不再展示该行
  await page.keyboard.press("Escape");
  const delResp = await page.request.delete(
    `${FRONT_URL}/api/system/mask-rules/${pk}`
  );
  expect((await delResp.json()).code, "delete rule").toBe(1000);
  await page.reload();
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  await expect(page.locator(".el-table__row", { hasText: field })).toHaveCount(
    0
  );
});

test("原文通道：列表见掩码、编辑表单见原文、原样保存后库内仍是原文", async ({
  page
}) => {
  await login(page);

  // 取种子账号 e2e_dp 的主键与角色（规则按角色生效，作用面收窄到该账号）
  const listResp = await page.request.get(
    `${FRONT_URL}/api/system/user?page=1&limit=10&username=${DP_USER.username}`
  );
  const listPayload = await listResp.json();
  const dpRow = (listPayload?.data?.results ?? []).find(
    (item: { username?: string }) => item.username === DP_USER.username
  );
  expect(dpRow, `seed user ${DP_USER.username} missing`).toBeTruthy();

  const detailResp = await page.request.get(
    `${FRONT_URL}/api/system/user/${dpRow.pk}`
  );
  const dpDetail = (await detailResp.json())?.data;
  const rolePk = (dpDetail?.roles ?? [])[0]?.pk;
  expect(rolePk, "e2e_dp role missing").toBeTruthy();
  const originalNickname = String(dpDetail.nickname);
  // 掩码口径与规则一致（保留首尾各 1 字符）
  const maskedNickname =
    originalNickname.length > 2
      ? `${originalNickname[0]}${"*".repeat(originalNickname.length - 2)}${originalNickname.slice(-1)}`
      : "*".repeat(originalNickname.length);

  const ruleResp = await page.request.post(
    `${FRONT_URL}/api/system/mask-rules`,
    {
      data: {
        model: "system.userinfo",
        field: "nickname",
        mask_type: "name",
        keep_head: 1,
        keep_tail: 1,
        is_active: true,
        roles: [rolePk],
        description: "E2E原文通道规则"
      }
    }
  );
  const rulePayload = await ruleResp.json();
  expect(rulePayload.code, `create rule: ${JSON.stringify(rulePayload)}`).toBe(
    1000
  );
  const rulePk = rulePayload.data.pk;
  // 规则必须真的按角色收窄：否则用例期间会波及同进程内的其他账号
  expect(
    (rulePayload.data.roles ?? []).map((item: { pk: string }) => item.pk)
  ).toContain(rolePk);

  {
    // 必须先登出：已登录状态下 goto /#/login 会被路由重定向回首页，登录表单不会出现
    await logout(page);
    await login(page, DP_USER);
    await openUserManagement(page);
    const rows = page.locator(".el-table__row");
    await expect(rows).toHaveCount(1, { timeout: 15_000 });

    // 列表口径：掩码（详情/导出同口径）
    await expect(page.locator(".el-table")).toContainText(maskedNickname);
    await expect(page.locator(".el-table")).not.toContainText(originalNickname);

    // 接口口径先行断言：详情 + ?mask=false 必须返回原文（字段白名单/门禁任一
    // 不满足时，UI 断言会给出无上下文的「值不对」，这里先锁定协议层）
    const detailResp = await page.request.get(
      `${FRONT_URL}/api/system/user/${dpRow.pk}?mask=false`
    );
    expect(
      (await detailResp.json())?.data?.nickname,
      "原文通道应返回原文"
    ).toBe(originalNickname);

    // 编辑表单口径：原文（前端编辑态走 ?mask=false + 更新权限通道）
    await rows.first().getByRole("button", { name: "编辑" }).first().click();
    const editDialog = page
      .locator(".el-dialog:visible, .el-drawer:visible")
      .first();
    await expect(editDialog).toBeVisible({ timeout: 15_000 });
    const nicknameInput = editDialog
      .locator(".el-form-item:has-text('昵称') input")
      .first();
    await expect(nicknameInput).toHaveValue(originalNickname, {
      timeout: 15_000
    });

    // 原样保存：掩码值不得回写覆盖原文（写路径守护 + 原文通道共同生效）
    await editDialog
      .getByRole("button", { name: /保存|确定/ })
      .first()
      .click();
    await expect(editDialog).toBeHidden({ timeout: 15_000 });
  }

  // 切回管理员会话：登出会吊销令牌，登出前抓的 Bearer 不能复用于后续校验/清理
  await logout(page);
  await login(page);

  // 库内原文未被掩码值污染
  const afterResp = await page.request.get(
    `${FRONT_URL}/api/system/user/${dpRow.pk}`
  );
  expect((await afterResp.json())?.data?.nickname).toBe(originalNickname);

  // 清理规则：作用面已按角色收窄，这里仍及时删除，避免影响同进程内的其他用例
  const cleanupResp = await page.request.delete(
    `${FRONT_URL}/api/system/mask-rules/${rulePk}`
  );
  expect((await cleanupResp.json()).code, "cleanup rule").toBe(1000);
});
