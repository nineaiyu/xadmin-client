import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/**
 * 首页图表运行时守护，两类现场：
 *
 * 1. 取色：项目 EP 桥接层把颜色变量写成 `hsl(var(--token))`，自定义属性的 computed
 *    value 展开后是 CSS Color 4 空格语法（如 `hsl(217 85% 45%)`），而 zrender 的颜色
 *    解析只认逗号语法（parse 前会整体删空格再匹配）——图表一旦拿到未解析的变量值，
 *    渐变 colorStops 会落成 undefined，悬停等状态动画插值时持续抛
 *    `Cannot read properties of undefined (reading 'length')`（控制台循环刷屏）。
 *    取色统一走 utils/chartTheme（浏览器探针解析为 rgb 字面量），本用例守护该口径。
 * 2. 按需组件注册：`echarts/core` 路径下漏注册坐标系/图表类时构建不报错，运行时先打
 *    "Component X is used but not imported." 再抛 `findAxisModel` 之类的渲染异常
 *    （工作台趋势数据不足时的环形占位图曾如此打崩）。
 */
test("首页图表悬停不抛色值与按需组件相关的未捕获异常", async ({ page }) => {
  const errors: string[] = [];
  const missingComponentWarnings: string[] = [];
  page.on("pageerror", error => errors.push(`${error.message}`));
  // ECharts 按需注册漏登时会先打 "X is used but not imported." 再抛渲染异常，
  // 控制台警告比崩溃栈更早定位（注册清单一致性另有单测守护：
  // src/plugins/__tests__/echarts.spec.ts，此处守护真实页面链路）
  page.on("console", message => {
    if (/is used but not imported/.test(message.text())) {
      missingComponentWarnings.push(message.text());
    }
  });

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

  // 只锚定本用例要防的特征异常：zrender 色值插值（`reading 'length'`）与按需组件
  // 缺失后的渲染崩溃（`findAxisModel`，极坐标/极轴未注册时的典型现场）。vite dev 在
  // 首次访问时可能因依赖预构建让动态 import 抖动（`Importing a module script failed`），
  // 与图表无关，不纳入判定但打印出来便于诊断
  const chartErrors = errors.filter(e =>
    /reading 'length'|findAxisModel/.test(e)
  );
  expect(
    chartErrors,
    `图表相关的未捕获异常：\n${chartErrors.join("\n")}\n（本次收集到的全部异常：\n${errors.join("\n")}）`
  ).toEqual([]);
  expect(
    missingComponentWarnings,
    `ECharts 按需组件缺失（须登记到 src/plugins/echarts.ts）：\n${missingComponentWarnings.join("\n")}`
  ).toEqual([]);
});

/**
 * 极坐标兜底环守护：统计卡在趋势数据不足一行时改画环形占位图（ChartRound），
 * 走 `coordinateSystem: "polar"` + `series.type: "bar"`。极坐标系未注册时该环必然
 * 打崩（先警告 "Component polar is used but not imported."，再抛
 * `Cannot read properties of undefined (reading 'findAxisModel')`），而种子库的统计
 * 趋势通常有多个点、页面走折线分支，靠真实数据覆盖不到这条路径——故用接口桩把三张
 * 统计卡的趋势清空，把 ChartRound 的渲染固定进门禁。
 */
test("统计卡趋势不足时环形占位图正常渲染（不缺失极坐标组件）", async ({
  page
}) => {
  const errors: string[] = [];
  const missingComponentWarnings: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (/is used but not imported/.test(message.text())) {
      missingComponentWarnings.push(message.text());
    }
  });

  await page.route("**/api/system/dashboard/**", route => {
    if (/trend|active/.test(route.request().url())) return route.continue();
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 1000,
        detail: "",
        percent: 0,
        count: 0,
        results: []
      })
    });
  });

  await login(page);
  await page.goto("/#/welcome");
  // 三张统计卡（第四张是时钟卡）全部回落到环形占位图：环内标题即卡片中央的 100%
  await expect(page.locator('svg text:text-is("100%")')).toHaveCount(3, {
    timeout: 30_000
  });

  expect(missingComponentWarnings, "ECharts 极坐标组件缺失").toEqual([]);
  expect(errors.filter(e => /findAxisModel/.test(e))).toEqual([]);
});
