import { expect, test, type Locator, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 数据权限配置页（抽屉式新增/编辑 + 行内规则编辑器）E2E 回归。
 *
 * 覆盖：
 * - 新增抽屉：行内配置规则（过滤对象 → 取值方式）→ 规则摘要 → 未保存草稿试算 → 保存；
 * - 列表：生效范围与组合模式标签随快照展示（后端 annotations 带出）；
 * - 编辑抽屉：规则与生效范围回显。
 *
 * 授权名带时间戳：双浏览器共享同一份库，固定名称会与历史数据撞行。
 */

test.use({ viewport: { width: 1440, height: 1080 } });

/** 打开 select 并按选项文本选中（下拉 popper 残留隐藏副本，需按可见过滤） */
async function pickOption(page: Page, scope: Locator, text: string) {
  await scope.locator(".el-select").first().click();
  const option = page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: text })
    .locator("visible=true")
    .first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
}

test.describe("数据权限配置（抽屉式新增/编辑）", () => {
  test("新增：行内配置规则并保存，列表展示生效范围", async ({ page }) => {
    await login(page);
    await openMenuPath(
      page,
      ["系统管理", "权限管理"],
      "/system/permission/index"
    );
    const name = `E2E-数据权限-${Date.now()}`;

    await page.getByRole("button", { name: "新增" }).first().click();
    const drawer = page
      .locator(".el-drawer")
      .filter({ hasText: "新增" })
      .first();
    await expect(drawer).toBeVisible({ timeout: 15_000 });

    await drawer
      .locator(".el-form-item")
      .filter({ hasText: "权限名称" })
      .locator("input")
      .first()
      .fill(name);

    // 行内规则编辑：过滤对象（应用 / 模型 / 字段级联）→ 取值方式（运行期按当前用户注入）
    await drawer.getByTestId("rule-add").click();
    const card = drawer.locator(".rule-edit-card");
    await expect(card).toBeVisible();
    const scope = card.getByTestId("rule-scope");
    // 过滤对象逐级选择：应用 → 模型 → 字段（下拉面板每列一个 menu）
    const pickScopeNode = async (column: number, name: string) => {
      await page
        .locator(".el-cascader__dropdown .el-cascader-menu")
        .nth(column)
        .locator(".el-cascader-node")
        .filter({ hasText: name })
        .first()
        .click();
    };
    await scope.locator("input").first().click();
    await pickScopeNode(0, "(system)");
    await pickScopeNode(1, "(system.userinfo)");
    await pickScopeNode(2, "(creator)");
    // 级联选中值显示在输入框 value（完整路径），不是文本节点
    await expect(scope.locator("input").first()).toHaveValue(/创建人/);
    await pickOption(page, card.getByTestId("rule-type"), "目标用户本人");
    await expect(card.getByTestId("rule-value")).toContainText(
      "由系统按当前用户自动填充"
    );
    await card.getByTestId("rule-save").click();

    // 规则卡片摘要（方向 + 字段中文名 + 取值语义）
    const ruleRow = drawer.getByTestId("rule-row");
    await expect(ruleRow).toContainText("包含 创建人 目标用户本人");
    // 未保存草稿即可试算（面板默认展开）
    await expect(drawer.getByText("即时试算（未保存的规则）")).toBeVisible();

    await drawer
      .locator(".el-drawer__footer")
      .getByRole("button", { name: "保存" })
      .click();

    // 列表：生效范围（未绑定接口=全部接口）与组合模式（单条规则）
    const row = page
      .locator(".el-table__row")
      .filter({ hasText: name })
      .first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText("全部接口");
    await expect(row).toContainText("单条");
    // 统计列表头（服务端 label 为英文兜底，页面覆写中文标题）
    await expect(
      page.getByRole("columnheader", { name: "规则数" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "生效接口" }).first()
    ).toBeVisible();

    // 编辑：规则与生效范围回显
    await row.getByRole("button", { name: "编辑" }).click();
    const editDrawer = page
      .locator(".el-drawer")
      .filter({ hasText: "编辑" })
      .first();
    await expect(editDrawer).toBeVisible({ timeout: 15_000 });
    await expect(editDrawer.getByTestId("rule-row")).toContainText("创建人");
    await expect(editDrawer.getByTestId("scope-trigger")).toContainText(
      "未限制"
    );
    // 行内编辑回显：表 / 取值方式（回填期间不得被「字段变化清空取值」的联动清掉）
    await editDrawer
      .getByTestId("rule-row")
      .getByRole("button", { name: "编辑" })
      .click();
    const editCard = editDrawer.locator(".rule-edit-card");
    await expect(editCard.getByTestId("rule-scope").locator("input").first()) //
      .toHaveValue(/创建人/);
    await expect(editCard.getByTestId("rule-value")).toContainText(
      "由系统按当前用户自动填充"
    );
    // 「全部数据」时过滤对象与匹配条件仍保留在界面上（只读 + 提示），不再整块消失
    await pickOption(page, editCard.getByTestId("rule-type"), "全部数据");
    await expect(editCard.getByTestId("rule-scope")).toBeVisible();
    await expect(editCard.getByTestId("rule-scope")).toContainText(
      "无需选择过滤对象"
    );
    await expect(editCard.getByTestId("rule-match")).toBeVisible();
    await expect(editCard.getByTestId("rule-value")).toContainText(
      "全部数据（不限制）"
    );
    await editDrawer
      .locator(".el-drawer__footer")
      .getByRole("button", { name: "取消" })
      .click();
    await expect(editDrawer).not.toBeVisible();
  });
});
