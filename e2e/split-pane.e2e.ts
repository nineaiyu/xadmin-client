import { expect, test, type Page } from "@playwright/test";

import {
  BACKEND_URL,
  PANEL_ACTION_TIMEOUT,
  getAccessToken,
  login,
  openMenuPath
} from "./helpers";

/**
 * 可拖拽分栏（ReSplitPane）+ 宽度持久化主链路（system/user 页）：
 * - 拖拽分隔条 → localStorage 即时落盘 + 远端 PATCH WEB_SITE_CONFIG.SplitPanes
 *   （debounce 单键合并）→ 刷新后保持 → 双击/中央按钮重置回默认比例；
 * - 跨设备：清掉本地即时层（等价新设备空 localStorage）后刷新，靠远端值渲染。
 *
 * 双浏览器共享同一库：SplitPanes 是 map，按本 run 的 pageKey（system/user）读写
 * 互不影响；拖拽目标比例取中段值避开 minPercent(10) 边界，容差放宽到 ±5
 * （boundingBox 取整 + Math.floor 千分位精度的天然误差）。
 */

const readSplitPanes = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.endsWith("splitPanes"));
    return key
      ? (JSON.parse(localStorage.getItem(key)!) as Record<string, number>)
      : null;
  });

/**
 * 等首轮列表加载完成（有数据行且加载遮罩退场）再拖拽：
 * el-loading 遮罩覆盖整个分栏容器（含分隔条），遮罩未退场时 mouse 事件被吞成划选，
 * 表现为分隔条不动、表格文本被选中（左栏停在默认 20%）。
 */
const waitListLoaded = (page: Page) =>
  Promise.all([
    expect(page.locator(".el-table__row").first()).toBeVisible({
      timeout: 15_000
    }),
    expect(page.locator(".el-loading-mask")).toHaveCount(0, {
      timeout: 15_000
    })
  ]);

/** 拖拽分隔条到容器横向百分比 toPercent 处（steps 保证连续 mousemove 生效） */
async function dragResizer(page: Page, toPercent: number) {
  const container = await page.locator(".vue-splitter-container").boundingBox();
  const resizer = await page.locator(".splitter-pane-resizer").boundingBox();
  expect(container).toBeTruthy();
  expect(resizer).toBeTruthy();
  const y = resizer!.y + resizer!.height / 2;
  await page.mouse.move(resizer!.x + resizer!.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(container!.x + container!.width * toPercent, y, {
    steps: 10
  });
  await page.mouse.up();
}

/** 读取左栏当前宽度百分比（内联 style，如 width: 34.56%） */
const leftPanePercent = (page: Page) =>
  page
    .locator(".splitter-paneL")
    .evaluate((el: HTMLElement) => parseFloat(el.style.width));

/**
 * 服务端 SplitPanes 状态复原：分栏比例经 WEB_SITE_CONFIG 持久化，**跨浏览器会话生效**。
 * 不复原会把本 run 的拖拽结果泄漏给共享库的后续用例/跑批（左栏 60% 会把
 * 用户管理等分栏页的右侧内容挤压变形，表现为搜索输入框宽度为 0 不可填写）。
 * 统一复原到应用默认比例 20（与「重置」语义一致），不回写已污染的历史值。
 */
let restoreSplitPanes: (() => Promise<void>) | null = null;

const captureSplitPanes = async (page: Page) => {
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  restoreSplitPanes = async () => {
    await page.request
      .patch(`${BACKEND_URL}/api/system/configs/WEB_SITE_CONFIG`, {
        headers,
        data: { SplitPanes: { "system/user": 20 } }
      })
      .catch(() => undefined);
  };
};

test.afterEach(async () => {
  if (restoreSplitPanes) {
    await restoreSplitPanes();
    restoreSplitPanes = null;
  }
});

test("分栏拖拽持久化、刷新保持与重置", async ({ page }) => {
  await login(page);
  await captureSplitPanes(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");

  const resizer = page.locator(".splitter-pane-resizer");
  await expect(resizer).toBeVisible({ timeout: 15_000 });
  await waitListLoaded(page);

  // ---- 拖拽到约 40% ----
  // 远端 PATCH（debounce 800ms）的等待必须先于拖拽注册，且只认「载荷含 SplitPanes」
  // 的那一条：该端点是站点配置的通用写入口，其它偏好的 PATCH 响应会让等待提前满足
  // （CI 曾因此读到未落库的服务器值——刷新后回到默认 20）。宽度落位是拖拽后的异步
  // 重排结果，「拖完立刻量」在高负载档会读到旧值，故用轮询断言。
  const patch = page.waitForResponse(resp => {
    if (resp.request().method() !== "PATCH") return false;
    if (!resp.url().includes("/api/system/configs/WEB_SITE_CONFIG")) {
      return false;
    }
    return (resp.request().postData() ?? "").includes("SplitPanes");
  });
  await dragResizer(page, 0.4);
  await expect
    .poll(() => leftPanePercent(page), { timeout: PANEL_ACTION_TIMEOUT })
    .toBeGreaterThan(35);
  expect(await leftPanePercent(page)).toBeLessThan(45);

  // localStorage 即时层（拖拽结束同步写入，不经 debounce）
  const stored = await readSplitPanes(page);
  expect(stored).toBeTruthy();
  expect(stored!["system/user"]).toBeGreaterThan(35);
  expect(stored!["system/user"]).toBeLessThan(45);

  // 拖拽不得在左右栏产生文本选区残留（防划选遮罩 + body 禁选锁）
  const selection = await page.evaluate(
    () => window.getSelection()?.toString() ?? ""
  );
  expect(selection).toBe("");

  // 等「落库响应」而非「请求已发出」：刷新需读到服务器上的新比例（见上方 waiter 注释）
  await patch;

  // ---- 刷新后保持（本地缓存优先） ----
  await page.reload();
  await expect(resizer).toBeVisible({ timeout: 15_000 });
  await waitListLoaded(page);
  // 刷新后按本地缓存优先渲染，落位同样是异步的（CI 曾出现读到默认 20 的一次性断言失败）
  await expect
    .poll(() => leftPanePercent(page), { timeout: PANEL_ACTION_TIMEOUT })
    .toBeGreaterThan(35);
  expect(await leftPanePercent(page)).toBeLessThan(45);

  // ---- 双击分隔条重置回默认 20% ----
  // 双击的两次 click 之间存在重排：第一次 click 触发重置后分隔条跳回左侧，第二次
  // click 落到重排后的表格数据列上；若命中用户名列（用户抽屉入口）会误开抽屉，
  // 其遮罩层吞掉后续分隔条拖拽（elementFromPoint 命中 .el-overlay）。这里显式关闭
  // 可能的误开抽屉，保证后续步骤在无遮罩状态下进行（详见 e2e/README 陷阱表）。
  await resizer.dblclick();
  await expect
    .poll(() => leftPanePercent(page), { timeout: PANEL_ACTION_TIMEOUT })
    .toBeLessThan(25);
  const strayDrawer = page.locator(".el-drawer:visible").first();
  // 第二次 click 命中用户名后抽屉异步打开：给一个短落位窗口再判断/关闭
  await page.waitForTimeout(300);
  if (await strayDrawer.count()) {
    await page.keyboard.press("Escape");
    await expect(strayDrawer).toBeHidden({ timeout: 5_000 });
  }

  // ---- 中央重置按钮：单击（无位移）触发重置 ----
  await dragResizer(page, 0.6);
  // 抽屉遮罩仍可能吞掉拖拽（首次判断后异步打开）：关闭后重试一次
  if ((await leftPanePercent(page)) < 30) {
    await page.keyboard.press("Escape");
    await expect(page.locator(".el-drawer:visible")).toHaveCount(0, {
      timeout: 5_000
    });
    await dragResizer(page, 0.6);
  }
  expect(await leftPanePercent(page)).toBeGreaterThan(55);
  // 单击重置：点击可能落在重排瞬间（未命中分隔条）或重置链路在高负载下变慢，
  // 以「点击 → 复测」的轮询替代单次点击（首次即生效时不再补点）
  const box = await resizer.boundingBox();
  await expect
    .poll(
      async () => {
        if ((await leftPanePercent(page)) < 25) return 0;
        await page.mouse.click(
          box!.x + box!.width / 2,
          box!.y + box!.height / 2
        );
        await page.waitForTimeout(400);
        return leftPanePercent(page);
      },
      { timeout: PANEL_ACTION_TIMEOUT, intervals: [800, 1_200] }
    )
    .toBeLessThan(25);
  const resetStored = await readSplitPanes(page);
  expect(resetStored!["system/user"]).toBeLessThan(25);
});

test("跨设备：本机旧缓存不压制服务器值", async ({ page }) => {
  await login(page);
  await captureSplitPanes(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");

  const resizer = page.locator(".splitter-pane-resizer");
  await expect(resizer).toBeVisible({ timeout: 15_000 });
  await waitListLoaded(page);

  // 设备 A：拖到约 60% 并等 PATCH 落库。防抖（800ms）+ 落库缓冲属服务端写路径的
  // 时间域，后续步骤要先刷新再读服务器值，无单一 DOM 信号可替代，保留固定观察窗
  await dragResizer(page, 0.6);
  await expect
    .poll(() => leftPanePercent(page), { timeout: PANEL_ACTION_TIMEOUT })
    .toBeGreaterThan(55);
  await page.waitForTimeout(1200);

  // 场景一（曾复现"刷新还是老数据"）：本机此前拖过、本地残留旧值 20%，
  // 服务器已是另一设备保存的 60% —— 刷新后必须以服务器为准并回写本地
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.endsWith("splitPanes"))!;
    localStorage.setItem(key, JSON.stringify({ "system/user": 20 }));
  });
  await page.reload();
  await expect(resizer).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(() => leftPanePercent(page), { timeout: PANEL_ACTION_TIMEOUT })
    .toBeGreaterThan(55);
  const rewritten = await readSplitPanes(page);
  expect(rewritten!["system/user"]).toBeGreaterThan(55);

  // 场景二：全新设备（本地无缓存）同样以服务器值为准
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(k => k.endsWith("splitPanes"))
      .forEach(k => localStorage.removeItem(k));
  });
  await page.reload();
  await expect(resizer).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(() => leftPanePercent(page), { timeout: PANEL_ACTION_TIMEOUT })
    .toBeGreaterThan(55);
});
