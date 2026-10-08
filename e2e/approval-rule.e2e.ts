import { expect, test, type Page } from "@playwright/test";

import {
  APPROVER,
  BACKEND_URL,
  filterList,
  getAccessToken,
  login,
  openMenuPath
} from "./helpers";

/**
 * 审批规则页「方法限定」联调 E2E（前端表单 ↔ 规则接口）：
 *
 * - UI 新建规则：自定义路径正则 + 多选勾选限定方法（POST）+ 一级「指定用户」审批人；
 * - 保存后列表回显：方法限定列渲染 POST 标签、审批级数 1 级；
 * - 编辑弹窗回显已选方法（多选标签保留）；
 * - 接口断言 methods 落库；用例末尾按名清理（双浏览器共享库幂等）。
 *
 * 规则仅在建单匹配时生效，而本用例不开启 APPROVAL_REQUIRED_PATHS（默认空清单），
 * 因此规则存活期间对其它 spec 的删除链路零影响；「方法限定不命中 → 回落全局
 * 扁平审批」的建单链路由 approval-chain.e2e.ts 覆盖。
 */

const RULE_LIST_URL = "/approval/rule/index";

/** 打开规则页并等待列表就绪 */
async function openRulePage(page: Page) {
  await openMenuPath(page, ["审批"], RULE_LIST_URL);
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 20_000
  });
}

/** 在已展开的 el-select 下拉中选择选项（多实例 popper 必须先收敛可见态） */
async function pickOption(page: Page, text: string | RegExp) {
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item")
    .filter({ hasText: text })
    .first()
    .click();
}

test.describe("审批规则方法限定", () => {
  test("UI 新建（限 POST）→ 列表回显 → 编辑回显 → 接口落库", async ({
    page
  }) => {
    await login(page);
    const token = await getAccessToken(page);
    const headers = { Authorization: `Bearer ${token}` };
    const ruleName = `E2E方法限定-${Date.now()}`;

    try {
      await openRulePage(page);
      await page.getByRole("button", { name: "新增审批规则" }).first().click();
      const dialog = page.locator(".el-dialog:visible").first();
      await expect(dialog).toBeVisible({ timeout: 15_000 });

      // 规则名 + 自定义路径正则（绕开接口清单目录，专注方法限定联调）
      await dialog.getByPlaceholder("例如「书籍删除审批」").fill(ruleName);
      await dialog
        .getByPlaceholder(/自定义路径正则/)
        .fill("api/system/user/(?P<pk>[^/.]+)$");

      // 限定方法：多选勾选 POST
      const methodItem = dialog.locator(".el-form-item", {
        hasText: "限定方法"
      });
      await methodItem.locator(".el-select").click();
      await pickOption(page, /^POST$/);
      // 多选下拉选中后保持展开（会拦截后续点击），点弹窗标题区强制收起
      await dialog.locator(".el-dialog__header").click();

      // 级次（默认一级「指定用户」）：远程搜索选中 e2e_approver
      const levelSelect = dialog
        .locator(".el-table__row")
        .first()
        .locator(".el-select")
        .nth(2);
      await levelSelect.click();
      await levelSelect.locator("input").fill(APPROVER.username);
      await pickOption(page, APPROVER.username);
      await dialog.locator(".el-dialog__header").click();

      await dialog.getByRole("button", { name: "保存" }).click();
      await expect(dialog).toBeHidden({ timeout: 15_000 });

      // 列表回显：方法限定列（前端词条覆盖服务端英文 label）POST 标签 + 审批级数
      await filterList(page, "请输入规则名称", ruleName);
      const row = page.locator(".el-table__row", { hasText: ruleName }).first();
      await row.waitFor({ state: "visible", timeout: 15_000 });
      await expect(
        page.locator(".el-table__header th", { hasText: "方法限定" }).first()
      ).toBeVisible();
      await expect(row.getByText("POST", { exact: true })).toBeVisible();
      await expect(row).toContainText("1 级");

      // 编辑回显：多选标签保留已选方法
      await row.getByRole("button", { name: "编辑" }).first().click();
      const editDialog = page.locator(".el-dialog:visible").first();
      await expect(editDialog).toBeVisible({ timeout: 15_000 });
      await expect(
        editDialog.locator(".el-form-item", { hasText: "限定方法" })
      ).toContainText("POST");
      await editDialog.getByRole("button", { name: "取消" }).click();
      await expect(editDialog).toBeHidden({ timeout: 10_000 });

      // 接口落库断言（名称精确匹配）
      const listing = await page.request
        .get(
          `${BACKEND_URL}/api/approval/approval-rules?name=${encodeURIComponent(
            ruleName
          )}`,
          { headers }
        )
        .then(res => res.json());
      const target = (listing?.data?.results ?? []).find(
        (item: { name?: string }) => item.name === ruleName
      );
      expect(target?.methods, JSON.stringify(listing)).toEqual(["POST"]);
      expect((target?.levels ?? []).length).toBe(1);
    } finally {
      // 按名清理：规则名唯一，创建失败时查询为空即跳过
      const listing = await page.request
        .get(
          `${BACKEND_URL}/api/approval/approval-rules?name=${encodeURIComponent(
            ruleName
          )}`,
          { headers }
        )
        .then(res => res.json())
        .catch(() => null);
      for (const item of listing?.data?.results ?? []) {
        await page.request
          .delete(`${BACKEND_URL}/api/approval/approval-rules/${item.pk}`, {
            headers
          })
          .catch(() => undefined);
      }
    }
  });
});
