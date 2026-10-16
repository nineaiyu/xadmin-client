import { expect, test, type Page } from "@playwright/test";

import { login, openSettingPanel, switchSettingTab } from "./helpers";

/**
 * 主题可见性门禁：各调色板档位（浅色 / 暗色 / 半暗侧栏 / 半暗顶栏）下，
 * 侧栏菜单与顶栏文字的**前景-背景对比度**不低于阈值——挡住「白字白底」类
 * 不可见问题（历史缺陷：半暗侧栏容器底色未随调色板联动，菜单除选中项外不可见）。
 *
 * 阈值取 WCAG AA 大字号档 3:1（导航类文本为大字号）；背景从目标元素向上
 * 回溯到首个不透明底色，前景若带透明度则与背景混合后计算。
 */
const MIN_CONTRAST = 3;

/** 计算 fg 元素文字色与 bg 元素（回溯）底色的对比度 */
async function contrastOf(page: Page, fgSelector: string, bgSelector: string) {
  return page.evaluate(
    ([fgSel, bgSel]) => {
      const parse = (c: string) => {
        const m = (c.match(/[\d.]+/g) ?? []).map(Number);
        return { r: m[0] ?? 0, g: m[1] ?? 0, b: m[2] ?? 0, a: m[3] ?? 1 };
      };
      const blend = (
        fg: { r: number; g: number; b: number; a: number },
        bg: { r: number; g: number; b: number }
      ) => ({
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a)
      });
      const lum = (c: { r: number; g: number; b: number }) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
      };

      const fgEl = document.querySelector(fgSel) as HTMLElement | null;
      if (!fgEl) return null;
      let bgEl: HTMLElement | null = document.querySelector(bgSel);
      let bg = { r: 255, g: 255, b: 255 };
      while (bgEl) {
        const c = parse(getComputedStyle(bgEl).backgroundColor);
        if (c.a > 0) {
          bg = {
            r: c.r * c.a + bg.r * (1 - c.a),
            g: c.g * c.a + bg.g * (1 - c.a),
            b: c.b * c.a + bg.b * (1 - c.a)
          };
          if (c.a >= 1) break;
        }
        bgEl = bgEl.parentElement;
      }
      const fg = blend(parse(getComputedStyle(fgEl).color), bg);
      const l1 = lum(fg);
      const l2 = lum(bg);
      return {
        ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
        fg: getComputedStyle(fgEl).color,
        bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`
      };
    },
    [fgSelector, bgSelector] as const
  );
}

/** 断言指定档位下侧栏未选中菜单项与顶栏文字均可见 */
async function assertVisible(page: Page, tag: string) {
  const side = await contrastOf(
    page,
    ".sidebar-container .el-menu-item:not(.is-active)",
    ".sidebar-container"
  );
  expect(side, `${tag}：应存在未选中的侧栏菜单项`).not.toBeNull();
  expect(
    side!.ratio,
    `${tag}：侧栏菜单不可见（前景 ${side!.fg} / 背景 ${side!.bg}，对比度 ${side!.ratio.toFixed(2)}）`
  ).toBeGreaterThanOrEqual(MIN_CONTRAST);

  const nav = await contrastOf(page, ".navbar", ".navbar");
  expect(nav, `${tag}：应存在顶栏`).not.toBeNull();
  expect(
    nav!.ratio,
    `${tag}：顶栏文字不可见（前景 ${nav!.fg} / 背景 ${nav!.bg}，对比度 ${nav!.ratio.toFixed(2)}）`
  ).toBeGreaterThanOrEqual(MIN_CONTRAST);

  // 顶栏内显式着色的子元素（不继承 .navbar 的文字色）：逐一断言，防「容器变深、
  // 子元素仍用浅色主题深字」的隐性不可见（历史缺陷：品牌标题 / 面包屑内层）
  for (const sel of [
    ".navbar-logo__title",
    ".breadcrumb-container .el-breadcrumb__inner",
    ".navbar-actions .el-dropdown-link"
  ]) {
    const r = await contrastOf(page, sel, ".navbar");
    if (r) {
      expect(
        r.ratio,
        `${tag}：${sel} 不可见（前景 ${r.fg} / 背景 ${r.bg}，对比度 ${r.ratio.toFixed(2)}）`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  }
}

/** 直接切 html 类（聚焦 CSS 调色板层；偏好写入路径由 layout-preferences 覆盖） */
async function setHtmlClass(
  page: Page,
  ops: { add?: string[]; remove?: string[] }
) {
  await page.evaluate(o => {
    const root = document.documentElement;
    o.remove?.forEach(c => root.classList.remove(c));
    o.add?.forEach(c => root.classList.add(c));
  }, ops);
  await page.waitForTimeout(500);
}

test.describe("主题可见性（对比度门禁）", () => {
  test("浅色 / 暗色 / 半暗侧栏 / 半暗顶栏下，侧栏与顶栏文字均可见", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await setHtmlClass(page, {
      remove: ["dark", "semi-dark-sidebar", "semi-dark-header"]
    });
    await assertVisible(page, "浅色默认");

    // 半暗侧栏：容器底色必须随调色板联动（`--sidebar` 需在容器作用域重绑）
    await setHtmlClass(page, { add: ["semi-dark-sidebar"] });
    await assertVisible(page, "半暗侧栏");
    await setHtmlClass(page, { remove: ["semi-dark-sidebar"] });

    // 半暗顶栏：顶栏深底 + 浅色文字
    await setHtmlClass(page, { add: ["semi-dark-header"] });
    await assertVisible(page, "半暗顶栏");
    await setHtmlClass(page, { remove: ["semi-dark-header"] });

    // 暗色外观：整体深色调色板
    await setHtmlClass(page, { add: ["dark"] });
    await assertVisible(page, "暗色外观");

    // 暗色下叠加半暗类：`:not(.dark)` 使其失效，仍应可见
    await setHtmlClass(page, {
      add: ["dark", "semi-dark-sidebar", "semi-dark-header"]
    });
    await assertVisible(page, "暗色 + 半暗类叠加");

    await setHtmlClass(page, {
      remove: ["dark", "semi-dark-sidebar", "semi-dark-header"]
    });
  });

  test("混合布局：半暗顶栏下顶栏一级菜单与品牌标题可见", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    const block = page
      .locator(".right-panel .pref-block")
      .filter({ hasText: /菜单布局|Menu layout/ })
      .first();
    await block.locator('.pref-choice__item[data-choice="mix"]').click();
    await page.waitForTimeout(1500);
    await page
      .locator(".right-panel-background")
      .click({ position: { x: 120, y: 300 }, force: true })
      .catch(() => undefined);
    await page.waitForTimeout(800);

    // 混合布局：顶栏承载一级菜单
    await expect(page.locator(".navbar .el-menu-item").first()).toBeVisible({
      timeout: 10_000
    });

    // 半暗顶栏：顶栏内嵌菜单与品牌区文字必须随调色板变浅（历史缺陷：
    // 只改了顶栏容器色，菜单文字仍是浅色主题的深色 → 深底上不可见；
    // 激活项取主色，属设计调色板范畴，不在本断言内）
    await setHtmlClass(page, { add: ["semi-dark-header"] });
    const menu = await contrastOf(
      page,
      ".navbar .el-menu-item:not(.is-active)",
      ".navbar"
    );
    expect(menu, "顶栏一级菜单应存在").not.toBeNull();
    expect(
      menu!.ratio,
      `半暗顶栏：顶栏菜单不可见（前景 ${menu!.fg} / 背景 ${menu!.bg}，对比度 ${menu!.ratio.toFixed(2)}）`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);

    const logoTitle = await contrastOf(page, ".navbar-logo__title", ".navbar");
    if (logoTitle) {
      expect(
        logoTitle.ratio,
        `半暗顶栏：品牌标题不可见（前景 ${logoTitle.fg} / 背景 ${logoTitle.bg}）`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }

    // 复位：撤半暗类 + 布局回纵向
    await setHtmlClass(page, { remove: ["semi-dark-header"] });
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await block.locator('.pref-choice__item[data-choice="vertical"]').click();
    await page.waitForTimeout(1200);
  });
});
