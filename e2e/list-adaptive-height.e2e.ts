import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/**
 * 列表页表格自适应高度守护。
 *
 * 回归背景：自适应高度只由「挂载」与「窗口 resize」驱动，且重算用的闲置量取自
 * 滚动容器的 `scrollHeight - clientHeight`——内容不足时该值恒为 0（内容区的
 * `.el-scrollbar__view` 被 flex 拉伸到容器高，空闲被 flex-grow 吃掉），于是表格
 * 偏小时永远长不回去：刷新后搜索区由元数据占位态收缩（106 → 56px）、表格顶整体
 * 上移，表格高度却停在挂载时按旧 top 算出的值，底部留下约 48px 空白，直到随手
 * 拖动一下窗口宽度才被库内重算修正（用户反馈「刷新后底部空很大，动一下宽度就正常」）。
 *
 * 断言口径：
 * 1. 刷新后与「微调视口宽度后」的底部留白一致（修复前相差约 48px）；
 * 2. 空白收敛后表格高度不小于「视口高 - 表格顶 - 缺省底部预留」（不留下可分配空间）；
 * 3. 收敛后内容区不出现常驻滚动条（表格不能被撑出容器）。
 */
const PAGES = [
  "/system/role/index",
  "/system/logs/operation/index",
  "/system/config/system/index"
];

/** RePlusPage 缺省底部预留（adaptiveConfig.offsetBottom） */
const OFFSET_BOTTOM = 110;
/** 允许 1px 舍入（重算带 1px 余量）与库内重算的 1px 差 */
const TOLERANCE = 3;

async function measure(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const table = document.querySelector(
      ".re-plus-page .pure-table .el-table"
    ) as HTMLElement;
    const card = document.querySelector(
      ".re-plus-page .pure-table"
    ) as HTMLElement;
    const footer = document.querySelector(".layout-footer") as HTMLElement;
    const wrap = document
      .querySelector("#main-content")
      ?.closest<HTMLElement>(".el-scrollbar__wrap");
    const tableRect = table.getBoundingClientRect();
    return {
      tableHeight: Math.round(tableRect.height),
      tableTop: Math.round(tableRect.top),
      // 表格卡片底边到页脚顶边的空白（用户可见的「底部距离」）
      gap: Math.round(
        footer.getBoundingClientRect().top - card.getBoundingClientRect().bottom
      ),
      overflow: wrap ? wrap.scrollHeight - wrap.clientHeight : 0,
      innerHeight: window.innerHeight
    };
  });
}

test.describe("列表页表格自适应高度", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const path of PAGES) {
    test(`${path} 刷新后不留多余底部空白`, async ({ page }) => {
      await login(page);
      await page.goto(`/#${path}`);
      const row = page
        .locator(".re-plus-page .el-table__body tbody tr")
        .first();
      await row.waitFor({ timeout: 20_000 });
      await page.waitForTimeout(900);

      await page.reload();
      await row.waitFor({ timeout: 20_000 });
      await page.waitForTimeout(1200);
      const afterReload = await measure(page);

      // 微调视口宽度（模拟用户随手拖动窗口）
      await page.setViewportSize({ width: 1442, height: 900 });
      await page.waitForTimeout(700);
      const afterResize = await measure(page);

      expect(
        Math.abs(afterReload.gap - afterResize.gap),
        `刷新后留白 ${afterReload.gap}px 与拖动后 ${afterResize.gap}px 应一致`
      ).toBeLessThanOrEqual(TOLERANCE);

      const desired =
        afterReload.innerHeight - afterReload.tableTop - OFFSET_BOTTOM;
      expect(
        afterReload.tableHeight,
        `表格高度 ${afterReload.tableHeight}px 不应小于可用高度 ${desired}px`
      ).toBeGreaterThanOrEqual(desired - TOLERANCE);

      expect(
        afterReload.overflow,
        "收敛后内容区不应出现常驻滚动条"
      ).toBeLessThanOrEqual(1);
    });
  }
});
