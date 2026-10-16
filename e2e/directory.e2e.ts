import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 通讯录（只读人员名录）：
 * - 部门视角：部门树筛选（含下级部门）→ 成员变化；「全部成员」清空筛选；
 * - 成员详情抽屉：卡片点击打开只读详情（联系方式 + 复制入口）；
 * - 岗位视角：岗位清单（带成员数）→ 筛选持岗成员；卡片/列表视图切换。
 *
 * 数据来自 scripts/e2e_seed.py：部门「E2E-主管测试部」（e2e_leader / e2e_member）、
 * 岗位「E2E研发岗」（e2e_user / e2e_member）。用例只读交互（不新增/修改数据），
 * 双浏览器共享库下幂等。
 */

const DIRECTORY_PATH = "/system/directory/index";

/** 等待名录首屏（卡片渲染 + 总数文案出现） */
async function waitDirectoryReady(page: import("@playwright/test").Page) {
  await expect(page.locator(".member-card").first()).toBeVisible({
    timeout: 20_000
  });
  await expect(page.getByText(/共 \d+ 人/)).toBeVisible();
}

test.describe("通讯录", () => {
  test("部门视角：树筛选、全部成员与视图切换", async ({ page }) => {
    await login(page);
    await openMenuPath(page, ["系统管理"], DIRECTORY_PATH);
    await waitDirectoryReady(page);

    const cards = page.locator(".member-card");

    // 部门筛选：点「E2E-主管测试部」→ 只剩该部门成员（含下级部门）
    await page
      .locator(".directory-tree .el-tree-node__content", {
        hasText: "E2E-主管测试部"
      })
      .first()
      .click();
    await expect(cards).toHaveCount(2, { timeout: 15_000 });
    await expect(page.getByText("E2E主管用户")).toBeVisible();

    // 「全部成员」清空筛选 → 成员数量恢复（目录含 xadmin 等，宽松断言）
    await page.getByRole("button", { name: "全部成员" }).click();
    await expect
      .poll(() => cards.count(), { timeout: 15_000 })
      .toBeGreaterThan(2);

    // 列表视图：列头 + 数据行
    await page.locator(".directory-members .el-radio-button").nth(1).click();
    await expect(page.locator(".member-head").first()).toBeVisible();
    await expect(page.locator(".member-row").first()).toBeVisible();

    // 长岗位名（E2E-安全员（全组织演示））必须在单元格内截断：
    // flex 单元格里的标签若不约束宽度会绘制溢出到相邻列（2026-09-28 修复的
    // 「岗位字段越界」缺陷），这里量测标签右边界不得越过岗位列右边界
    const overflowed = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".member-row")).some(row => {
        const cell = row.children[2] as HTMLElement | undefined;
        if (!cell || cell.offsetParent === null) return false;
        const cellRight = cell.getBoundingClientRect().right;
        return Array.from(cell.querySelectorAll(".el-tag")).some(
          tag => tag.getBoundingClientRect().right > cellRight + 1
        );
      })
    );
    expect(overflowed).toBe(false);
  });

  test("成员详情抽屉：只读资料与联系方式", async ({ page }) => {
    await login(page);
    await openMenuPath(page, ["系统管理"], DIRECTORY_PATH);
    await waitDirectoryReady(page);

    await page.locator(".member-card").first().click();
    const drawer = page.locator(".el-drawer:visible").first();
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await expect(drawer.getByText("成员详情")).toBeVisible();
    // 只读资料分区（字段标签 + 加入日期）
    await expect(drawer.getByText("部门", { exact: true })).toBeVisible();
    await expect(drawer.getByText("加入日期")).toBeVisible();
    await expect(drawer.getByText("最近登录")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden({ timeout: 5_000 });
  });

  test("岗位视角：岗位清单筛选持岗成员", async ({ page }) => {
    await login(page);
    await openMenuPath(page, ["系统管理"], DIRECTORY_PATH);
    await waitDirectoryReady(page);

    // 切到按岗位视角：岗位清单（E2E种子：E2E研发岗 2 人）
    await page.getByText("按岗位", { exact: true }).first().click();
    const postItem = page
      .locator("[data-post-pk]")
      .filter({ hasText: "E2E研发岗" })
      .first();
    await expect(postItem).toBeVisible({ timeout: 15_000 });
    await expect(postItem).toContainText("2");

    await postItem.click();
    await expect(page.locator(".member-card")).toHaveCount(2, {
      timeout: 15_000
    });
    await expect(page.getByText("E2E普通用户")).toBeVisible();
  });
});
