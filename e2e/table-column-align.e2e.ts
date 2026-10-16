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
 * 追加口径（按内容收敛）：操作列按钮随权限点与行数据显隐，列宽以内容实测宽度
 * 为下限收敛（例如访问日志页只有图标按钮时 140 → 90）。
 *
 * 断言口径：
 * 1. 所见即配置：操作列渲染宽度不得比页面配置宽度加宽超过容差（1px 舍入）；
 * 2. 对齐生效（确有加宽）时，初始位置不得存在跨过覆盖区左边界的列头；
 * 3. 内容不被裁切：渲染宽度不小于「内容实测宽度与配置宽度的较小者」；
 * 4. 收敛（渲染宽度小于配置宽度）时同样不得存在跨界列头；
 * 5. 内容远小于配置的页面（PAGES 的 maxWidth）确实收敛，守住实测链路的静默失效。
 */

/** 页面清单：opWidth = 页面配置宽度；maxWidth = 收敛后的宽度上限（可选，见列表项注释） */
const PAGES: Array<{
  name: string;
  dirs: string[];
  path: string;
  opWidth: number;
  maxWidth?: number;
}> = [
  {
    name: "celery-task（列最多）",
    dirs: ["系统管理", "任务管理"],
    path: "/system/celery/task/index",
    opWidth: 440
  },
  {
    name: "leave",
    dirs: ["审批"],
    path: "/approval/leave/index",
    opWidth: 300
  },
  {
    name: "logs-operation",
    dirs: ["系统管理", "日志管理"],
    path: "/system/logs/operation/index",
    opWidth: 140,
    // 该页操作列只有一个图标按钮（内容约 52px，远小于配置 140）：
    // 断言确实发生了收敛（实测 62~90），守住「内容实测链路失效即回退配置宽度」的静默回归
    maxWidth: 120
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
        // 列元数据异步到达 + 操作列宽度在 rAF 内对齐，直接采集会读到中间态：
        // 轮询「固定操作列宽度」直到连续两次读数一致（稳定）再采集
        let lastWidth = -1;
        await expect
          .poll(
            async () => {
              const width = await page.evaluate(() =>
                Math.round(
                  document
                    .querySelector(
                      ".re-plus-page .el-table__header th.el-table-fixed-column--right"
                    )
                    ?.getBoundingClientRect().width ?? 0
                )
              );
              const stable = width > 0 && width === lastWidth;
              lastWidth = width;
              return stable;
            },
            { timeout: 15_000, intervals: [200, 300, 500] }
          )
          .toBe(true);

        const result = await page.evaluate(() => {
          const root = document.querySelector(".re-plus-page") as HTMLElement;
          const table = root?.querySelector(".el-table") as HTMLElement | null;
          if (!table) {
            return { missing: true, opWidth: null, crossing: [], content: 0 };
          }
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
          if (!fixedTh)
            return { missing: false, opWidth: null, crossing: [], content: 0 };
          const fixedLeft =
            fixedTh.getBoundingClientRect().left - tableRect.left;

          /** 单元格内容的自然宽度（强制 nowrap 后取内容盒跨度，含文本节点） */
          const naturalWidth = (cell: HTMLElement) => {
            const previous = cell.style.whiteSpace;
            cell.style.whiteSpace = "nowrap";
            const range = document.createRange();
            range.selectNodeContents(cell);
            const rect = range.getBoundingClientRect();
            cell.style.whiteSpace = previous;
            const style = getComputedStyle(cell);
            const padding =
              (parseFloat(style.paddingLeft) || 0) +
              (parseFloat(style.paddingRight) || 0);
            return rect.width + padding;
          };
          const opCells = [
            fixedTh.querySelector(".cell"),
            ...Array.from(
              root.querySelectorAll(".el-table__body-wrapper .el-table__row")
            ).map(row => row.lastElementChild?.firstElementChild)
          ].filter((cell): cell is HTMLElement => cell instanceof HTMLElement);
          const content = Math.ceil(
            opCells.reduce((max, cell) => Math.max(max, naturalWidth(cell)), 0)
          );

          // 1px 容差：列边界即覆盖区左边界（舍入误差不应触发误报）
          return {
            missing: false,
            opWidth: Math.round(fixedTh.getBoundingClientRect().width),
            content,
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
        // 3) 内容不被裁切：宽度不小于「内容实测宽度与配置宽度的较小者」
        expect(
          result.opWidth!,
          `操作列被收窄到内容宽度以下（内容 ${result.content} / 实际 ${result.opWidth}）`
        ).toBeGreaterThanOrEqual(Math.min(result.content, spec.opWidth) - 1);
        // 4) 收敛（宽度小于配置）时同样不得有跨界列头
        if (result.opWidth! < spec.opWidth - 1) {
          expect(
            result.crossing,
            `收敛后存在跨过固定操作列左边界的列头: ${result.crossing.join(", ")}`
          ).toEqual([]);
        }
        // 5) 内容远小于配置的页面确实发生收敛（守住实测链路的静默失效）
        if (spec.maxWidth) {
          expect(
            result.opWidth!,
            `操作列未按内容收敛：实际 ${result.opWidth} / 上限 ${spec.maxWidth}`
          ).toBeLessThanOrEqual(spec.maxWidth);
        }
      });
    }
  });
}

test("表格工具栏：全屏铺满与退出还原", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");

  const card = page.locator(".re-plus-table-card");
  await expect(card.first()).toBeVisible({ timeout: 15_000 });
  const fullscreenCard = page.locator(".re-plus-table-card--fullscreen");
  await expect(fullscreenCard).toHaveCount(0);

  await page
    .getByLabel(/^全屏$/)
    .first()
    .click();
  await expect(fullscreenCard).toBeVisible();

  await page
    .getByLabel(/^退出全屏$/)
    .first()
    .click();
  await expect(fullscreenCard).toHaveCount(0);
});
