import { expect, test, type Page } from "@playwright/test";

import { BACKEND_URL, login } from "./helpers";

/**
 * 创建令牌（工具栏入口 → 创建弹层填名称 → 明文弹层取明文并关闭）。
 *
 * 创建表单在弹层内（明文一次性展示需要独立弹层承载）；返回明文供后续 `Pat` 头调用。
 */
async function createToken(page: Page, tokenName: string): Promise<string> {
  await page.getByRole("button", { name: "创建令牌" }).first().click();
  const createDialog = page
    .locator(".el-dialog", { hasText: "创建访问令牌" })
    .first();
  await expect(createDialog).toBeVisible({ timeout: 10_000 });
  await createDialog
    .locator(".el-form-item", { hasText: "令牌名称" })
    .locator("input")
    .first()
    .fill(tokenName);
  await createDialog.getByRole("button", { name: "创建令牌" }).click();

  const tokenDialog = page
    .locator(".el-dialog", { hasText: "令牌创建成功" })
    .first();
  await expect(tokenDialog).toBeVisible({ timeout: 15_000 });
  const codeBlock = tokenDialog.locator("code").first();
  await expect(codeBlock).toBeVisible();
  const plainToken = (await codeBlock.textContent()) ?? "";
  // 关闭弹窗（明文不可再见）
  await page.keyboard.press("Escape");
  await expect(tokenDialog).not.toBeVisible({ timeout: 10_000 });
  return plainToken;
}

/**
 * 个人访问令牌（PAT）全流程：
 * 个人中心创建 token（明文仅展示一次）→ `Authorization: Pat <token>` 调 API 200
 * → UI 吊销 → 同凭证 401（服务端即时失效）。
 */

test("访问令牌：创建 → Pat 头调 API → 吊销后 401", async ({ page }) => {
  await login(page);
  await page.goto("/#/account-settings");
  // 进入「访问令牌」页签
  await page.locator(".el-menu-item", { hasText: "访问令牌" }).first().click();

  const tokenName = `e2e-pat-${Date.now()}`;
  const plainToken = await createToken(page, tokenName);
  expect(plainToken.startsWith("pat_")).toBeTruthy();

  const row = page.locator(".el-table__row", { hasText: tokenName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  // Pat 头调 API：200（权限与账号一致）
  const listResponse = await page.request.get(
    `${BACKEND_URL}/api/system/personal-access-tokens`,
    { headers: { Authorization: `Pat ${plainToken}` } }
  );
  expect(listResponse.status()).toBe(200);

  // UI 吊销（二次确认「确定」，凭证不可恢复）→ 同凭证立即 401
  await row.getByRole("button", { name: "吊销" }).first().click();
  const confirm = page
    .locator(".el-message-box")
    .getByRole("button", { name: "确定" })
    .first();
  await expect(confirm).toBeVisible({ timeout: 10_000 });
  await confirm.click();
  await expect(row).toContainText("禁用", { timeout: 15_000 });

  const revokedResponse = await page.request.get(
    `${BACKEND_URL}/api/system/personal-access-tokens`,
    { headers: { Authorization: `Pat ${plainToken}` } }
  );
  expect(revokedResponse.status()).toBe(401);
});

/**
 * PAT IP 白名单：来源 IP 不在白名单 → 拒绝，加入后放行。
 *
 * E2E 后端由 daphne 直连 127.0.0.1，故用 10.0.0.0/8 构造「未命中」。
 * 认证阶段被拒仍是 401（默认认证链含 JWT，DRF 保留 WWW-Authenticate 挑战），
 * 与 scope 越界的 403 区分。
 */
test("访问令牌 IP 白名单：未命中拒绝 / 命中放行", async ({ page }) => {
  await login(page);
  await page.goto("/#/account-settings");
  await page.locator(".el-menu-item", { hasText: "访问令牌" }).first().click();

  const tokenName = `e2e-pat-ip-${Date.now()}`;
  const plainToken = await createToken(page, tokenName);

  const patCall = () =>
    page.request.get(`${BACKEND_URL}/api/system/personal-access-tokens`, {
      headers: { Authorization: `Pat ${plainToken}` }
    });

  const row = page.locator(".el-table__row", { hasText: tokenName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  // 未配置白名单 = 不限来源
  await expect(row).toContainText("不限来源");
  expect((await patCall()).status()).toBe(200);

  // 配置一个不含来源 IP 的网段 → 调用被拒
  await row.getByTitle("IP 白名单").first().click();
  const ipDialog = page.locator(".el-dialog", { hasText: "IP 白名单" }).first();
  await expect(ipDialog).toBeVisible({ timeout: 10_000 });
  await ipDialog.locator("textarea").fill("10.0.0.0/8");
  await ipDialog.getByRole("button", { name: "保存" }).first().click();
  await expect(ipDialog).not.toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText("IP 白名单：1 条", { timeout: 15_000 });
  expect((await patCall()).status()).toBe(401);

  // 改为放行来源 IP → 调用恢复
  await row.getByTitle("IP 白名单").first().click();
  const allowDialog = page
    .locator(".el-dialog", { hasText: "IP 白名单" })
    .first();
  await expect(allowDialog).toBeVisible({ timeout: 10_000 });
  await allowDialog.locator("textarea").fill("127.0.0.1");
  await allowDialog.getByRole("button", { name: "保存" }).first().click();
  await expect(allowDialog).not.toBeVisible({ timeout: 10_000 });
  expect((await patCall()).status()).toBe(200);

  // 收尾吊销，避免残留可用凭证
  await row.getByRole("button", { name: "吊销" }).first().click();
  const confirm = page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  }
  await expect(row).toContainText("禁用", { timeout: 15_000 });
});

/**
 * PAT scope 方法前缀：``GET /path`` 只放行该 HTTP 方法。
 */
test("访问令牌 scope 方法前缀：GET 放行 / POST 拒绝", async ({ page }) => {
  await login(page);
  await page.goto("/#/account-settings");
  await page.locator(".el-menu-item", { hasText: "访问令牌" }).first().click();

  const tokenName = `e2e-pat-method-${Date.now()}`;
  const plainToken = await createToken(page, tokenName);

  const row = page.locator(".el-table__row", { hasText: tokenName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByTitle("接口范围").first().click();
  // 创建弹层里也有「接口范围」字段，按弹层标题精确定位，避免命中隐藏的创建弹层
  const scopeDialog = page
    .locator(".el-dialog")
    .filter({
      has: page.locator(".el-dialog__title", { hasText: "接口范围" })
    })
    .first();
  await expect(scopeDialog).toBeVisible({ timeout: 10_000 });
  // 自定义条目（下拉未覆盖的路径/正则），一行一条
  await scopeDialog
    .locator("textarea")
    .fill("GET /api/system/personal-access-tokens");
  await scopeDialog.getByRole("button", { name: "保存" }).first().click();
  await expect(scopeDialog).not.toBeVisible({ timeout: 10_000 });

  const headers = { Authorization: `Pat ${plainToken}` };
  expect(
    (
      await page.request.get(
        `${BACKEND_URL}/api/system/personal-access-tokens`,
        { headers }
      )
    ).status()
  ).toBe(200);
  // 同路径换方法：scope 条目限定 GET，故 POST 越界 403
  expect(
    (
      await page.request.post(
        `${BACKEND_URL}/api/system/personal-access-tokens`,
        { headers, data: { name: "e2e-should-be-denied" } }
      )
    ).status()
  ).toBe(403);
});

/**
 * PAT scope：scope 清单限制凭证可调用的路径前缀。
 * 创建令牌 → 行内「接口范围」配置 scope → 命中路径 200 / 越界路径 403
 * → 吊销后同凭证 401。
 */
test("访问令牌 scope：命中 200 / 越界 403 / 吊销 401", async ({ page }) => {
  await login(page);
  await page.goto("/#/account-settings");
  await page.locator(".el-menu-item", { hasText: "访问令牌" }).first().click();

  const tokenName = `e2e-pat-scope-${Date.now()}`;
  const plainToken = await createToken(page, tokenName);

  // 行内「接口范围」按钮 → scope 编辑弹窗（勾选有权限的接口 / 自定义条目一行一条）
  const row = page.locator(".el-table__row", { hasText: tokenName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByTitle("接口范围").first().click();
  // 创建弹层里也有「接口范围」字段，按弹层标题精确定位，避免命中隐藏的创建弹层
  const scopeDialog = page
    .locator(".el-dialog")
    .filter({
      has: page.locator(".el-dialog__title", { hasText: "接口范围" })
    })
    .first();
  await expect(scopeDialog).toBeVisible({ timeout: 10_000 });
  // 令牌自身接口在权限白名单里（不在权限菜单），走自定义条目
  await scopeDialog
    .locator("textarea")
    .fill("/api/system/personal-access-tokens");
  // ReDialog 默认确认按钮文案为「保存」
  await scopeDialog.getByRole("button", { name: "保存" }).first().click();
  await expect(scopeDialog).not.toBeVisible({ timeout: 10_000 });

  // 命中 scope 的路径 200（凭证调自身清单接口）
  const hit = await page.request.get(
    `${BACKEND_URL}/api/system/personal-access-tokens`,
    { headers: { Authorization: `Pat ${plainToken}` } }
  );
  expect(hit.status()).toBe(200);

  // 越界路径 403
  const denied = await page.request.get(`${BACKEND_URL}/api/system/user`, {
    headers: { Authorization: `Pat ${plainToken}` }
  });
  expect(denied.status()).toBe(403);

  // 吊销后同凭证 401（scope 是否配置不影响吊销即时生效）
  await row.getByRole("button", { name: "吊销" }).first().click();
  const confirm = page
    .locator(".el-message-box")
    .getByRole("button", { name: "确定" })
    .first();
  await expect(confirm).toBeVisible({ timeout: 10_000 });
  await confirm.click();
  await expect(row).toContainText("禁用", { timeout: 15_000 });
  const revoked = await page.request.get(
    `${BACKEND_URL}/api/system/personal-access-tokens`,
    { headers: { Authorization: `Pat ${plainToken}` } }
  );
  expect(revoked.status()).toBe(401);
});

/**
 * 接口范围选项：下拉按「本人有权限的接口」收口（scope-options），勾选即写入 scope。
 *
 * 断言不依赖具体菜单文案（各环境菜单名可改），只钉住「能勾、能存、越界被拦」。
 */
test("访问令牌接口范围：勾选有权限的接口即生效", async ({ page }) => {
  await login(page);
  await page.goto("/#/account-settings");
  await page.locator(".el-menu-item", { hasText: "访问令牌" }).first().click();

  const tokenName = `e2e-pat-pick-${Date.now()}`;
  const plainToken = await createToken(page, tokenName);

  const row = page.locator(".el-table__row", { hasText: tokenName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByTitle("接口范围").first().click();
  // 创建弹层里也有「接口范围」字段，按弹层标题精确定位，避免命中隐藏的创建弹层
  const scopeDialog = page
    .locator(".el-dialog")
    .filter({
      has: page.locator(".el-dialog__title", { hasText: "接口范围" })
    })
    .first();
  await expect(scopeDialog).toBeVisible({ timeout: 10_000 });

  // 选项按本人权限异步下发：等加载遮罩消失再展开下拉（否则点击会被遮罩吃掉）
  await expect(scopeDialog.locator(".el-loading-mask")).toHaveCount(0, {
    timeout: 15_000
  });
  await scopeDialog.locator(".el-select").click();
  const firstOption = page.locator(".el-select-dropdown__item:visible").first();
  await expect(firstOption).toBeVisible({ timeout: 15_000 });
  await firstOption.click();
  await page.keyboard.press("Escape");
  await scopeDialog.getByRole("button", { name: "保存" }).first().click();
  await expect(scopeDialog).not.toBeVisible({ timeout: 10_000 });

  // 列表行由「不限」变为 1 条
  await expect(row).toContainText("接口范围：1 条", { timeout: 15_000 });

  // 勾选项即生效：未勾选的令牌自身接口被 scope 拦下 403
  const denied = await page.request.get(
    `${BACKEND_URL}/api/system/personal-access-tokens`,
    { headers: { Authorization: `Pat ${plainToken}` } }
  );
  expect(denied.status()).toBe(403);
});
