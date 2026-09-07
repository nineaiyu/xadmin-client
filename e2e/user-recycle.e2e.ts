import { expect, test } from "@playwright/test";
import CryptoJS from "crypto-js";

import { BACKEND_URL, getAccessToken, login } from "./helpers";

/** 与 src/utils/aes.ts 的 AesEncrypted(key, msg) 同实现（openssl 口令派生格式） */
const aesEncrypted = (key: string, msg: string): string =>
  CryptoJS.AES.encrypt(msg, key).toString();

/**
 * 用户回收站 E2E：删除 → 抽屉可见 → 恢复 → 列表重现。
 * 用户页 recycleBin 与主列表同字段展示（含 gender 标签等自定义渲染器），
 * 本用例守护"el-table-column 空 row 初始化调用导致整表渲染崩溃"的回归。
 */

test("用户回收站：删除 → 回收站恢复 → 列表重现", async ({ page }) => {
  const username = `e2e_recycle_u_${Date.now()}`;

  await login(page);
  const token = await getAccessToken(page);
  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "e2e-test"
  };

  // API 创建并删除用户（新增表单链路由其他用例覆盖）
  const created = await page.request.post(`${BACKEND_URL}/api/system/user`, {
    headers,
    data: {
      username,
      nickname: username,
      password: aesEncrypted(username, "E2E-Recycle-2026!")
    }
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const createdBody = await created.json();
  const pk = createdBody.data.pk as string;
  expect(pk).toBeTruthy();

  const deleted = await page.request.delete(
    `${BACKEND_URL}/api/system/user/${pk}`,
    { headers }
  );
  expect(deleted.ok(), await deleted.text()).toBeTruthy();

  // 菜单导航（直跳 hash 会在动态路由就绪前被重定向回首页）
  await page.getByRole("menuitem", { name: "系统管理" }).first().click();
  await page.locator(`a[href="#/system/user/index"]`).first().click();
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });

  // 打开回收站抽屉，已删除用户可见（渲染崩溃会导致抽屉打不开）
  await page.getByRole("button", { name: "回收站" }).first().click();
  const drawer = page.locator(".el-drawer.recycle-bin-drawer");
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  const drawerRow = drawer.locator(".el-table__row", { hasText: username });
  await expect(drawerRow).toBeVisible({ timeout: 15_000 });

  // 单行恢复 → 抽屉中消失
  await drawerRow.getByRole("button", { name: "恢复" }).last().click();
  await page
    .locator(".el-popper")
    .filter({ hasText: "确定恢复该条数据" })
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  await expect(drawerRow).toHaveCount(0, { timeout: 15_000 });

  // 关闭抽屉，主列表重现
  await drawer.locator(".el-drawer__close-btn").first().click();
  await expect(drawer).not.toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator(".el-table__row", { hasText: username }).first()
  ).toBeVisible({ timeout: 15_000 });
});
