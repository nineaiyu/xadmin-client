import { expect, test } from "@playwright/test";

import { FRONT_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 动态表单主链路：
 * 管理员设计表单（两个控件 + 提交需审批）→ 用户填报 → 我的提交列表可见 → 提交内容渲染。
 *
 * 审批开关本身走「设计器 → 列表 → 填报卡片」往返（超管直提，不触发 412）；
 * 412 → 审批通过 → 令牌重放的完整链路在集成测试与审批 E2E 覆盖。
 */

test("动态表单：设计（含审批开关）→ 填报 → 提交可见", async ({ page }) => {
  await login(page);

  // 名称唯一约束（DynamicForm.name unique）+ 双浏览器共享同一 sqlite 库：
  // 固定名字会让后跑的浏览器撞唯一约束（保存失败 → 弹窗不关 → 误导性断言失败），
  // 统一加随机后缀（同 dashboard/analysis 的既有教训）
  const suffix = Math.random().toString(36).slice(2, 8);
  const formName = `E2E设备登记-${suffix}`;

  // ---- 设计表单 ----
  await openMenuPath(page, ["表单采集"], "/form-collection/designer/index");
  // RePlusPage 列表以工具栏按钮为加载锚点（表格行需等种子/新建数据）
  await expect(page.getByRole("button", { name: "新建表单" })).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("button", { name: "新建表单" }).click();
  const dialog = page.locator(".el-dialog").filter({ hasText: "新建表单" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("名称").fill(formName);
  // 开启「提交审批」，落库后列表与填报页均带「需审批」标记
  await dialog.getByTestId("form-approval-switch").click();
  await dialog.getByRole("button", { name: "添加字段" }).click();
  const firstRow = dialog.locator(".el-table__row").first();
  await firstRow.locator("input").first().fill("device_name");
  await firstRow.locator("input").nth(1).fill("设备名称");
  await dialog.getByRole("button", { name: "添加字段" }).click();
  const secondRow = dialog.locator(".el-table__row").nth(1);
  await secondRow.locator("input").first().fill("location");
  await secondRow.locator("input").nth(1).fill("存放位置");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible();
  const designerRow = page.getByRole("row", { name: formName }).first();
  await expect(designerRow).toBeVisible({ timeout: 15_000 });
  // 审批开关已落库：设计器列表该行显示「需审批」
  await expect(designerRow.getByText("需审批")).toBeVisible({
    timeout: 15_000
  });

  // ---- 填报 ----
  await openMenuPath(page, ["表单采集"], "/form-collection/my/index");
  const card = page.getByTestId("fill-form-card").filter({ hasText: formName });
  await expect(card).toBeVisible({ timeout: 15_000 });
  // 填报卡片带「需审批」标记，弹窗内提示审批语义
  await expect(card.getByTestId("fill-form-approval-tag")).toBeVisible();
  await card.click();
  const fillDialog = page.locator(".el-dialog");
  await expect(fillDialog).toBeVisible();
  await fillDialog.getByLabel("设备名称").fill("E2E路由器");
  await fillDialog.getByLabel("存放位置").fill("A 机房 01 柜");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await fillDialog.getByRole("button", { name: "保存" }).click();
  await expect(fillDialog).not.toBeVisible();

  // ---- 我的提交可见且内容渲染 ----
  const submissionRow = page
    .getByTestId("my-submission-table")
    .getByRole("row", { name: formName });
  await expect(submissionRow).toBeVisible();
  // 限定在本次表单的提交行内：双浏览器共享库时固定内容会在页面上命中多条
  // （strict mode violation）
  await expect(submissionRow.getByText("device_name: E2E路由器")).toBeVisible();
});

test("动态表单：金额/选人/级联控件填报主链路", async ({ page }) => {
  await login(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const formName = `E2E采购登记-${suffix}`;

  // 定义侧走 API（三个新控件的 schema 直接固定，设计器交互已在上一用例覆盖）
  const token = await getAccessToken(page);
  const created = await page.request.post(
    `${FRONT_URL}/api/system/dynamic-forms`,
    {
      data: {
        name: formName,
        description: "E2E 新控件",
        is_active: true,
        approval_required: false,
        schema: {
          fields: [
            {
              key: "fee",
              label: "费用金额",
              type: "amount",
              required: true,
              precision: 2
            },
            { key: "owner", label: "经办人", type: "user", required: true },
            {
              key: "region",
              label: "所属区域",
              type: "cascader",
              required: true,
              options: [
                {
                  value: "华东",
                  label: "华东",
                  children: [{ value: "上海", label: "上海" }]
                }
              ]
            }
          ]
        }
      },
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  expect(created.status()).toBe(200);
  expect((await created.json()).code).toBe(1000);

  // ---- 填报：金额 / 选人（远程搜索）/ 级联 ----
  await openMenuPath(page, ["表单采集"], "/form-collection/my/index");
  const card = page.getByTestId("fill-form-card").filter({ hasText: formName });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  const dialog = page.locator(".el-dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("费用金额").fill("88.5");
  // 选人：远程搜索 xadmin 后选中候选
  await dialog.getByLabel("经办人").click();
  await page.keyboard.type("xadmin");
  const userOption = page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: "xadmin" })
    .first();
  await expect(userOption).toBeVisible({ timeout: 10_000 });
  await userOption.click();
  // 级联：逐级选择 华东 / 上海
  await dialog.getByLabel("所属区域").click();
  await page
    .locator(".el-cascader-node")
    .filter({ hasText: "华东" })
    .first()
    .click();
  await page
    .locator(".el-cascader-node")
    .filter({ hasText: "上海" })
    .first()
    .click();

  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible();

  // ---- 提交行渲染（级联值以路径数组入列）----
  const row = page
    .getByTestId("my-submission-table")
    .getByRole("row", { name: formName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("fee: 88.5")).toBeVisible();
  // 非标量值在提交列表按 JSON 展示（与附件/日期范围同口径）
  await expect(row.getByText('region: ["华东","上海"]')).toBeVisible();
});
