import { expect, test } from "@playwright/test";

import { AesEncrypted } from "../src/utils/aes";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 表单提交失败定位（U-4）：服务端校验错误内联展示后自动滚动并聚焦首个错误字段。
 *
 * 场景：新增用户时用户名与已存在用户重复（服务端唯一性校验 400/1001）→ 弹窗内
 * 用户名表单项进入 error 态且获得焦点（长表单「找不到错在哪」的回归守护）。
 */

test("新增用户用户名重复：错误内联并聚焦到该字段", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const username = `e2e_locate_${Date.now()}`;

  const created = await page.request.post(`${BACKEND_URL}/api/system/user`, {
    headers,
    data: {
      username,
      nickname: username,
      password: await AesEncrypted(username, "E2E-Locate-2026!")
    }
  });
  expect(created.ok(), await created.text()).toBeTruthy();

  try {
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    await expect(page.locator(".el-table").first()).toBeVisible({
      timeout: 15_000
    });

    await page.getByRole("button", { name: "新增" }).first().click();
    const dialog = page.locator(".el-dialog", { hasText: "新增" }).first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // 用户名重复 + 合法密码：保存后由服务端返回字段级错误
    await dialog
      .locator(".el-form-item", { hasText: "用户名" })
      .first()
      .locator("input")
      .first()
      .fill(username);
    await dialog
      .locator(".el-form-item", { hasText: "密码" })
      .first()
      .locator("input")
      .first()
      .fill("E2E-Locate-2026!");
    await dialog
      .getByRole("button", { name: /保存|确定/ })
      .first()
      .click();

    // 字段级错误内联（弹窗保持打开，便于修正重试）
    const errorItem = dialog.locator(".el-form-item.is-error").first();
    await expect(errorItem).toBeVisible({ timeout: 15_000 });
    await expect(errorItem).toContainText(/用户名|已存在|username/i);

    // 自动聚焦到首个错误字段（滚动 + focus 在下一个 tick 执行）
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            Boolean(
              (document.activeElement as HTMLElement | null)?.closest?.(
                ".el-form-item.is-error"
              )
            )
          ),
        { timeout: 10_000 }
      )
      .toBe(true);
  } finally {
    const listed = await page.request.get(
      `${BACKEND_URL}/api/system/user?username=${encodeURIComponent(username)}`,
      { headers }
    );
    const rows = ((await listed.json()) as { data?: { results?: unknown[] } })
      .data?.results as Array<{ pk: string }> | undefined;
    for (const item of rows ?? []) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/user/${item.pk}`, { headers })
        .catch(() => undefined);
    }
  }
});
