import { expect, test } from "@playwright/test";

import {
  BACKEND_URL,
  RO_USER,
  getAccessToken,
  login,
  openUserManagement
} from "./helpers";

/**
 * 按钮级权限负向（权限渲染域）：只读账号（有 list/retrieve 等读权限点、
 * 无任何写权限点）在列表页应看不到编辑 / 删除 / 新增按钮，且写接口直调被拒。
 *
 * 种子见 xadmin-server/scripts/e2e_seed.py：e2e_ro 授予用户管理页面 + 全部
 * GET 接口权限点，行数据沿用「仅本人」数据权限 + 全字段白名单（保证有行可断言，
 * 空列表会让按钮隐藏断言失去意义）。此前 hasAuth 按钮隐藏（RePlusPage
 * operationButtons / toolbarButtons 的权限门控）只有单测、无端到端守护。
 */
test("只读账号：操作列无编辑/删除按钮，工具栏无新增", async ({ page }) => {
  await login(page, RO_USER);
  await openUserManagement(page);

  // 行数据就绪：仅本人一条（读权限 + 数据权限齐全，证明「按钮隐藏」不是「页面坏了」）
  const rows = page.locator(".el-table__row");
  await expect(rows).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator(".el-table")).toContainText(RO_USER.username);

  // 写按钮负向：编辑（auth.update 门控）与删除（auth.destroy 门控）不渲染
  await expect(
    page.locator(".el-table__row").getByRole("button", { name: "编辑" })
  ).toHaveCount(0);
  await expect(
    page.locator(".el-table__row").getByRole("button", { name: "删除" })
  ).toHaveCount(0);
  // 工具栏新增（auth.create 门控）同样不渲染
  await expect(
    page.getByRole("button", { name: "新增", exact: true })
  ).toHaveCount(0);

  // 操作列本身存在：用户页声明的「管理」入口按页面配置常显（负向断言的反向对照，
  // 排除「整列未渲染」让编辑/删除断言空洞的可能）
  await expect(
    page.locator(".el-table__row").getByRole("button", { name: "管理" }).first()
  ).toBeVisible();
});

test("只读账号：直接调用用户写接口被拒", async ({ page }) => {
  await login(page, RO_USER);
  const token = await getAccessToken(page);
  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "e2e-test"
  };

  // 读接口对照：仅本人数据权限下列表返回自己一条，并取其 pk
  const listResp = await page.request.get(
    `${BACKEND_URL}/api/identity/user?page=1&limit=10`,
    { headers }
  );
  expect(listResp.status()).toBe(200);
  const payload = await listResp.json();
  const results: Array<Record<string, unknown>> =
    payload?.data?.results ?? payload?.data ?? [];
  expect(results).toHaveLength(1);
  const pk = String(results[0]?.pk ?? results[0]?.id);
  expect(pk).toBeTruthy();

  // 写接口负向：目标是自己也必须 403（前端按钮隐藏只是 UX，服务端强制才是边界）
  const resp = await page.request.patch(
    `${BACKEND_URL}/api/identity/user/${pk}`,
    {
      // 载荷与种子现值相同：即使权限判定意外放行也不产生脏数据
      headers,
      data: { nickname: "E2E只读用户" }
    }
  );
  expect([401, 403]).toContain(resp.status());
});
