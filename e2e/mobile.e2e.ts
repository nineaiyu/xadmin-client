import { devices, expect, test } from "@playwright/test";

import { FRONT_URL, login } from "./helpers";

/**
 * 移动端形态守护（P2.6）：iPhone 13 视口下的核心页可用性。
 *
 * 背景：`deviceDetection()` 走 UA 判定（`@pureadmin/utils`），命中的 UA 会进入
 * 「移动形态」——侧栏变成抽屉、页面按移动分支渲染（如用户管理改成上下堆叠）。
 * 本用例钉住三件事：
 *
 * 1. 核心页**无页面级横向溢出**（表格等在容器内横向滚动，不撑破页面）；
 * 2. 侧栏抽屉可用（汉堡 → 抽屉进入视口）；
 * 3. 用户管理堆叠布局里部门树**不得铺满视口**（否则用户列表被推到整屏之外，
 *    2026-09-27 实测缺陷，修复见 UserTree 的 compact 高度）。
 *
 * 仅 chromium：webkit 的 device emulation 在 CI 上与 playwright 版本耦合较紧，
 * 移动形态的判定逻辑与浏览器无关（UA 判定 + CSS 响应式）。
 */

const MOBILE_PAGES = [
  { name: "首页", hash: "/#/welcome" },
  { name: "用户管理", hash: "/#/system/user/index" },
  { name: "账户设置", hash: "/#/user/info/index" },
  { name: "我的填报", hash: "/#/form-collection/my/index" },
  { name: "聊天室", hash: "/#/chat/index" },
  { name: "仪表盘", hash: "/#/analysis/dashboard/index" }
];

test.use({ ...devices["iPhone 13"] });

test.describe("移动端形态（iPhone 13）", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "移动形态判定与浏览器无关，仅跑 chromium 控制成本"
  );

  test("核心页无横向溢出 + 侧栏抽屉可用 + 用户管理堆叠不遮挡列表", async ({
    page
  }) => {
    await login(page);

    for (const item of MOBILE_PAGES) {
      await page.goto(`${FRONT_URL}${item.hash}`);
      await expect(page.locator("body")).toBeVisible();
      // 页面级溢出：出现即说明某处宽度失控（如固定宽表格/弹窗没进滚动容器）
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow, `${item.name} 出现页面级横向溢出`).toBeLessThanOrEqual(
        1
      );
    }

    // 侧栏抽屉：默认在视口外（left < 0）→ 汉堡打开（left ≈ 0）→ 点遮罩收起
    await page.goto(`${FRONT_URL}/#/welcome`);
    const sidebar = page.locator(".sidebar-container");
    const closedBox = await sidebar.boundingBox();
    expect(closedBox?.x ?? 0).toBeLessThan(0);
    await page.locator(".hamburger-container").first().click();
    await expect
      .poll(async () => (await sidebar.boundingBox())?.x ?? -1, {
        timeout: 5_000
      })
      .toBeGreaterThanOrEqual(0);
    // 遮罩覆盖整屏，中心点落在抽屉上会被拦截：按坐标点右侧空白区
    await page.locator(".app-mask").click({ position: { x: 300, y: 300 } });
    await expect
      .poll(async () => (await sidebar.boundingBox())?.x ?? 0, {
        timeout: 5_000
      })
      .toBeLessThan(0);

    // 用户管理：部门树限高（不得占满视口），用户列表进入首屏
    await page.goto(`${FRONT_URL}/#/system/user/index`);
    // 只断言「有数据行」：不得钉具体行（xadmin 是最早创建的账号，共享库跑批后
    // 会被后建账号挤出第一页——列表断言陷阱，见 e2e/README 教训表）
    const userList = page.locator(".el-table__row").first();
    await expect(userList).toBeVisible({ timeout: 15_000 });
    const metrics = await page.evaluate(() => {
      const tree = document.querySelector(".el-tree");
      const table = document.querySelector(".el-table");
      return {
        viewportHeight: window.innerHeight,
        treeHeight: tree ? tree.getBoundingClientRect().height : 0,
        tableTop: table ? Math.round(table.getBoundingClientRect().top) : -1
      };
    });
    expect(metrics.treeHeight).toBeLessThan(metrics.viewportHeight / 2);
    expect(metrics.tableTop).toBeGreaterThan(0);
    expect(metrics.tableTop).toBeLessThan(metrics.viewportHeight);
  });
});
