import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN,
  login,
  openMenuPath,
  openSettingPanel,
  switchSettingTab
} from "./helpers";

/**
 * 布局偏好（项目设置面板）：内容区紧凑模式、顶栏滚动自动隐藏（通用页签）、
 * 圆角 / 字号档位（外观页签）、侧边栏手风琴与页签行为（布局页签）、
 * 动态标题与 ⌘K 快捷键开关（通用页签）。
 *
 * 所有偏好都实时落库（站点配置自动保存 PATCH），且会改变后续页面观感 ——
 * 用例结束必须复位，否则污染其它用例与视觉基线（与 theme-dark 同口径）。
 */

const SITE_CONFIG_URL = "/api/system/configs/WEB_SITE_CONFIG";

type BooleanPreferenceField =
  | "CompactMode"
  | "HeaderAutoHide"
  | "SidebarAccordion"
  | "TagsMiddleClickClose"
  | "DynamicTitle"
  | "ShortcutSearch"
  | "HeaderFixed"
  | "BreadcrumbVisible"
  | "NavbarSearch"
  | "NavbarLanguage"
  | "NavbarFullscreen"
  | "NavbarNotice"
  | "NavbarLock"
  | "SemiDarkSidebar"
  | "SemiDarkHeader";

type PreferenceField =
  | BooleanPreferenceField
  | "TagsStyle"
  | "Radius"
  | "FontScale"
  | "FontScaleCustom"
  | "PageTransition"
  | "SidebarWidth"
  | "MaxTagsCount"
  | "Locale"
  | "EpThemeColor";

/**
 * 等待面板触发的站点配置 PATCH 落库（自动保存防抖 600ms）。
 *
 * 只认「目标字段值」的那一次保存：切换前后可能各有一次在途的旧配置保存，
 * 只等第一个 PATCH 会等到旧值、随后的刷新断言落空。
 */
async function waitForSiteConfigPatch(
  page: Page,
  field: PreferenceField,
  value: string | boolean | number,
  action: () => Promise<void>
) {
  const saved = page
    .waitForResponse(
      resp =>
        resp.request().method() === "PATCH" &&
        resp.url().includes(SITE_CONFIG_URL) &&
        new RegExp(`"${field}"\\s*:\\s*"?${value}"?`).test(
          resp.request().postData() ?? ""
        ),
      { timeout: 15_000 }
    )
    .catch(() => null);
  await action();
  const response = await saved;
  await response?.finished().catch(() => undefined);
}

/** 面板行（`.setting li` 契约：区块内的行组件）；
 *  `:visible` 过滤掉非活动页签里的同名行（el-tabs 只隐藏不卸载） */
function row(page: Page, label: string | RegExp) {
  return page
    .locator(".right-panel .setting li:visible")
    .filter({ hasText: label })
    .first();
}

/** 切换行内开关（el-switch 根元素无 aria-checked，用内部 checkbox 判定） */
async function setSwitch(
  page: Page,
  label: string | RegExp,
  value: boolean,
  field: BooleanPreferenceField
) {
  const target = row(page, label);
  await expect(target).toBeVisible({ timeout: 10_000 });
  const input = target.locator("input[type=checkbox]").first();
  if ((await input.isChecked()) !== value) {
    await waitForSiteConfigPatch(page, field, value, async () => {
      await target.locator(".el-switch").click();
    });
  }
}

/** 切换区块内的档位按钮组（圆角 / 字号：块内 el-radio-button） */
async function setScale(
  page: Page,
  blockTitle: string | RegExp,
  optionLabel: string | RegExp,
  field: PreferenceField,
  value: string
) {
  const block = page
    .locator(".right-panel .pref-block")
    .filter({ hasText: blockTitle })
    .first();
  const option = block.locator(".el-radio-button").filter({
    hasText: optionLabel
  });
  if ((await option.getAttribute("class"))?.includes("is-active")) return;
  await waitForSiteConfigPatch(page, field, value, async () => {
    await option.first().click();
  });
}

/** 下拉选择（切换动画）：下拉挂到 body，按 combobox 的 aria-controls 精确定位 */
async function setSelect(
  page: Page,
  label: string | RegExp,
  optionLabel: string | RegExp,
  field: PreferenceField,
  value: string
) {
  const target = row(page, label);
  await expect(target).toBeVisible({ timeout: 10_000 });
  await waitForSiteConfigPatch(page, field, value, async () => {
    await target.locator(".el-select").click();
    const listId = await target
      .locator("[aria-controls]")
      .first()
      .getAttribute("aria-controls");
    const option = listId
      ? page.locator(`#${listId} .el-select-dropdown__item`)
      : page.locator(".el-select-dropdown__item");
    await option.filter({ hasText: optionLabel }).first().click();
  });
}

/** 数字输入行（侧栏宽度 / 页签最大数量）：填值后失焦提交（el-input-number 在 change 时落库） */
async function setNumber(
  page: Page,
  label: string | RegExp,
  field: PreferenceField,
  value: number
) {
  const target = row(page, label);
  await expect(target).toBeVisible({ timeout: 10_000 });
  const input = target.locator("input").first();
  if ((await input.inputValue()) === String(value)) return;
  await waitForSiteConfigPatch(page, field, value, async () => {
    await input.fill(String(value));
    await input.blur();
  });
}

/** 切换动画卡片（通用页签的预览网格，按 data-transition 精确定位） */
/** 切换页签风格（面板「布局」→「标签风格」卡片组） */
async function setTagsStyle(page: Page, label: RegExp, value: string) {
  const block = page
    .locator(".right-panel .pref-block")
    .filter({ hasText: /标签风格|Tag style/ })
    .first();
  await expect(block).toBeVisible({ timeout: 10_000 });
  await waitForSiteConfigPatch(page, "TagsStyle", value, async () => {
    await block.getByText(label).first().click();
  });
}

async function setTransitionCard(page: Page, value: string) {
  const card = page.locator(
    `.right-panel .anim-card[data-transition="${value}"]`
  );
  await expect(card).toBeVisible({ timeout: 10_000 });
  if ((await card.getAttribute("class"))?.includes("is-active")) return;
  await waitForSiteConfigPatch(page, "PageTransition", value, async () => {
    await card.click();
  });
}

/** 自定义主色取色（原生 input[type=color] 跨浏览器用脚本填值 + 派发 input） */
async function pickCustomColor(page: Page, color: string) {
  const picker = page.locator(".right-panel .theme-color__picker");
  await expect(picker).toBeAttached({ timeout: 10_000 });
  await waitForSiteConfigPatch(page, "EpThemeColor", color, async () => {
    await picker.evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, color);
  });
}

/** 主色令牌（--primary 内联覆写，默认主色时为空白） */
const primaryTriplet = (page: Page) =>
  page.evaluate(() =>
    document.documentElement.style.getPropertyValue("--primary").trim()
  );

/** 侧栏宽度变量（--sidebar-width 内联覆写，默认档为空白） */
const sidebarWidthVar = (page: Page) =>
  page.evaluate(() =>
    document.documentElement.style.getPropertyValue("--sidebar-width").trim()
  );

/** 按坐标中键点击（页签条带过渡动画，webkit 下 click 会卡在稳定性等待） */
async function middleClick(page: Page, index: number) {
  const box = await page
    .locator(".tags-view .scroll-item")
    .nth(index)
    .boundingBox();
  if (!box) throw new Error(`第 ${index} 个页签不可见`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
    button: "middle"
  });
}

/** 侧栏当前展开的一级菜单数（手风琴判定用；`.outer-most` 为顶层菜单标记） */
const openedSubMenus = (page: Page) =>
  page.locator(".sidebar-container .el-sub-menu.outer-most.is-opened").count();

/** 一级菜单标题（手风琴用例点击用） */
const topMenuTitles = (page: Page) =>
  page.locator(
    ".sidebar-container .el-sub-menu.outer-most > .el-sub-menu__title"
  );

/** 关闭面板：点遮罩（遮罩铺满视口但层级低于面板，点它即「点面板外」） */
async function closePanel(page: Page) {
  const width = page.viewportSize()?.width ?? 1280;
  await page
    .locator(".right-panel-background")
    .click({ position: { x: 120, y: 300 }, force: true });
  await expect
    .poll(
      async () =>
        (await page.locator(".right-panel").first().boundingBox())?.x ?? 0,
      { timeout: 10_000 }
    )
    .toBeGreaterThan(width - 20);
}

test.describe("布局偏好（面板实时生效）", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    // 复位：所有被本用例改过的偏好都回到默认，避免污染其它用例与视觉基线。
    // 面板文案可能被语言用例切成英文，行/页签定位一律中英双语。
    await openSettingPanel(page).catch(() => undefined);

    await switchSettingTab(page, /外观|Appearance/).catch(() => undefined);
    // 自定义主色：仅自定义态需要回退（点回亮白色块 = 默认皮肤 + 默认主色）
    if (
      (await page
        .locator(".right-panel .theme-color__custom.is-custom-active")
        .count()) > 0
    ) {
      await page
        .locator(".right-panel .theme-color li")
        .first()
        .click()
        .catch(() => undefined);
    }
    await setScale(
      page,
      /圆角|Radius/,
      /默认|Default/,
      "Radius",
      "default"
    ).catch(() => undefined);
    await setScale(
      page,
      /字号|Font size/,
      /默认|Default/,
      "FontScale",
      "default"
    ).catch(() => undefined);

    await switchSettingTab(page, /布局|Layout/).catch(() => undefined);
    await setSwitch(page, /固定顶栏|Fixed header/, true, "HeaderFixed").catch(
      () => undefined
    );
    await setSwitch(page, /面包屑|Breadcrumb/, true, "BreadcrumbVisible").catch(
      () => undefined
    );
    await setSwitch(page, /菜单搜索|Menu search/, true, "NavbarSearch").catch(
      () => undefined
    );
    await setSwitch(
      page,
      /语言切换|Language switch/,
      true,
      "NavbarLanguage"
    ).catch(() => undefined);
    await setSwitch(
      page,
      /全屏按钮|Fullscreen button/,
      true,
      "NavbarFullscreen"
    ).catch(() => undefined);
    await setSwitch(page, /消息通知|Notifications/, true, "NavbarNotice").catch(
      () => undefined
    );
    await setSwitch(
      page,
      /锁屏按钮|Lock screen button/,
      true,
      "NavbarLock"
    ).catch(() => undefined);
    await setSwitch(
      page,
      /半暗侧栏|Semi-dark sidebar/,
      false,
      "SemiDarkSidebar"
    ).catch(() => undefined);
    await setSwitch(
      page,
      /半暗顶栏|Semi-dark header/,
      false,
      "SemiDarkHeader"
    ).catch(() => undefined);
    await setNumber(page, /侧栏宽度|Sidebar width/, "SidebarWidth", 210).catch(
      () => undefined
    );
    await setSwitch(
      page,
      /手风琴展开|Accordion/,
      true,
      "SidebarAccordion"
    ).catch(() => undefined);
    await setSwitch(
      page,
      /中键关闭|Middle-click close/,
      true,
      "TagsMiddleClickClose"
    ).catch(() => undefined);
    await setNumber(page, /最大数量|Max count/, "MaxTagsCount", 0).catch(
      () => undefined
    );

    await switchSettingTab(page, /通用|General/).catch(() => undefined);
    await setSelect(page, /语言|Language/, /简体中文/, "Locale", "zh").catch(
      () => undefined
    );
    await setSwitch(page, /紧凑模式|Compact mode/, false, "CompactMode").catch(
      () => undefined
    );
    await setSwitch(
      page,
      /顶栏自动隐藏|Auto-hide header/,
      false,
      "HeaderAutoHide"
    ).catch(() => undefined);
    await setSwitch(page, /动态标题|Dynamic title/, true, "DynamicTitle").catch(
      () => undefined
    );
    await setSwitch(
      page,
      /全局搜索|Global search/,
      true,
      "ShortcutSearch"
    ).catch(() => undefined);
    await setTransitionCard(page, "fade-transform").catch(() => undefined);
  });

  test("偏好抽屉为三页签结构，紧凑模式实时生效并持久化", async ({ page }) => {
    await openSettingPanel(page);
    const tabs = page.locator(".right-panel .el-tabs__item");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveText(/外观|Appearance/);
    await expect(tabs.nth(1)).toHaveText(/布局|Layout/);
    await expect(tabs.nth(2)).toHaveText(/通用|General/);

    await switchSettingTab(page, "通用");
    await expect(row(page, "紧凑模式")).toBeVisible();

    // 开启紧凑模式：内容区行高密度档位（24 → 16）并居中限宽
    await setSwitch(page, "紧凑模式", true, "CompactMode");
    const section = page.locator("section.app-main").first();
    await expect(section).toHaveClass(/compact/, { timeout: 10_000 });
    await expect
      .poll(async () =>
        section.evaluate(el =>
          getComputedStyle(el).getPropertyValue("--content-gap").trim()
        )
      )
      .toBe("16px");

    // 刷新后仍生效（站点配置已落库）
    await page.reload();
    await expect(page.locator("section.app-main").first()).toHaveClass(
      /compact/,
      { timeout: 15_000 }
    );

    // 关闭后恢复缺省留白
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    await setSwitch(page, "紧凑模式", false, "CompactMode");
    await expect(page.locator("section.app-main").first()).not.toHaveClass(
      /compact/,
      { timeout: 10_000 }
    );
  });

  test("顶栏滚动自动隐藏：下滑隐藏、上滑恢复", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    await setSwitch(page, "顶栏自动隐藏", true, "HeaderAutoHide");

    // 复核开关已落本地存储（hook 读同一来源），避免把点选失败误判成动效失效
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("responsive-configure");
      return raw ? JSON.parse(raw).headerAutoHide === true : false;
    });
    expect(stored, "顶栏自动隐藏开关应已开启（存储已更新）").toBe(true);

    await closePanel(page);

    const header = page.locator(".fixed-header").first();
    const scrollWrap = page.locator(".app-main .el-scrollbar__wrap").first();
    await expect(scrollWrap).toBeVisible({ timeout: 10_000 });

    // 向下滚动超过阈值：固定头部整块移出视口
    const hiddenTop = await scrollWrap.evaluate(el => {
      el.scrollTop = 600;
      return el.scrollTop;
    });
    expect(hiddenTop).toBeGreaterThan(96);
    await expect(header).toHaveClass(/header-hidden/, { timeout: 10_000 });
    // 位移判定用 getBoundingClientRect（移出视口后 boundingBox() 返回 null）
    await expect
      .poll(async () => header.evaluate(el => el.getBoundingClientRect().y), {
        timeout: 10_000
      })
      .toBeLessThan(0);

    // 向上滚动：立即恢复
    await scrollWrap.evaluate(el => {
      el.scrollTop = 0;
    });
    await expect(header).not.toHaveClass(/header-hidden/, { timeout: 10_000 });
    await expect
      .poll(async () => header.evaluate(el => el.getBoundingClientRect().y))
      .toBeGreaterThanOrEqual(0);
  });

  test("外观：圆角与字号档位实时缩放设计令牌", async ({ page }) => {
    await openSettingPanel(page);
    // 外观为默认页签
    // 固定测底部操作按钮（面板内其它按钮可能来自各区块，尺寸档不同、圆角口径不同）
    const radiusOf = () =>
      page
        .locator(".right-panel .lay-panel__footer .el-button")
        .first()
        .evaluate(el => getComputedStyle(el).borderRadius);
    // 行标签消费 --font-size-base（外观页签默认可见，避免测量隐藏页签里的元素）
    const labelFontSize = () =>
      row(page, /灰色模式|Grey mode/)
        .locator(".pref-row__text")
        .evaluate(el => parseFloat(getComputedStyle(el).fontSize));

    const defaultRadius = await radiusOf();
    const defaultFont = await labelFontSize();

    // 圆角「特大」：--radius-scale 2 → 按钮圆角翻倍（基准 --radius-sm = 4px）
    await setScale(page, "圆角", "特大", "Radius", "xlarge");
    await expect(page.locator("html")).toHaveAttribute("data-radius", "xlarge");
    await expect.poll(radiusOf).toBe("8px");

    // 字号「大」：文字令牌整体放大，行内标签随之变大
    await setScale(page, "字号", "大", "FontScale", "large");
    await expect(page.locator("html")).toHaveAttribute("data-font", "large");
    await expect.poll(labelFontSize).toBeGreaterThan(defaultFont);

    // 复位到默认档：属性撤除、取值回到迁移前基准
    await setScale(page, "圆角", "默认", "Radius", "default");
    await setScale(page, "字号", "默认", "FontScale", "default");
    await expect(page.locator("html")).not.toHaveAttribute("data-radius");
    await expect(page.locator("html")).not.toHaveAttribute("data-font");
    await expect.poll(radiusOf).toBe(defaultRadius);
  });

  test("布局：侧栏手风琴与页签中键关闭开关生效", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    // 手风琴关闭：两个一级菜单可同时展开（先关开关再刷新，得到确定的初始态）
    await setSwitch(page, "手风琴展开", false, "SidebarAccordion");
    await closePanel(page);
    await page.reload();
    const titles = topMenuTitles(page);
    await titles.nth(0).waitFor({ timeout: 15_000 });
    await titles.nth(0).click();
    await expect.poll(() => openedSubMenus(page)).toBe(1);
    await titles.nth(1).click();
    await expect.poll(() => openedSubMenus(page)).toBe(2);

    // 手风琴打开：同级只保留一项展开
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "手风琴展开", true, "SidebarAccordion");
    await closePanel(page);
    await page.reload();
    await topMenuTitles(page).nth(0).waitFor({ timeout: 15_000 });
    await topMenuTitles(page).nth(0).click();
    await expect.poll(() => openedSubMenus(page)).toBe(1);
    await topMenuTitles(page).nth(1).click();
    await expect.poll(() => openedSubMenus(page)).toBe(1);

    // 中键关闭开关：关掉后中键点击页签不再关闭
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    await openMenuPath(page, ["系统管理"], "/system/menu/index");
    const tabs = page.locator(".tags-view .scroll-item");
    await expect(tabs).toHaveCount(3, { timeout: 15_000 }); // 首页 + 用户管理 + 菜单管理

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    // 用第 2 个页签（首页为固定标签不可关闭；末尾页签在窄视口可能被滚出可视区）
    await setSwitch(page, "中键关闭", false, "TagsMiddleClickClose");
    await closePanel(page);
    await middleClick(page, 1);
    await expect(tabs).toHaveCount(3);

    // 打开后中键点击即关闭
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "中键关闭", true, "TagsMiddleClickClose");
    await closePanel(page);
    await middleClick(page, 1);
    await expect(tabs).toHaveCount(2, { timeout: 10_000 });
  });

  test("通用：动态标题与 ⌘K 快捷键开关", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");

    // 动态标题关闭：跳转页面后浏览器标题保持不变
    await setSwitch(page, "动态标题", false, "DynamicTitle");
    const titleBefore = await page.title();
    await closePanel(page);
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    await expect
      .poll(() => page.title(), { timeout: 10_000 })
      .toBe(titleBefore);

    // 打开后：标题随页面更新
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    await setSwitch(page, "动态标题", true, "DynamicTitle");
    await closePanel(page);
    await openMenuPath(page, ["系统管理"], "/system/menu/index");
    await expect
      .poll(() => page.title(), { timeout: 10_000 })
      .not.toBe(titleBefore);

    // ⌘K 关闭：快捷键不再唤起命令面板，顶栏入口仍可用
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    await setSwitch(page, "全局搜索", false, "ShortcutSearch");
    await closePanel(page);
    const palette = page.getByTestId("command-palette");
    await page.keyboard.press("Control+k");
    await expect(palette).toHaveCount(0);
    await page.locator("#header-search").first().click();
    await expect(palette).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();

    // 打开后：⌘K 重新生效
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    await setSwitch(page, "全局搜索", true, "ShortcutSearch");

    // 切换动画：预览卡片选「关闭」后落库，再选回默认预设
    await setTransitionCard(page, "none");
    const storedTransition = await page.evaluate(() => {
      const raw = localStorage.getItem("responsive-configure");
      return raw ? JSON.parse(raw).pageTransition : undefined;
    });
    expect(storedTransition, "切换动画应已落本地存储").toBe("none");
    await setTransitionCard(page, "fade-transform");

    await closePanel(page);
    await page.keyboard.press("Control+k");
    await expect(palette).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
  });

  test("外观：自定义主色写入主色令牌，可回退预设色", async ({ page }) => {
    await openSettingPanel(page);
    // 外观为默认页签；默认状态下主色无内联覆写
    expect(await primaryTriplet(page)).toBe("");

    await pickCustomColor(page, "#12b76a");
    // 主色令牌被覆写为取色值的 HSL 三元组，色块进入选中态
    await expect
      .poll(() => primaryTriplet(page), { timeout: 10_000 })
      .not.toBe("");
    await expect(page.locator(".right-panel .theme-color__custom")).toHaveClass(
      /is-custom-active/
    );

    // 落本地存储：themeColor 记 custom，色值在 epThemeColor
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("responsive-layout");
      return raw ? JSON.parse(raw) : {};
    });
    expect(stored.themeColor).toBe("custom");
    expect(stored.epThemeColor?.toLowerCase()).toBe("#12b76a");

    // 刷新后仍生效（站点配置已落库）
    await page.reload();
    await expect
      .poll(() => primaryTriplet(page), { timeout: 15_000 })
      .not.toBe("");

    // 回退：点回亮白色块（默认皮肤 + 默认主色，内联覆写撤除）
    await openSettingPanel(page);
    await page.locator(".right-panel .theme-color li").first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => primaryTriplet(page), { timeout: 10_000 }).toBe("");
  });

  test("布局：侧栏宽度实时生效并落库", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    const sidebarWidth = () =>
      page
        .locator(".sidebar-container")
        .first()
        .evaluate(el => getComputedStyle(el).width);
    expect(await sidebarWidth()).toBe("210px");

    await setNumber(page, "侧栏宽度", "SidebarWidth", 260);
    await expect
      .poll(() => sidebarWidthVar(page), { timeout: 10_000 })
      .toBe("260px");
    await expect.poll(sidebarWidth, { timeout: 10_000 }).toBe("260px");

    // 刷新后仍生效（站点配置已落库）
    await page.reload();
    await expect
      .poll(() => sidebarWidthVar(page), { timeout: 15_000 })
      .toBe("260px");
    await expect.poll(sidebarWidth, { timeout: 10_000 }).toBe("260px");

    // 复位到基准宽度：撤除内联覆写、回到设计令牌默认值
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setNumber(page, "侧栏宽度", "SidebarWidth", 210);
    await expect
      .poll(() => sidebarWidthVar(page), { timeout: 10_000 })
      .toBe("");
    await expect.poll(sidebarWidth, { timeout: 10_000 }).toBe("210px");
  });

  test("布局：固定顶栏、面包屑与顶栏组件显隐", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    // 面包屑显隐
    await expect(page.locator(".breadcrumb-container")).toBeVisible();
    await setSwitch(page, "面包屑", false, "BreadcrumbVisible");
    await expect(page.locator(".breadcrumb-container")).toHaveCount(0);
    await setSwitch(page, "面包屑", true, "BreadcrumbVisible");
    await expect(page.locator(".breadcrumb-container")).toBeVisible();

    // 顶栏组件显隐（菜单搜索 / 消息通知；打开设置面板的齿轮不受开关影响）
    await setSwitch(page, "菜单搜索", false, "NavbarSearch");
    await expect(page.locator("#header-search")).toHaveCount(0);
    await setSwitch(page, "菜单搜索", true, "NavbarSearch");
    await expect(page.locator("#header-search")).toBeVisible();
    await setSwitch(page, "消息通知", false, "NavbarNotice");
    await expect(page.locator("#header-notice")).toHaveCount(0);
    await setSwitch(page, "消息通知", true, "NavbarNotice");
    await expect(page.locator("#header-notice")).toBeVisible();

    // 固定顶栏：关闭后走非固定头布局（固定头部整块消失，改由外层滚动）
    await setSwitch(page, "固定顶栏", false, "HeaderFixed");
    await expect(page.locator("section.app-main-nofixed-header")).toBeVisible({
      timeout: 10_000
    });
    await expect(page.locator(".fixed-header")).toHaveCount(0);

    // 打开后恢复固定头布局
    await setSwitch(page, "固定顶栏", true, "HeaderFixed");
    await expect(page.locator("section.app-main")).toBeVisible({
      timeout: 10_000
    });
    await expect(page.locator(".fixed-header")).toHaveCount(1);
  });

  test("布局：页签最大数量自动关闭最早打开的可关闭页签", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setNumber(page, "最大数量", "MaxTagsCount", 2);
    await closePanel(page);

    // 重载让页签回到固定基线（缓存关闭时不保留历史页签）
    await page.reload();
    const tabs = page.locator(".tags-view .scroll-item");
    await expect(tabs.first()).toBeVisible({ timeout: 15_000 });

    await openMenuPath(page, ["系统管理"], "/system/user/index");
    await expect(tabs.filter({ hasText: /用户管理|Users/ })).toHaveCount(1, {
      timeout: 15_000
    });

    // 第二次打开：总数超限，最早打开的用户管理被自动关闭
    await openMenuPath(page, ["系统管理"], "/system/menu/index");
    await expect(tabs.filter({ hasText: /菜单管理|Menus/ })).toHaveCount(1, {
      timeout: 15_000
    });
    await expect(tabs.filter({ hasText: /用户管理|Users/ })).toHaveCount(0);
    await expect(tabs).toHaveCount(2);
  });

  test("通用：面板内切换界面语言并落库", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");

    await setSelect(page, /语言|Language/, /English/, "Locale", "en");
    // 面板文案随语言切换（页签首项变英文）
    await expect(
      page.locator(".right-panel .el-tabs__item").first()
    ).toHaveText(/Appearance/, { timeout: 10_000 });
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("responsive-locale");
      return raw ? JSON.parse(raw).locale : undefined;
    });
    expect(stored).toBe("en");

    // 切回中文
    await setSelect(page, /语言|Language/, /简体中文/, "Locale", "zh");
    await expect(
      page.locator(".right-panel .el-tabs__item").first()
    ).toHaveText(/外观/, { timeout: 10_000 });
  });

  test("布局：半暗侧栏与字号自定义档实时生效", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    // 半暗侧栏：浅色外观下侧栏调色板切到深色档
    const menuBg = () =>
      page
        .locator(".sidebar-container")
        .first()
        .evaluate(el =>
          getComputedStyle(el).getPropertyValue("--pure-theme-menu-bg").trim()
        );
    expect(await menuBg()).not.toBe("#1d2b45");

    await setSwitch(page, "半暗侧栏", true, "SemiDarkSidebar");
    await expect(page.locator("html")).toHaveClass(/semi-dark-sidebar/);
    await expect.poll(menuBg, { timeout: 10_000 }).toBe("#1d2b45");

    await setSwitch(page, "半暗侧栏", false, "SemiDarkSidebar");
    await expect(page.locator("html")).not.toHaveClass(/semi-dark-sidebar/);
    await expect.poll(menuBg, { timeout: 10_000 }).not.toBe("#1d2b45");

    // 字号自定义档：档位切到「自定义」后由滑块写 --font-scale 倍率
    await switchSettingTab(page, "外观");
    expect(
      await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--font-scale")
      )
    ).toBe("");

    await setScale(page, "字号", "自定义", "FontScale", "custom");
    await expect(page.locator("html")).toHaveAttribute("data-font", "custom");

    const runway = row(page, /基准字号|Base font size/).locator(
      ".el-slider__runway"
    );
    const box = await runway.boundingBox();
    expect(box, "基准字号滑块应可见").not.toBeNull();
    // 跑道仅 6px 高：点击点必须在跑道内（y=3），否则会落在父级 .el-slider 上被判拦截
    await runway.click({ position: { x: (box?.width ?? 0) / 2, y: 3 } });
    // 键盘到最大档（EP 滑块支持 Home/End），避免对点击坐标的像素级依赖
    await page.keyboard.press("End");

    // 20px / 14px 基准 = 1.4286 倍率（usePreferenceAttributes 保留 4 位小数）
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            document.documentElement.style.getPropertyValue("--font-scale")
          ),
        { timeout: 10_000 }
      )
      .toBe("1.4286");

    // 复位：切回默认档后内联倍率撤除
    await setScale(page, "字号", "默认", "FontScale", "default");
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.style.getPropertyValue("--font-scale")
        )
      )
      .toBe("");
  });

  test("通用：检查更新给出「已是最新」与「发现新版本」两种结论", async ({
    page
  }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");

    // dev 态 mock 返回当前版本 → 已是最新
    await page
      .getByRole("button", { name: /检查更新|Check for updates/ })
      .click();
    await expect(
      page
        .locator(".el-message")
        .filter({ hasText: /已是最新版本|latest version/ })
        .first()
    ).toBeVisible({ timeout: 10_000 });

    // 远端版本更高 → 提示新版本号
    await page.route("**/version.json*", route =>
      route.fulfill({ json: { version: "99.0.0" } })
    );
    await page
      .getByRole("button", { name: /检查更新|Check for updates/ })
      .click();
    await expect(
      page
        .locator(".el-message")
        .filter({ hasText: /99\.0\.0/ })
        .first()
    ).toBeVisible({ timeout: 10_000 });
    await page.unroute("**/version.json*");
  });

  test("布局：半暗顶栏与快捷键（Alt+S 折叠侧栏 / Alt+L 锁屏）", async ({
    page
  }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    // 半暗顶栏：浅色外观下顶栏底色切到深色调色板（#1d2b45）
    const navbarBg = () =>
      page
        .locator(".navbar")
        .evaluate(el => getComputedStyle(el).backgroundColor);
    expect(await navbarBg()).not.toBe("rgb(29, 43, 69)");

    await setSwitch(page, "半暗顶栏", true, "SemiDarkHeader");
    await expect(page.locator("html")).toHaveClass(/semi-dark-header/);
    await expect.poll(navbarBg, { timeout: 10_000 }).toBe("rgb(29, 43, 69)");

    await setSwitch(page, "半暗顶栏", false, "SemiDarkHeader");
    await expect(page.locator("html")).not.toHaveClass(/semi-dark-header/);
    await expect
      .poll(navbarBg, { timeout: 10_000 })
      .not.toBe("rgb(29, 43, 69)");

    // 面板打开时输入态不响应快捷键，收起面板再验
    await closePanel(page);

    // Alt + S：折叠 / 展开侧栏（与顶栏折叠按钮等效）
    const collapsed = page.locator(".sidebar-container .el-menu--collapse");
    await expect(collapsed).toHaveCount(0);
    await page.keyboard.press("Alt+s");
    await expect(collapsed).toHaveCount(1, { timeout: 10_000 });
    await page.keyboard.press("Alt+s");
    await expect(collapsed).toHaveCount(0, { timeout: 10_000 });

    // Alt + L：锁屏（口令核验走 verify-password）
    await page.keyboard.press("Alt+l");
    await expect(page.locator(".lock-screen")).toBeVisible({ timeout: 10_000 });
    await page.locator("#lock-screen-password").fill(ADMIN.password);
    await page.locator("#lock-screen-password").press("Enter");
    await expect(page.locator(".lock-screen")).toHaveCount(0, {
      timeout: 15_000
    });
  });

  test("布局：页签风格可切到「朴素」（opt-in，不影响既有风格）", async ({
    page
  }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    const plain = page.locator(
      ".tags-view .scroll-container.plain-scroll-container"
    );
    await expect(plain).toHaveCount(0);

    await setTagsStyle(page, /朴素风格|^Plain$/, "plain");
    await expect(plain).toHaveCount(1, { timeout: 10_000 });

    // 刷新后仍为朴素风格（站点配置已落库）
    await page.reload();
    await expect(plain).toHaveCount(1, { timeout: 15_000 });

    // 复位到灵动风格（默认口径）
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setTagsStyle(page, /灵动|Smart/, "smart");
    await expect(plain).toHaveCount(0, { timeout: 10_000 });
  });

  test("布局：页签可拖拽排序，首页固定位不参与", async ({ page }) => {
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    await openMenuPath(page, ["系统管理"], "/system/menu/index");

    const tabs = page.locator(".tags-view .scroll-item");
    await expect(tabs).toHaveCount(3, { timeout: 15_000 });
    const before = await tabs.allTextContents();
    expect(before.length).toBe(3);

    // 把最后一个页签拖到最前：首页固定位不动，拖动项落到第二位
    const last = await tabs.nth(2).boundingBox();
    const first = await tabs.nth(0).boundingBox();
    expect(last, "被拖拽页签应可见").not.toBeNull();
    expect(first, "首页页签应可见").not.toBeNull();
    await page.mouse.move(
      (last?.x ?? 0) + (last?.width ?? 0) / 2,
      (last?.y ?? 0) + (last?.height ?? 0) / 2
    );
    await page.mouse.down();
    // webkit 实测：mousedown 与首次 mousemove 需要跨过一帧，否则 sortable 的
    // fallback 拖拽不启动（chromium 不敏感）——固定等待在此有确定的时间域理由
    await page.waitForTimeout(150);
    await page.mouse.move(
      (first?.x ?? 0) + 6,
      (first?.y ?? 0) + (first?.height ?? 0) / 2,
      { steps: 12 }
    );
    await page.waitForTimeout(150);
    await page.mouse.up();

    await expect
      .poll(async () => (await tabs.allTextContents()).join("|"), {
        timeout: 10_000
      })
      .not.toBe(before.join("|"));

    const after = await tabs.allTextContents();
    expect(after[0], "首页固定位不变").toBe(before[0]);
    expect(after[1], "拖拽项落到第二位").toBe(before[2]);
    expect(after[2]).toBe(before[1]);
  });
});
