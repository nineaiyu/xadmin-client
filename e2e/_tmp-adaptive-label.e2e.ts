import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/** 临时探针：编辑弹窗标签宽度自适应验证（跑完删除） */
test("编辑弹窗标签不折行", async ({ page }) => {
  await login(page);
  await page.goto("/#/default/demo/book/index");
  await expect(page.locator(".re-plus-search-card")).toBeVisible({
    timeout: 15_000
  });
  // E2E 库无书籍数据：走「新增」弹窗（与编辑同一 columns 装配）
  await page.getByRole("button", { name: "新增" }).click();

  const dialog = page.locator(".el-dialog:visible, .el-drawer:visible").first();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const labels = dialog.locator(".el-form-item__label");
  await expect(labels.first()).toBeVisible({ timeout: 10_000 });

  const info = await labels.evaluateAll(els =>
    els.map(el => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const text = (el.textContent ?? "").trim();
      // 行数判定：Range 覆盖文本节点，折行时会返回多个 client rect
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = new Set(
        Array.from(range.getClientRects()).map(r => Math.round(r.top))
      ).size;
      // 文本固有宽度（nowrap 临时 span，复制 label 字体）
      const span = document.createElement("span");
      span.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${style.font}`;
      span.textContent = text;
      document.body.appendChild(span);
      const textWidth = Math.ceil(span.getBoundingClientRect().width);
      span.remove();
      return {
        text,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        textWidth,
        lines
      };
    })
  );
  console.log("LABEL_PROBE " + JSON.stringify(info));

  for (const item of info) {
    if (item.width === 0) continue;
    expect(
      item.lines,
      `标签「${item.text}」折行：lines=${item.lines} textWidth=${item.textWidth} width=${item.width}`
    ).toBe(1);
  }

  await page.waitForTimeout(700);
  await page.screenshot({
    path: "/tmp/adaptive-label-dialog.png",
    fullPage: false
  });
});
