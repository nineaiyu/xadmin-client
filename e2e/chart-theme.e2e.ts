import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/**
 * 图表取色守护：项目 EP 桥接层把颜色变量写成 `hsl(var(--token))`，
 * 自定义属性的 computed value 展开后是 CSS Color 4 空格语法（如 `hsl(217 85% 45%)`），
 * 而 zrender 的颜色解析只认逗号语法（parse 前会整体删空格再匹配）——图表一旦拿到
 * 未解析的变量值，渐变 colorStops 会落成 undefined，悬停等状态动画插值时持续抛
 * `Cannot read properties of undefined (reading 'length')`（控制台循环刷屏）。
 * 取色统一走 utils/chartTheme（浏览器探针解析为 rgb 字面量），本用例守护该口径：
 * 首页用户分析概览图表悬停期间不得出现未捕获异常。
 */
test("首页图表悬停不抛色值解析相关的未捕获异常", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(`${error.message}`));

  await login(page);
  await page.goto("/#/welcome");
  const svg = page.locator(".bar-card svg").first();
  await page.locator(".bar-card").first().scrollIntoViewIfNeeded();
  await page.waitForSelector(".bar-card svg", {
    state: "attached",
    timeout: 60_000
  });
  await page.waitForTimeout(1500);

  const box = await svg.boundingBox();
  expect(box, "首页用户分析概览图表应已渲染").toBeTruthy();
  if (!box) return;

  for (let i = 0; i < 10; i++) {
    await page.mouse.move(
      box.x + 20 + i * ((box.width - 40) / 9),
      box.y + box.height / 2
    );
    await page.waitForTimeout(120);
  }

  // 只锚定本用例要防的特征异常（zrender 色值插值）：vite dev 在首次访问时
  // 可能因依赖预构建让动态 import 抖动（`Importing a module script failed`），
  // 与取色无关，不纳入判定但打印出来便于诊断
  const colorErrors = errors.filter(e => /reading 'length'/.test(e));
  expect(
    colorErrors,
    `图表取色相关的未捕获异常：\n${colorErrors.join("\n")}\n（本次收集到的全部异常：\n${errors.join("\n")}）`
  ).toEqual([]);
});
