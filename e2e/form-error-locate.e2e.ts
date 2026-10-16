import { expect, test } from "@playwright/test";

import { login, openList, waitForLoadingMaskGone } from "./helpers";

/**
 * 表单校验错误定位（scrollToFirstError）：
 * - RePlusPage 弹窗表单提交校验失败 → 滚动到首个错误字段并聚焦其控件；
 * - EP 2.14 弹窗的滚动容器是 `.el-overlay-dialog`（overflow:auto；`.el-overlay`
 *   只承载遮罩，`.el-dialog__body` 不做滚动）；
 * - 断言方式：先把弹窗滚动容器滚到底部（制造「错误项在视口外」的确定场景），
 *   再点保存触发校验 → 首个错误项应被拉回视口并聚焦。
 */

test.use({ viewport: { width: 1280, height: 520 } });

test("弹窗表单校验失败：滚动到首个错误字段并聚焦", async ({ page }) => {
  await login(page);
  await openList(page, "/system/user/index", {
    placeholder: "请输入用户名",
    value: "xadmin"
  });

  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await waitForLoadingMaskGone(page);

  // 滚到底部：让「首个错误字段在视口外」成为确定场景（矮视口下用户表单必然溢出）
  const scroller = page.locator(".el-overlay-dialog:visible").first();
  await scroller.evaluate(element => {
    element.scrollTop = element.scrollHeight;
  });
  const scrolledTop = await scroller.evaluate(element => element.scrollTop);
  expect(scrolledTop, "弹窗内容应超出视口（弹窗滚动容器可滚）").toBeGreaterThan(
    0
  );

  // 空表单直接保存 → 校验失败 → 首个错误字段被滚动回视口并聚焦
  await dialog.getByRole("button", { name: "保存" }).click();

  const firstError = dialog.locator(".el-form-item.is-error").first();
  await expect(firstError).toBeVisible({ timeout: 10_000 });
  await expect(firstError).toBeInViewport();
  await expect(firstError.locator("input").first()).toBeFocused();
});
