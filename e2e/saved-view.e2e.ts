import { expect, test } from "@playwright/test";

import { openList, login } from "./helpers";

/**
 * 「我的视图」闭环：保存当前筛选 → 条件摘要 → 用当前筛选更新 → 一键套用 → 删除。
 *
 * 视图名带时间戳：双浏览器阶段共用同一后端库，固定名称会撞 owner+page+name 唯一约束；
 * 用例末尾删除自身数据，保证重复跑批幂等。
 */
test("我的视图：保存 / 更新 / 套用 / 删除", async ({ page }) => {
  const name = `E2E视图${Date.now()}`;
  await login(page);
  await openList(page, "/system/user/index", {
    placeholder: "请输入用户名",
    value: "xadmin"
  });

  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));

  // 保存当前筛选为视图：弹窗内带条件预览（用户名：xadmin）
  await page.getByTestId("saved-view-trigger").click();
  const panel = page.getByTestId("sv-panel");
  await expect(panel).toBeVisible();
  await panel.getByTestId("sv-save").click();

  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-testid="sv-name"] input').fill(name);
  await expect(dialog.getByTestId("sv-conditions")).toContainText(
    "用户名：xadmin"
  );
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).toBeHidden();
  // 保存后按钮回显当前视图名
  await expect(page.getByTestId("saved-view-trigger")).toContainText(name);

  // 改搜索条件：视图里仍是保存时的条件（摘要不变）
  const usernameInput = page.getByPlaceholder("请输入用户名").first();
  await usernameInput.fill("e2e_user");
  await page.getByRole("button", { name: "搜索", exact: true }).first().click();
  await page.getByTestId("saved-view-trigger").click();
  const item = page.getByTestId("sv-item").filter({ hasText: name }).first();
  await expect(item).toContainText("用户名：xadmin");

  // 用当前筛选更新：摘要在面板内即时刷新
  await item.getByTestId("sv-update").click();
  await expect(
    page.getByTestId("sv-item").filter({ hasText: name }).first()
  ).toContainText("用户名：e2e_user");

  // 套用：列表请求带上视图保存的条件
  await usernameInput.fill("xadmin");
  await page.getByRole("button", { name: "搜索", exact: true }).first().click();
  requests.length = 0;
  await page.getByTestId("saved-view-trigger").click();
  await page.getByTestId("sv-item").filter({ hasText: name }).first().click();
  await expect
    .poll(() => requests.some(url => /[?&]username=e2e_user/.test(url)))
    .toBeTruthy();

  // 删除自身数据（共享库幂等）
  await page.getByTestId("saved-view-trigger").click();
  await page
    .getByTestId("sv-item")
    .filter({ hasText: name })
    .first()
    .getByRole("button", { name: "删除" })
    .click();
  await page
    .locator(".el-message-box")
    .getByRole("button", { name: "确定" })
    .click();
  await expect(
    page.getByTestId("sv-item").filter({ hasText: name })
  ).toHaveCount(0);
});
