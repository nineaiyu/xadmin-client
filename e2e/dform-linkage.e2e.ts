import { expect, test, type Page } from "@playwright/test";

import { BACKEND_URL, FRONT_URL, getAccessToken, login } from "./helpers";

/**
 * 表单设计器升级用例（联动规则 / 版本化 / 拖拽排序）：
 *
 * 1. 联动规则：设计器配置「触发条件 → 隐藏/必填」→ 填报页联动生效（隐藏字段不渲染、
 *    必填动态加星）→ 服务端同源校验（缺动态必填被拒）；
 * 2. 版本化：改 schema 生成新版本 → 版本弹窗查看历史 → 回滚生成新版本（历史保留）；
 * 3. 拖拽排序：拖拽手柄调整字段顺序（与上移/下移按钮同为一条提交路径）。
 *
 * 数据准备与清理走 API（page.request 携 token）；UI 侧只验证交互与展示。
 */

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createForm(
  page: Page,
  token: string,
  data: Record<string, unknown>
): Promise<string> {
  const res = await page.request.post(
    `${BACKEND_URL}/api/dataset/dynamic-forms`,
    {
      headers: headers(token),
      data
    }
  );
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data.pk as string;
}

async function removeForm(page: Page, token: string, pk: string) {
  if (!pk) return;
  await page.request
    .delete(`${BACKEND_URL}/api/dataset/dynamic-forms/${pk}`, {
      headers: headers(token)
    })
    .catch(() => undefined);
}

async function openDesigner(page: Page, formName: string) {
  await page.goto(`${FRONT_URL}/#/form-collection/designer/index`);
  const row = page.getByRole("row", { name: formName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "编辑" }).click();
  const dialog = page.locator(".el-dialog").last();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

/**
 * 选中 EP 下拉中的选项（选中后点标题收起，避免可见态残留遮挡后续交互）。
 *
 * `visible: true` 过滤是必需的：EP 的下拉在收起后仍以 hidden 副本留在 DOM，
 * 直接 `.first()` 会命中旧下拉的隐藏项。
 */
async function pickOption(
  page: Page,
  select: ReturnType<Page["locator"]>,
  optionText: string | RegExp,
  collapseTarget: ReturnType<Page["locator"]>
) {
  await select.click();
  const option = page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: optionText, visible: true })
    .first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
  await collapseTarget.click();
}

/** 在设计器内新增一条联动规则（弹窗内保存） */
async function addLinkageRule(
  page: Page,
  dialog: ReturnType<Page["locator"]>,
  rule: {
    trigger: string;
    op: string;
    effect: string;
    target: string;
  }
) {
  await dialog.getByTestId("linkage-add").click();
  const ruleDialog = page.locator(".el-dialog").last();
  await expect(ruleDialog.getByTestId("linkage-trigger")).toBeVisible();
  const header = ruleDialog.locator(".el-dialog__header");
  await pickOption(
    page,
    ruleDialog.getByTestId("linkage-trigger"),
    rule.trigger,
    header
  );
  await pickOption(page, ruleDialog.getByTestId("linkage-op"), rule.op, header);
  await pickOption(
    page,
    ruleDialog.getByTestId("linkage-effect"),
    rule.effect,
    header
  );
  await pickOption(
    page,
    ruleDialog.getByTestId("linkage-target"),
    rule.target,
    header
  );
  await ruleDialog.getByRole("button", { name: "保存" }).click();
  await expect(page.getByTestId("linkage-trigger")).not.toBeVisible();
}

test("表单联动：设计器配置 → 填报页隐藏/动态必填 → 服务端同源校验", async ({
  page
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const formName = `E2E联动-${suffix}`;
  let formPk = "";

  try {
    formPk = await createForm(page, token, {
      name: formName,
      is_active: true,
      schema: {
        fields: [
          {
            key: "kind",
            label: "类型",
            type: "select",
            options: ["A", "B"],
            required: true
          },
          { key: "reason", label: "说明", type: "input", required: true },
          { key: "amount", label: "金额", type: "number" }
        ]
      }
    });

    const dialog = await openDesigner(page, formName);
    // 规则一：类型为空 → 隐藏「说明」；规则二：类型非空 → 「金额」必填
    await addLinkageRule(page, dialog, {
      trigger: "类型（kind）",
      op: "为空",
      effect: "隐藏",
      target: "说明（reason）"
    });
    await addLinkageRule(page, dialog, {
      trigger: "类型（kind）",
      op: "不为空",
      effect: "必填",
      target: "金额（amount）"
    });
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).not.toBeVisible();

    // 落库校验：规则已入 schema（服务端提交校验使用同一份规则）
    const detail = await page.request.get(
      `${BACKEND_URL}/api/dataset/dynamic-forms/${formPk}`,
      { headers: headers(token) }
    );
    const linkages = (await detail.json())?.data?.schema?.linkages ?? [];
    expect(linkages).toHaveLength(2);

    // ---- 填报页联动 ----
    await page.goto(`${FRONT_URL}/#/form-collection/my/index`);
    const card = page
      .getByTestId("fill-form-card")
      .filter({ hasText: formName });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    const fillDialog = page.locator(".el-dialog").last();
    await expect(fillDialog).toBeVisible({ timeout: 10_000 });
    const item = (label: string) =>
      fillDialog.locator(".el-form-item").filter({ hasText: label });
    const reasonItem = item("说明");
    const amountItem = item("金额");

    // 类型为空：说明隐藏、金额未加必填
    await expect(reasonItem).toHaveCount(0);
    await expect(amountItem).not.toHaveClass(/is-required/);

    // 选择类型 A：说明恢复显示、金额动态必填
    await pickOption(
      page,
      item("类型").locator(".el-select"),
      /^A$/,
      fillDialog.locator(".el-dialog__header")
    );
    await expect(reasonItem).toBeVisible();
    await expect(amountItem).toHaveClass(/is-required/);
    // 先填基础必填（说明），让服务端校验只在动态必填（金额）上失败
    await reasonItem.locator("input").fill("E2E说明");

    // 服务端同源校验：缺动态必填（金额）被拒（前端不预校验，直接看后端返回）
    await fillDialog.getByRole("button", { name: "保存" }).click();
    await expect(
      page.locator(".el-message").filter({ hasText: "金额" }).first()
    ).toBeVisible({ timeout: 10_000 });

    // 补齐后提交成功
    await amountItem.locator("input").fill("100");
    await fillDialog.getByRole("button", { name: "保存" }).click();
    await expect(fillDialog).not.toBeVisible({ timeout: 10_000 });
    await expect(
      page
        .getByTestId("my-submission-table")
        .getByRole("row", { name: formName })
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await removeForm(page, token, formPk);
  }
});

test("表单版本：改 schema 生成新版本 → 历史查看 → 回滚生成新版本", async ({
  page
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const formName = `E2E版本-${suffix}`;
  let formPk = "";

  try {
    formPk = await createForm(page, token, {
      name: formName,
      is_active: true,
      schema: {
        fields: [
          { key: "field_a", label: "字段A", type: "input" },
          { key: "field_b", label: "字段B", type: "input" }
        ]
      }
    });

    // 新增第三个字段 → 保存生成 v2
    const dialog = await openDesigner(page, formName);
    await dialog.getByRole("button", { name: "添加字段" }).click();
    const rows = dialog.locator(".el-table__row");
    await expect(rows).toHaveCount(3);
    await rows.nth(2).locator("input").nth(1).fill("字段C");
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).not.toBeVisible();

    const detail = await page.request.get(
      `${BACKEND_URL}/api/dataset/dynamic-forms/${formPk}`,
      { headers: headers(token) }
    );
    const body = (await detail.json())?.data ?? {};
    expect(body.schema_version).toBe(2);
    expect(body.schema.fields).toHaveLength(3);

    // 行内「版本」：历史含 v1（2 个字段）→ 回滚
    const row = page.getByRole("row", { name: formName });
    await row.getByRole("button", { name: "版本" }).click();
    const historyDialog = page.locator(".el-dialog").last();
    await expect(historyDialog).toContainText("v2");
    const historyRow = historyDialog.getByRole("row", { name: /v1/ });
    await expect(historyRow).toBeVisible({ timeout: 10_000 });
    await expect(historyRow).toContainText("2");
    await historyRow.getByTestId("schema-rollback").click();
    const confirmBox = page.locator(".el-message-box");
    await expect(confirmBox).toBeVisible();
    await confirmBox.getByRole("button", { name: "回滚" }).click();
    await expect(page.locator(".el-message").first()).toBeVisible({
      timeout: 10_000
    });

    // 回滚生成 v3 且字段回到 2 个；历史保留 v1/v2
    const after = await page.request.get(
      `${BACKEND_URL}/api/dataset/dynamic-forms/${formPk}`,
      { headers: headers(token) }
    );
    const afterBody = (await after.json())?.data ?? {};
    expect(afterBody.schema_version).toBe(3);
    expect(afterBody.schema.fields).toHaveLength(2);
    const history = await page.request.get(
      `${BACKEND_URL}/api/dataset/dynamic-forms/${formPk}/schema-history`,
      { headers: headers(token) }
    );
    const versions = ((await history.json())?.data?.history ?? []).map(
      (item: { version: number }) => item.version
    );
    expect(versions).toEqual([2, 1]);
  } finally {
    await removeForm(page, token, formPk);
  }
});

/**
 * 拖拽排序未入 E2E：sortablejs 的 forceFallback 手势依赖真实帧节奏，合成鼠标事件
 * 在 chromium/webkit 间不稳定（实测拖动成功与否随帧时序漂移）。拖拽与「上移/下移」
 * 共用同一数据路径 `utils/fieldOrder.ts::moveItem`（单测覆盖），按钮路径由
 * dform-depth.e2e.ts 覆盖；拖拽手势保留人工验证。
 */
