import { expect, test, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

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

test("分栏拖拽持久化、刷新保持与重置", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");

  const resizer = page.locator(".splitter-pane-resizer");
  await expect(resizer).toBeVisible({ timeout: 15_000 });
  await waitListLoaded(page);

  // ---- 拖拽到约 40% ----
  await dragResizer(page, 0.4);
  const dragged = await leftPanePercent(page);
  expect(dragged).toBeGreaterThan(35);
  expect(dragged).toBeLessThan(45);

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

  // 远端 PATCH（debounce 800ms）载荷为 SplitPanes 单键，其余站点配置由后端 merge
  const patch = page.waitForRequest(
    req =>
      req.method() === "PATCH" &&
      req.url().includes("/api/system/configs/WEB_SITE_CONFIG")
  );
  await patch;
  // 给 debounce 后的请求留出发送窗口后再刷新，避免竞态
  await page.waitForTimeout(300);

  // ---- 刷新后保持（本地缓存优先） ----
  await page.reload();
  await expect(resizer).toBeVisible({ timeout: 15_000 });
  await waitListLoaded(page);
  const kept = await leftPanePercent(page);
  expect(kept).toBeGreaterThan(35);
  expect(kept).toBeLessThan(45);

  // ---- 双击分隔条重置回默认 20% ----
  await resizer.dblclick();
  await expect
    .poll(() => leftPanePercent(page), { timeout: 5_000 })
    .toBeLessThan(25);

  // ---- 中央重置按钮：单击（无位移）触发重置 ----
  await dragResizer(page, 0.6);
  expect(await leftPanePercent(page)).toBeGreaterThan(55);
  const box = await resizer.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect
    .poll(() => leftPanePercent(page), { timeout: 5_000 })
    .toBeLessThan(25);
  const resetStored = await readSplitPanes(page);
  expect(resetStored!["system/user"]).toBeLessThan(25);
});

test("跨设备：本机旧缓存不压制服务器值", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");

  const resizer = page.locator(".splitter-pane-resizer");
  await expect(resizer).toBeVisible({ timeout: 15_000 });
  await waitListLoaded(page);

  // 设备 A：拖到约 60% 并等 PATCH 落库
  await dragResizer(page, 0.6);
  expect(await leftPanePercent(page)).toBeGreaterThan(55);
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
    .poll(() => leftPanePercent(page), { timeout: 5_000 })
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
    .poll(() => leftPanePercent(page), { timeout: 5_000 })
    .toBeGreaterThan(55);
});
