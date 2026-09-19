import { expect, test } from "@playwright/test";
import { login, openMenuPath } from "./helpers";

/**
 * 固定操作列边界对齐回归（列表页表头被固定列裁切修复）。
 *
 * 横向滚动时右侧固定列 sticky 在容器右端，覆盖区左边界若落在某个数据列
 * 中间，该列表头内容（列名、问号图标）会被切掉一半（"半个字"）。
 * RePlusPage 按容器实测宽度动态收敛操作列宽度，使覆盖区左边界恰好落在
 * 列边界上；这里在代表页断言「不存在跨过固定列左边界的未固定列」。
 */

const PAGES = [
  {
    name: "celery-task（列最多）",
    dirs: ["系统管理", "任务管理"],
    path: "/system/celery/task/index"
  },
  { name: "leave", dirs: ["系统管理"], path: "/system/leave/index" },
  {
    name: "logs-operation",
    dirs: ["系统管理", "日志管理"],
    path: "/system/logs/operation/index"
  },
  {
    name: "config-system",
    dirs: ["系统管理", "配置管理"],
    path: "/system/config/system/index"
  },
  { name: "user（含左侧树）", dirs: ["系统管理"], path: "/system/user/index" },
  {
    name: "role",
    dirs: ["系统管理", "权限管理"],
    path: "/system/role/index"
  }
];

/** 交叉分辨率：对齐逻辑依赖容器实测宽度，窄/宽两档都要成立 */
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 1440, height: 900 }
];

for (const viewport of VIEWPORTS) {
  test.describe(`操作列对齐（视口 ${viewport.width}）`, () => {
    test.use({ viewport });

    for (const spec of PAGES) {
      test(`${spec.name} 表头无被固定列裁切的列`, async ({ page }) => {
        await login(page);
        await openMenuPath(page, spec.dirs, spec.path);
        await page
          .locator(".re-plus-page .el-table__header th")
          .first()
          .waitFor({ state: "visible", timeout: 15_000 });
        // 列元数据异步到达、操作列宽度对齐后再采集
        await page.waitForTimeout(1_000);

        const crossing = await page.evaluate(() => {
          const table = document.querySelector(
            ".re-plus-page .el-table"
          ) as HTMLElement | null;
          if (!table) return ["NO_TABLE"];
          const tableRect = table.getBoundingClientRect();
          const ths = Array.from(
            table.querySelectorAll(".el-table__header th")
          ).map(th => {
            const el = th as HTMLElement;
            const rect = el.getBoundingClientRect();
            return {
              label: el.innerText.trim().replace(/\s+/g, " ").slice(0, 12),
              x: rect.left - tableRect.left,
              right: rect.right - tableRect.left,
              fixed: el.className.includes("fixed-column")
            };
          });
          const fixedTh = table.querySelector(
            ".el-table__header th.el-table-fixed-column--right"
          ) as HTMLElement | null;
          if (!fixedTh) return [];
          const fixedLeft =
            fixedTh.getBoundingClientRect().left - tableRect.left;
          // 1px 容差：列边界即覆盖区左边界（舍入误差不应触发误报）
          return ths
            .filter(
              t => !t.fixed && t.x < fixedLeft - 1 && t.right > fixedLeft + 1
            )
            .map(t => `${t.label}[${Math.round(t.x)}-${Math.round(t.right)}]`);
        });

        expect(
          crossing,
          `以下列的列头跨过固定操作列左边界（内容会被裁半个字）: ${crossing.join(", ")}`
        ).toEqual([]);
      });
    }
  });
}
