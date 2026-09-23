import { expect, test } from "@playwright/test";
import { login, openMenuPath } from "./helpers";
import { ALIGN_TOLERANCE } from "../src/components/RePlusPage/src/utils/operationColumnWidth";

/**
 * 固定操作列宽度回归（列表页表头被固定列裁切修复的后续口径调整）。
 *
 * 背景：横向滚动时右侧固定列 sticky 在容器右端，覆盖区左边界若落在数据列
 * 中间，该列表头内容（列名、问号图标）会被切掉一半（"半个字"）。RePlusPage
 * 会把覆盖区左边界对齐到列边界；但对齐只对「初始滚动位置」有效（横向滚动后
 * 裁切位置必然移动），因此只保留小幅修正（加宽 ≤ ALIGN_TOLERANCE），超出时
 * 严格按页面配置宽度渲染——见 operationColumnWidth.ts 的取舍注释。
 *
 * 断言口径：
 * 1. 所见即配置：操作列渲染宽度不得比页面配置宽度加宽超过容差（1px 舍入）；
 * 2. 对齐生效（确有加宽）时，初始位置不得存在跨过覆盖区左边界的列头。
 */

const PAGES = [
  {
    name: "celery-task（列最多）",
    dirs: ["系统管理", "任务管理"],
    path: "/system/celery/task/index",
    opWidth: 440
  },
  {
    name: "leave",
    dirs: ["系统管理"],
    path: "/system/leave/index",
    opWidth: 300
  },
  {
    name: "logs-operation",
    dirs: ["系统管理", "日志管理"],
    path: "/system/logs/operation/index",
    opWidth: 140
  },
  {
    name: "config-system",
    dirs: ["系统管理", "配置管理"],
    path: "/system/config/system/index",
    opWidth: 250
  },
  {
    name: "user（含左侧树）",
    dirs: ["系统管理"],
    path: "/system/user/index",
    opWidth: 260
  },
  {
    name: "role",
    dirs: ["系统管理", "权限管理"],
    path: "/system/role/index",
    opWidth: 200
  }
];

/** 交叉分辨率：宽度对齐依赖容器实测宽度，窄/宽两档都要成立 */
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 1440, height: 900 }
];

for (const viewport of VIEWPORTS) {
  test.describe(`操作列宽度（视口 ${viewport.width}）`, () => {
    test.use({ viewport });

    for (const spec of PAGES) {
      test(`${spec.name} 操作列按配置宽度渲染（对齐生效时无跨界列）`, async ({
        page
      }) => {
        await login(page);
        await openMenuPath(page, spec.dirs, spec.path);
        await page
          .locator(".re-plus-page .el-table__header th")
          .first()
          .waitFor({ state: "visible", timeout: 15_000 });
        // 列元数据异步到达、操作列宽度对齐后再采集
        await page.waitForTimeout(1_000);

        const result = await page.evaluate(() => {
          const table = document.querySelector(
            ".re-plus-page .el-table"
          ) as HTMLElement | null;
          if (!table) return { missing: true, opWidth: null, crossing: [] };
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
          if (!fixedTh) return { missing: false, opWidth: null, crossing: [] };
          const fixedLeft =
            fixedTh.getBoundingClientRect().left - tableRect.left;
          // 1px 容差：列边界即覆盖区左边界（舍入误差不应触发误报）
          return {
            missing: false,
            opWidth: Math.round(fixedTh.getBoundingClientRect().width),
            crossing: ths
              .filter(
                t => !t.fixed && t.x < fixedLeft - 1 && t.right > fixedLeft + 1
              )
              .map(t => `${t.label}[${Math.round(t.x)}-${Math.round(t.right)}]`)
          };
        });

        expect(result.missing, "未找到列表表格").toBeFalsy();
        expect(result.opWidth, "未找到固定操作列").not.toBeNull();
        // 1) 所见即配置：加宽幅度不得超过容差（+1px 舍入）
        expect(
          result.opWidth! - spec.opWidth,
          `操作列被加宽超出容差：实际 ${result.opWidth} / 配置 ${spec.opWidth}`
        ).toBeLessThanOrEqual(ALIGN_TOLERANCE + 1);
        // 2) 对齐生效（确有加宽）时必须无跨界列头
        if (result.opWidth! > spec.opWidth + 1) {
          expect(
            result.crossing,
            `对齐生效但存在跨过固定操作列左边界的列头: ${result.crossing.join(", ")}`
          ).toEqual([]);
        }
      });
    }
  });
}
