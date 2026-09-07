import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  BACKEND_URL,
  E2E_USER_AGENT,
  getAccessToken,
  login,
  openMenuPath,
  PLAIN_USER
} from "./helpers";

/**
 * 临时冒烟（权限可视化验收，跑完即删）：
 * 超管在用户/角色页打开权限预览抽屉。操作列按钮超出 showNumber=3 时
 * 折叠进「更多」下拉，故先尝试直接点击，失败则展开下拉点击。
 *
 * 注意：
 * - 用户页表格默认排序的首行是 e2e_lock（无角色/部门的锁定测试用户），
 *   其预览 API 码为 0 属正确行为；超管全量断言必须定位到 xadmin 行。
 * - 超管全量菜单（系统管理下 11 个子项 + 顶级菜单）超出默认 720px 视口，
 *   角色管理在 el-scrollbar 溢出区导致链接 hidden，需加高视口。
 */
test.use({ viewport: { width: 1280, height: 1080 } });

async function openPreviewViaRow(page: Page, row: Locator, buttonText: string) {
  const opCell = row.locator("td").last();
  const direct = opCell.getByRole("button", { name: buttonText });
  if (await direct.count()) {
    await direct.first().click();
    return;
  }
  // 展开更多下拉（DOM 中存在多个未展开的 popup 实例，必须按可见过滤）
  const dropdownTrigger = opCell.locator(".el-dropdown").first();
  await dropdownTrigger.hover();
  await page.waitForTimeout(800);
  const item = page
    .locator(".el-dropdown-menu__item")
    .filter({ hasText: buttonText })
    .locator("visible=true")
    .first();
  await expect(item).toBeVisible({ timeout: 10_000 });
  await item.click();
}

test("用户权限预览：抽屉与分区渲染（超管全量）", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");

  // 锁定超管行（e2e_lock 等种子用户的用户名不含 "xadmin"）
  const row = page
    .locator(".el-table__row")
    .filter({ hasText: "xadmin" })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await openPreviewViaRow(page, row, "权限预览");

  const drawer = page.locator(".el-drawer").filter({ hasText: "用户权限预览" });
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  // 全部精确匹配分区标题：超管全量 API 码表格的描述列会渲染含这些字样的权限码（如 U-试算用户的数据权限），子串匹配必然撞车
  await expect(drawer.getByText("基本信息", { exact: true })).toBeVisible();
  await expect(drawer.getByText(/可见菜单树（\d+）/)).toBeVisible();
  await expect(drawer.getByText(/API 权限码（\d+）/)).toBeVisible();
  await expect(drawer.getByText("数据权限", { exact: true })).toBeVisible();
  await expect(drawer.getByText(/字段权限（\d+）/)).toBeVisible();
  await expect(drawer.getByText("数据权限试算", { exact: true })).toBeVisible();
  // 超管旁路提示（仅预览超管本人时出现）
  await expect(drawer.getByText("三层权限全部旁路")).toBeVisible();
});

test("角色授权预览：抽屉渲染", async ({ page }) => {
  await login(page);
  // 角色管理页面菜单挂在「系统管理 → 权限管理」二级目录下（种子 menu.json）
  await openMenuPath(page, ["系统管理", "权限管理"], "/system/role/index");

  const row = page.locator(".el-table__row").first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await openPreviewViaRow(page, row, "授权预览");

  const drawer = page.locator(".el-drawer").filter({ hasText: "角色授权预览" });
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await expect(drawer.getByText("该角色授权的菜单")).toBeVisible();
  await expect(drawer.getByText(/持有该角色的用户（\d+）/)).toBeVisible();
});

test("普通用户直打预览接口：匿名 401 / 无码 403", async ({ page }) => {
  await login(page, PLAIN_USER);
  const token = await getAccessToken(page);
  expect(token).toBeTruthy();
  // 匿名（无 token）：401
  const anon = await page.request.get(
    `${BACKEND_URL}/api/system/user/1/preview`,
    {
      headers: { "User-Agent": E2E_USER_AGENT }
    }
  );
  expect(anon.status()).toBe(401);
  // 登录态但无 preview 权限码（e2e_user 无任何角色）：403
  const resp = await page.request.get(
    `${BACKEND_URL}/api/system/user/1/preview`,
    {
      headers: {
        "User-Agent": E2E_USER_AGENT,
        Authorization: `Bearer ${token}`
      }
    }
  );
  expect(resp.status()).toBe(403);
  // 试算接口同口径
  const trial = await page.request.post(
    `${BACKEND_URL}/api/system/user/1/preview/trial`,
    {
      headers: {
        "User-Agent": E2E_USER_AGENT,
        Authorization: `Bearer ${token}`
      },
      data: { model: "system.userinfo" }
    }
  );
  expect(trial.status()).toBe(403);
});
