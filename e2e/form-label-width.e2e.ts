import { expect, test, type Locator } from "@playwright/test";

import { PANEL_ACTION_TIMEOUT, login, openMenuPath } from "./helpers";

/**
 * 表单标签宽度守护。
 *
 * 新增/编辑弹窗（RePlusPage 的 `AddOrEdit`）曾把标签宽度写死 100px，导致两类
 * 标签折成两行：长标签（如「是否启用（自定义 input_type 演示）」）与带帮助文本
 * 图标的标签（如「间隔周期」+ 问号），后者折行的可用宽度被图标进一步挤占。
 *
 * 断言口径：把标签整体（文本 + 冒号 + 帮助图标）克隆后按 `nowrap` 实测内容宽度，
 * 内容宽度 + 标签右内边距必须落在标签可用宽度内 —— 折行即失败。
 */
async function collectLabelWidths(dialog: Locator) {
  return dialog.evaluate(scope => {
    // 未激活页签内的标签不参与（display:none，宽度为 0 无法测量）
    const labels = Array.from(
      scope.querySelectorAll<HTMLElement>(".el-form-item__label")
    ).filter(
      label =>
        Boolean(label.textContent?.trim()) &&
        label.getBoundingClientRect().width > 0
    );
    return labels.map(label => {
      const style = window.getComputedStyle(label);
      const probe = label.cloneNode(true) as HTMLElement;
      probe.style.cssText =
        "position:absolute;left:-9999px;top:-9999px;visibility:hidden;" +
        "width:auto;max-width:none;padding:0;margin:0;white-space:nowrap;" +
        `display:${style.display};gap:${style.gap};font:${style.font};` +
        `letter-spacing:${style.letterSpacing};`;
      label.parentElement?.appendChild(probe);
      const contentWidth = probe.getBoundingClientRect().width;
      probe.remove();
      return {
        text: (label.textContent ?? "").trim(),
        width: Math.round(label.getBoundingClientRect().width),
        need: Math.ceil(
          contentWidth + (Number.parseFloat(style.paddingRight) || 0)
        )
      };
    });
  });
}

function expectNoWrap(
  items: Array<{ text: string; width: number; need: number }>
) {
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
    expect(
      item.need,
      `标签「${item.text}」折行：need=${item.need} width=${item.width}`
    ).toBeLessThanOrEqual(item.width);
  }
}

test("表单标签宽度：长标签不折行（书籍弹窗）", async ({ page }) => {
  await login(page);
  await page.goto("/#/default/demo/book/index");
  await expect(page.locator(".re-plus-search-card")).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("button", { name: "新增" }).click();

  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: PANEL_ACTION_TIMEOUT });
  await expect(dialog.locator(".el-form-item__label").first()).toBeVisible({
    timeout: PANEL_ACTION_TIMEOUT
  });
  // 等宽度校正落地（挂载后按真实内容实测一次）
  await page.waitForTimeout(400);

  const items = await collectLabelWidths(dialog);
  expectNoWrap(items);
  // 自适应生效：长标签把统一宽度推到固定值 100px 以上
  expect(Math.max(...items.map(item => item.width))).toBeGreaterThan(100);
});

test("表单标签宽度：标签变宽后半宽列控件不被压塌（书籍弹窗）", async ({
  page
}) => {
  await login(page);
  await page.goto("/#/default/demo/book/index");
  await expect(page.locator(".re-plus-search-card")).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("button", { name: "新增" }).click();

  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: PANEL_ACTION_TIMEOUT });
  await expect(dialog.locator(".el-form-item__label").first()).toBeVisible({
    timeout: PANEL_ACTION_TIMEOUT
  });
  await page.waitForTimeout(400);

  // 售价是半宽列（colProps md/lg/xl: 12）+ el-input-number：标签占宽后控件被
  // 压塌到几十像素会直接无法输入，故断言其可用宽度
  const priceNumber = dialog
    .locator(".el-form-item")
    .filter({ hasText: "售价" })
    .first()
    .locator(".el-input-number");
  await expect(priceNumber).toBeVisible({ timeout: PANEL_ACTION_TIMEOUT });
  const priceBox = await priceNumber.boundingBox();
  expect(priceBox?.width ?? 0).toBeGreaterThanOrEqual(120);

  // 文件信息页签：上传区块不得超出弹窗内容区（右列曾被挤出可视区）
  await dialog.getByRole("tab", { name: "文件信息" }).click();
  await page.waitForTimeout(400);
  const overflowCount = await dialog.evaluate(el => {
    const body = el.querySelector<HTMLElement>(".el-dialog__body");
    if (!body) return -1;
    const bodyRight = body.getBoundingClientRect().right;
    return Array.from(el.querySelectorAll<HTMLElement>(".el-form-item")).filter(
      item => {
        const rect = item.getBoundingClientRect();
        return rect.width > 0 && rect.right - bodyRight > 1;
      }
    ).length;
  });
  expect(overflowCount).toBe(0);
});

test("表单标签宽度：带帮助图标的标签不折行（间隔调度弹窗）", async ({
  page
}) => {
  await login(page);
  await openMenuPath(
    page,
    ["系统管理", "任务管理"],
    "/system/celery/interval/index"
  );
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("button", { name: "新增" }).first().click();

  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: PANEL_ACTION_TIMEOUT });
  await expect(dialog.locator(".el-form-item__label").first()).toBeVisible({
    timeout: PANEL_ACTION_TIMEOUT
  });
  await page.waitForTimeout(400);

  expectNoWrap(await collectLabelWidths(dialog));
});
