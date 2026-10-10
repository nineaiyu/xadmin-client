import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN,
  HIGH_LOAD,
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

/**
 * 站点配置 PATCH 等待上限：正常保存 = 600ms 防抖 + 单次请求（本地 <300ms）。
 * 收紧上限让「操作未触发保存」的场景尽快暴露（15s 档一遇空等即整批变慢）；
 * 高负载档放宽，避免把机器忙记成回归（与 helpers 的负载档口径一致）。
 */
const SITE_CONFIG_PATCH_TIMEOUT = HIGH_LOAD ? 15_000 : 5_000;

type BooleanPreferenceField =
  | "CompactMode"
  | "HeaderAutoHide"
  | "SidebarAccordion"
  | "SidebarExpandOnHover"
  | "SidebarDraggable"
  | "SidebarCollapsedShowTitle"
  | "SidebarAutoActivateChild"
  | "TagsMiddleClickClose"
  | "TagsShowIcon"
  | "TagsShowRefresh"
  | "TagsShowMore"
  | "DynamicTitle"
  | "EnablePreferences"
  | "ShortcutSearch"
  | "ShortcutEnable"
  | "HeaderFixed"
  | "BreadcrumbVisible"
  | "BreadcrumbShowIcon"
  | "BreadcrumbShowHome"
  | "BreadcrumbHideOnlyOne"
  | "TransitionProgress"
  | "TransitionLoading"
  | "NavbarSearch"
  | "NavbarLanguage"
  | "NavbarFullscreen"
  | "NavbarNotice"
  | "NavbarLock"
  | "NavbarRefresh"
  | "NavbarSidebarToggle"
  | "NavbarThemeToggle"
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
  | "BreadcrumbStyle"
  | "PreferencesPosition"
  | "Locale"
  | "EpThemeColor"
  | "ShortcutLockKeys"
  | "ShortcutSidebarKeys"
  | "ShortcutSearchKeys"
  | "ShortcutPreferencesKeys"
  | "ShortcutLogoutKeys";

/** 正则转义：键位串含 `+`（量词）等元字符，直接内插会让匹配语义漂移 */
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
        new RegExp(
          `"${field}"\\s*:\\s*"?${escapeRegExp(String(value))}"?`
        ).test(resp.request().postData() ?? ""),
      { timeout: SITE_CONFIG_PATCH_TIMEOUT }
    )
    .catch(() => null);
  await action();
  const response = await saved;
  await response?.finished().catch(() => undefined);
}

/** 键位字段（Pascal）→ 本地存储键（camel） */
const camelField = (field: string) => field[0].toLowerCase() + field.slice(1);

/**
 * 本地存储里的偏好现值：与页面 hydrate/落库同一来源。
 * Locale 存独立命名空间（responsive-locale），其余偏好存 configure 命名空间。
 * 读不到（尚未 hydrate）时返回 undefined，调用方按「值不等」继续操作（安全兜底）。
 */
async function storedPreferenceValue(page: Page, field: PreferenceField) {
  return page.evaluate(
    ([name, key]) => {
      const namespace =
        name === "Locale" ? "responsive-locale" : "responsive-configure";
      const raw = localStorage.getItem(namespace);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return name === "Locale" ? parsed.locale : parsed[key];
    },
    [field, camelField(field)] as const
  );
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
  // 现值已等于目标值时跳过：点击已选中项不触发保存，
  // 等 PATCH 会空等满整个超时（复位场景下几乎每个用例都会命中一次）
  if ((await storedPreferenceValue(page, field)) === value) return;
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

/** 读取本地存储 configure 命名空间里的字段值 */
async function storedConfigureValue(page: Page, key: string) {
  return page.evaluate(k => {
    const raw = localStorage.getItem("responsive-configure");
    return raw ? (JSON.parse(raw)[k] as unknown) : undefined;
  }, key);
}

/**
 * 键位录制：点击键位控件进入录制态 → 按键 → 等待落库。
 * 当前值已等于目标值时跳过（避免等一次不会发生的 PATCH）。
 */
async function recordShortcut(
  page: Page,
  label: string | RegExp,
  keys: string,
  field: PreferenceField,
  expected: string
) {
  if ((await storedConfigureValue(page, camelField(field))) === expected)
    return;
  const target = row(page, label);
  await expect(target).toBeVisible({ timeout: 10_000 });
  const trigger = target.locator(".shortcut-input__trigger");
  await waitForSiteConfigPatch(page, field, expected, async () => {
    await trigger.click();
    await expect(trigger).toHaveClass(/is-recording/);
    await page.keyboard.press(keys);
  });
  await expect(trigger).not.toHaveClass(/is-recording/, { timeout: 10_000 });
}

/** 清除键位（空串 = 不启用该动作） */
async function clearShortcut(
  page: Page,
  label: string | RegExp,
  field: PreferenceField
) {
  if ((await storedConfigureValue(page, camelField(field))) === "") return;
  const target = row(page, label);
  await expect(target).toBeVisible({ timeout: 10_000 });
  await waitForSiteConfigPatch(page, field, "", async () => {
    await target.locator(".shortcut-input__clear").click();
  });
}

/** PrefChoice 卡片组（面包屑样式 / 偏好入口位置等）：按 data-choice 定位并等待落库 */
async function setPrefChoice(
  page: Page,
  value: string,
  field: PreferenceField
) {
  const choice = page.locator(
    `.right-panel .pref-choice__item[data-choice="${value}"]`
  );
  await expect(choice).toBeVisible({ timeout: 10_000 });
  if ((await choice.getAttribute("aria-pressed")) === "true") return;
  await waitForSiteConfigPatch(page, field, value, async () => {
    await choice.click();
  });
}

/** 面包屑样式（普通 / 浅底） */
function setBreadcrumbStyle(page: Page, value: "normal" | "background") {
  return setPrefChoice(page, value, "BreadcrumbStyle");
}

/** 读取前端站点配置（聚合端点，与页面 getSiteConfig 同源） */
async function readSiteConfig(page: Page) {
  const resp = await page.request.get("/api/system/configs/WEB_SITE_CONFIG");
  return ((await resp.json())?.config ?? {}) as Record<string, unknown>;
}

/**
 * 站点配置直写（跨用例共享状态的自愈/还原用）：与页面 saveSiteConfig 走同一
 * 聚合端点——通用 CRUD 端点（`/api/system/config/system`）写库不刷新该端点的
 * 读缓存，直写后页面刷新仍见旧值。写入后回读确认：在途自动保存可能晚到覆盖。
 */
async function patchSiteConfig(page: Page, patch: Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await readSiteConfig(page);
    await page.request.patch("/api/system/configs/WEB_SITE_CONFIG", {
      data: { ...current, ...patch }
    });
    const after = await readSiteConfig(page);
    const ok = Object.entries(patch).every(
      ([key, expected]) => after[key] === expected
    );
    if (ok) return;
    await page.waitForTimeout(400);
  }
}

test.describe("布局偏好（面板实时生效）", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    // 偏好入口自愈（用例可能关闭入口或切到悬浮球）：直写站点配置 + 本地存储后重载
    if (
      (await page
        .locator(".set-icon")
        .count()
        .catch(() => 0)) === 0
    ) {
      // 等自动保存（600ms 防抖）落地，避免自愈被在途保存覆盖
      await page.waitForTimeout(800);
      await patchSiteConfig(page, {
        EnablePreferences: true,
        PreferencesPosition: "header"
      }).catch(() => undefined);
      await page
        .evaluate(() => {
          const raw = localStorage.getItem("responsive-configure");
          if (!raw) return;
          const cfg = JSON.parse(raw);
          cfg.enablePreferences = true;
          cfg.preferencesPosition = "header";
          localStorage.setItem("responsive-configure", JSON.stringify(cfg));
        })
        .catch(() => undefined);
      await page.reload().catch(() => undefined);
      await page
        .locator(".set-icon")
        .first()
        .waitFor({ timeout: 15_000 })
        .catch(() => undefined);
    }

    // 侧栏若处于折叠态（快捷键 / 悬停用例可能折叠过），先展开复位
    if (
      (await page
        .locator(".sidebar-container .el-menu--collapse")
        .count()
        .catch(() => 0)) > 0
    ) {
      await page.keyboard.press("Alt+s").catch(() => undefined);
    }

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
    await setTransitionCard(page, "fade-transform").catch(() => undefined);

    // 快捷键页签：总开关与各动作键位全部复位（键位串比较走本地存储，值一致即跳过录制）
    await switchSettingTab(page, /快捷键|Shortcuts/).catch(() => undefined);
    await setSwitch(
      page,
      /快捷键开关|Enable shortcuts/,
      true,
      "ShortcutEnable"
    ).catch(() => undefined);
    await recordShortcut(
      page,
      /锁屏|Lock screen/,
      "Alt+l",
      "ShortcutLockKeys",
      "alt+l"
    ).catch(() => undefined);
    await recordShortcut(
      page,
      /折叠侧栏|Toggle sidebar/,
      "Alt+s",
      "ShortcutSidebarKeys",
      "alt+s"
    ).catch(() => undefined);
    await recordShortcut(
      page,
      /全局搜索|Global search/,
      "Control+k",
      "ShortcutSearchKeys",
      "mod+k"
    ).catch(() => undefined);
    await recordShortcut(
      page,
      /打开项目配置|Open preferences/,
      "Control+,",
      "ShortcutPreferencesKeys",
      "mod+,"
    ).catch(() => undefined);
    await clearShortcut(page, /退出登录|Sign out/, "ShortcutLogoutKeys").catch(
      () => undefined
    );

    // 页签细分 / 面包屑细分 / 顶栏补充按钮复位（布局页签区块）
    await switchSettingTab(page, /布局|Layout/).catch(() => undefined);
    await setSwitch(page, /页签图标|Tab icons/, true, "TagsShowIcon").catch(
      () => undefined
    );
    await setSwitch(
      page,
      /刷新按钮|Refresh button/,
      true,
      "TagsShowRefresh"
    ).catch(() => undefined);
    await setSwitch(page, /更多按钮|More button/, true, "TagsShowMore").catch(
      () => undefined
    );
    await setSwitch(
      page,
      /面包屑图标|Breadcrumb icons/,
      true,
      "BreadcrumbShowIcon"
    ).catch(() => undefined);
    await setSwitch(
      page,
      /显示首页|Show home/,
      false,
      "BreadcrumbShowHome"
    ).catch(() => undefined);
    await setSwitch(
      page,
      /仅一项时隐藏|Hide when single/,
      false,
      "BreadcrumbHideOnlyOne"
    ).catch(() => undefined);
    await setSwitch(
      page,
      /悬停展开|Expand on hover/,
      true,
      "SidebarExpandOnHover"
    ).catch(() => undefined);
    await setSwitch(
      page,
      /拖拽调宽|Drag to resize/,
      false,
      "SidebarDraggable"
    ).catch(() => undefined);
    await setBreadcrumbStyle(page, "normal").catch(() => undefined);
    await setSwitch(
      page,
      /顶栏刷新|Header refresh/,
      true,
      "NavbarRefresh"
    ).catch(() => undefined);
    await setSwitch(
      page,
      /顶栏折叠|Header sidebar toggle/,
      false,
      "NavbarSidebarToggle"
    ).catch(() => undefined);
    await setSwitch(
      page,
      /顶栏明暗切换|Header theme toggle/,
      false,
      "NavbarThemeToggle"
    ).catch(() => undefined);

    // 偏好入口复位（通用页签）：开关与位置
    await switchSettingTab(page, /通用|General/).catch(() => undefined);
    await setSwitch(
      page,
      /设置入口|Settings entry/,
      true,
      "EnablePreferences"
    ).catch(() => undefined);
    await setPrefChoice(page, "header", "PreferencesPosition").catch(
      () => undefined
    );

    // 过渡开关复位（通用页签）
    await switchSettingTab(page, /通用|General/).catch(() => undefined);
    await setSwitch(
      page,
      /顶部进度条|Top progress bar/,
      true,
      "TransitionProgress"
    ).catch(() => undefined);
    await setSwitch(
      page,
      /内容区 loading|Content loading/,
      false,
      "TransitionLoading"
    ).catch(() => undefined);
  });

  test("偏好抽屉为四页签结构，紧凑模式实时生效并持久化", async ({ page }) => {
    await openSettingPanel(page);
    const tabs = page.locator(".right-panel .el-tabs__item");
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toHaveText(/外观|Appearance/);
    await expect(tabs.nth(1)).toHaveText(/布局|Layout/);
    await expect(tabs.nth(2)).toHaveText(/通用|General/);
    await expect(tabs.nth(3)).toHaveText(/快捷键|Shortcuts/);

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

  test("通用：动态标题与 ⌘K 快捷键", async ({ page }) => {
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

    // 全局搜索键位清空：快捷键不再唤起命令面板，顶栏入口仍可用
    await openSettingPanel(page);
    await switchSettingTab(page, /快捷键|Shortcuts/);
    await clearShortcut(page, /全局搜索|Global search/, "ShortcutSearchKeys");
    await closePanel(page);
    const palette = page.getByTestId("command-palette");
    await page.keyboard.press("Control+k");
    await expect(palette).toHaveCount(0);
    await page.locator("#header-search").first().click();
    await expect(palette).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();

    // 录回默认键位后：⌘K 重新生效（末尾统一验证）
    await openSettingPanel(page);
    await switchSettingTab(page, /快捷键|Shortcuts/);
    await recordShortcut(
      page,
      /全局搜索|Global search/,
      "Control+k",
      "ShortcutSearchKeys",
      "mod+k"
    );

    // 切换动画：预览卡片选「关闭」后落库，再选回默认预设（动画区块在通用页签）
    await switchSettingTab(page, "通用");
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

    // 鼠标移出侧栏：关闭面板的遮罩点击会把光标留在侧栏区域内，
    // 与「折叠态悬停临时展开」存在竞态（悬停展开期间折叠类不出现）
    await page.mouse.move(700, 300);

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

  test("快捷键：自定义锁屏键位即时生效，旧键位失效", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, /快捷键|Shortcuts/);

    // 锁屏键位录成 Ctrl+Shift+L（录制回显随平台：macOS 用符号串）
    await recordShortcut(
      page,
      /锁屏|Lock screen/,
      "Control+Shift+l",
      "ShortcutLockKeys",
      "mod+shift+l"
    );
    const lockTrigger = row(page, /锁屏|Lock screen/).locator(
      ".shortcut-input__trigger"
    );
    await expect(lockTrigger).toContainText(/Ctrl\+Shift\+L|⌘⇧L/);
    await closePanel(page);

    // 旧键位 Alt+L 不再触发（负断言：给一个确定的时间窗）
    await page.keyboard.press("Alt+l");
    await page.waitForTimeout(300);
    await expect(page.locator(".lock-screen")).toHaveCount(0);

    // 新键位 Ctrl+Shift+L 触发锁屏，口令解锁
    await page.keyboard.press("Control+Shift+l");
    await expect(page.locator(".lock-screen")).toBeVisible({ timeout: 10_000 });
    await page.locator("#lock-screen-password").fill(ADMIN.password);
    await page.locator("#lock-screen-password").press("Enter");
    await expect(page.locator(".lock-screen")).toHaveCount(0, {
      timeout: 15_000
    });
  });

  test("快捷键：总开关关闭后全部失效，顶栏按钮不受影响", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, /快捷键|Shortcuts/);
    await setSwitch(
      page,
      /快捷键开关|Enable shortcuts/,
      false,
      "ShortcutEnable"
    );
    await closePanel(page);

    // 锁屏 / 折叠侧栏 / 命令面板均不响应（负断言：给一个确定的时间窗）
    await page.keyboard.press("Alt+l");
    await page.keyboard.press("Alt+s");
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(300);
    await expect(page.locator(".lock-screen")).toHaveCount(0);
    await expect(
      page.locator(".sidebar-container .el-menu--collapse")
    ).toHaveCount(0);
    await expect(page.getByTestId("command-palette")).toHaveCount(0);

    // 顶栏按钮不受开关影响：仍可一键锁屏并解锁
    await page.locator("#header-lock").click();
    await expect(page.locator(".lock-screen")).toBeVisible({ timeout: 10_000 });
    await page.locator("#lock-screen-password").fill(ADMIN.password);
    await page.locator("#lock-screen-password").press("Enter");
    await expect(page.locator(".lock-screen")).toHaveCount(0, {
      timeout: 15_000
    });

    // 复位：重新打开总开关
    await openSettingPanel(page);
    await switchSettingTab(page, /快捷键|Shortcuts/);
    await setSwitch(
      page,
      /快捷键开关|Enable shortcuts/,
      true,
      "ShortcutEnable"
    );
  });

  test("快捷键：保留键与冲突键被拒绝并提示", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, /快捷键|Shortcuts/);

    const lockTrigger = row(page, /锁屏|Lock screen/).locator(
      ".shortcut-input__trigger"
    );
    await lockTrigger.click();
    await expect(lockTrigger).toHaveClass(/is-recording/);

    // 浏览器保留键 Ctrl+S：拒绝并保持录制态
    await page.keyboard.press("Control+s");
    await expect(
      page
        .locator(".el-message")
        .filter({ hasText: /保留键|Reserved/ })
        .first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(lockTrigger).toHaveClass(/is-recording/);

    // 冲突键 Alt+S（已被折叠侧栏占用）：拒绝并保持录制态
    await page.keyboard.press("Alt+s");
    await expect(
      page
        .locator(".el-message")
        .filter({ hasText: /占用|used/ })
        .first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(lockTrigger).toHaveClass(/is-recording/);

    // Esc 取消：退出录制且原键位不变
    await page.keyboard.press("Escape");
    await expect(lockTrigger).not.toHaveClass(/is-recording/);
    await expect(lockTrigger).toContainText(/Alt\+L|⌥L/);
  });

  test("快捷键：Ctrl+, 唤起项目配置面板", async ({ page }) => {
    const panel = page.locator(".right-panel").first();
    const width = page.viewportSize()?.width ?? 1280;
    // 初始为关闭态：面板整体平移出视口右侧
    expect((await panel.boundingBox())?.x ?? 0).toBeGreaterThanOrEqual(
      width - 20
    );

    await page.keyboard.press("Control+,");
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel.locator(".el-tabs__item").first()).toBeVisible();
    await closePanel(page);
  });

  test("布局：页签图标、刷新与更多按钮开关", async ({ page }) => {
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    const tabs = page.locator(".tags-view .scroll-item");
    await expect(tabs).toHaveCount(2, { timeout: 15_000 }); // 首页 + 用户管理
    const userTab = tabs.filter({ hasText: /用户管理|Users/ }).first();

    // 默认全开：页签图标 / 刷新按钮 / 更多按钮
    await expect(userTab.locator(".tag-icon")).toHaveCount(1);
    await expect(page.locator(".tags-view .tags-refresh")).toBeVisible();
    await expect(page.locator(".tags-view .arrow-down")).toBeVisible();

    // 刷新按钮可用：点击后当前页重建（redirect 中转，表格恢复可见）
    await page.locator(".tags-view .tags-refresh").click();
    await expect(page.locator(".el-table").first()).toBeVisible({
      timeout: 15_000
    });

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "页签图标", false, "TagsShowIcon");
    await expect(userTab.locator(".tag-icon")).toHaveCount(0);
    await setSwitch(page, "刷新按钮", false, "TagsShowRefresh");
    await expect(page.locator(".tags-view .tags-refresh")).toHaveCount(0);
    await setSwitch(page, "更多按钮", false, "TagsShowMore");
    await expect(page.locator(".tags-view .arrow-down")).toHaveCount(0);

    // 复位（面板内操作，afterEach 兜底之外先就地收口）
    await setSwitch(page, "页签图标", true, "TagsShowIcon");
    await setSwitch(page, "刷新按钮", true, "TagsShowRefresh");
    await setSwitch(page, "更多按钮", true, "TagsShowMore");
    await expect(userTab.locator(".tag-icon")).toHaveCount(1);
    await expect(page.locator(".tags-view .tags-refresh")).toBeVisible();
    await expect(page.locator(".tags-view .arrow-down")).toBeVisible();
  });

  test("布局：面包屑图标、首页项、单层隐藏与浅底样式", async ({ page }) => {
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    // `.breadcrumb-container` 即 el-breadcrumb 根（父级传入的类合并到组件根上）
    const crumb = page.locator(".breadcrumb-container");
    await expect(crumb).toBeVisible({ timeout: 15_000 });
    // 默认：显示图标、无首页项
    await expect(crumb.locator(".breadcrumb-icon").first()).toBeVisible();
    await expect(crumb).not.toContainText(/首页|Home/);

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    // 关闭图标：图标节点消失
    await setSwitch(page, "面包屑图标", false, "BreadcrumbShowIcon");
    await expect(crumb.locator(".breadcrumb-icon")).toHaveCount(0);
    // 显示首页：列表最前出现「首页」项
    await setSwitch(page, "显示首页", true, "BreadcrumbShowHome");
    await expect(crumb).toContainText(/首页|Home/);
    // 样式切「浅底」：根元素出现背景类
    await setBreadcrumbStyle(page, "background");
    await expect(crumb).toHaveClass(/breadcrumb--background/);
    // 仅一项时隐藏：单层面包屑（首页）整条不渲染
    await setSwitch(page, "仅一项时隐藏", true, "BreadcrumbHideOnlyOne");

    await closePanel(page);
    await page.goto("/#/welcome");
    await expect(page.locator(".breadcrumb-container")).toHaveCount(0);
    // 深层页面仍显示
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    await expect(crumb).toBeVisible();

    // 复位
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "面包屑图标", true, "BreadcrumbShowIcon");
    await setSwitch(page, "显示首页", false, "BreadcrumbShowHome");
    await setSwitch(page, "仅一项时隐藏", false, "BreadcrumbHideOnlyOne");
    await setBreadcrumbStyle(page, "normal");
    await expect(crumb).not.toHaveClass(/breadcrumb--background/);
  });

  test("过渡：顶部进度条与内容区 loading 开关", async ({ page }) => {
    /** 采样器：导航窗口内持续记录进度条透明度与内容区 loading 遮罩 */
    const startSampling = () =>
      page.evaluate(() => {
        const w = window as unknown as {
          __progressSamples: string[];
          __loadingSeen: boolean;
          __sampler?: ReturnType<typeof setInterval>;
        };
        w.__progressSamples = [];
        w.__loadingSeen = false;
        w.__sampler = setInterval(() => {
          const el = document.getElementById("app-progress");
          w.__progressSamples.push(el ? getComputedStyle(el).opacity : "none");
          // 只认内容区自身的 loading 遮罩（页内表格等组件的 loading 挂在更深处）
          if (
            document.querySelector(
              "section.app-main > .el-loading-mask, section.app-main-nofixed-header > .el-loading-mask"
            )
          ) {
            w.__loadingSeen = true;
          }
        }, 16);
      });
    const stopSampling = () =>
      page.evaluate(() => {
        const w = window as unknown as {
          __progressSamples: string[];
          __loadingSeen: boolean;
          __sampler?: ReturnType<typeof setInterval>;
        };
        if (w.__sampler) clearInterval(w.__sampler);
        return { progress: w.__progressSamples, loading: w.__loadingSeen };
      });

    // 默认（进度条开 / loading 关）：首次访问某页时进度条被点亮
    await startSampling();
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    // 覆盖 done 后的淡出窗口（200ms 推进 + 200ms 淡出）
    await page.waitForTimeout(700);
    const first = await stopSampling();
    expect(
      first.progress.some(o => parseFloat(o) > 0),
      "默认应点亮顶部进度条"
    ).toBe(true);
    expect(first.loading, "默认不显示内容区 loading").toBe(false);

    // 关进度条 + 开内容区 loading：再访问一个未加载的重页面
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    await setSwitch(page, "顶部进度条", false, "TransitionProgress");
    await setSwitch(page, "内容区 loading", true, "TransitionLoading");
    await closePanel(page);

    await startSampling();
    await openMenuPath(page, ["数据分析"], "/analysis/dashboard/index");
    await page.waitForTimeout(700);
    const second = await stopSampling();
    expect(
      second.progress.every(o => o === "0" || o === "none"),
      "关闭后不点亮进度条"
    ).toBe(true);
    expect(second.loading, "开启后显示内容区 loading").toBe(true);

    // 复位
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    await setSwitch(page, "顶部进度条", true, "TransitionProgress");
    await setSwitch(page, "内容区 loading", false, "TransitionLoading");
  });

  test("顶栏：刷新、折叠与明暗切换按钮开关与行为", async ({ page }) => {
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    const html = page.locator("html");

    // 默认：刷新可见，折叠与明暗切换隐藏
    await expect(page.locator("#header-refresh")).toBeVisible();
    await expect(page.locator("#header-sidebar-toggle")).toHaveCount(0);
    await expect(page.locator("#header-theme-toggle")).toHaveCount(0);

    // 刷新按钮：点击后当前页重建（表格恢复可见）
    await page.locator("#header-refresh").click();
    await expect(page.locator(".el-table").first()).toBeVisible({
      timeout: 15_000
    });

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "顶栏折叠", true, "NavbarSidebarToggle");
    await setSwitch(page, "顶栏明暗切换", true, "NavbarThemeToggle");
    await closePanel(page);

    // 折叠按钮：与侧栏底部折叠等效
    const collapsed = page.locator(".sidebar-container .el-menu--collapse");
    await page.locator("#header-sidebar-toggle").click();
    await expect(collapsed).toHaveCount(1, { timeout: 10_000 });
    await page.locator("#header-sidebar-toggle").click();
    await expect(collapsed).toHaveCount(0, { timeout: 10_000 });

    // 明暗切换：html.dark 往返
    await expect(html).not.toHaveClass(/dark/);
    await page.locator("#header-theme-toggle").click();
    await expect(html).toHaveClass(/dark/, { timeout: 10_000 });
    await page.locator("#header-theme-toggle").click();
    await expect(html).not.toHaveClass(/dark/, { timeout: 10_000 });

    // 复位
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "顶栏折叠", false, "NavbarSidebarToggle");
    await setSwitch(page, "顶栏明暗切换", false, "NavbarThemeToggle");
  });

  test("侧栏：折叠态悬停临时展开，关闭开关后不展开", async ({ page }) => {
    const sidebar = page.locator(".sidebar-container");
    const collapsed = page.locator(".sidebar-container .el-menu--collapse");

    // 折叠侧栏（Alt+S 默认快捷键）
    await page.keyboard.press("Alt+s");
    await expect(collapsed).toHaveCount(1, { timeout: 10_000 });

    // 悬停侧栏：临时展开（折叠类消失）
    const box = await sidebar.boundingBox();
    expect(box, "侧栏应可见").not.toBeNull();
    await page.mouse.move((box?.x ?? 0) + 20, (box?.y ?? 0) + 300);
    await expect(collapsed).toHaveCount(0, { timeout: 10_000 });

    // 移开：复位为折叠态
    await page.mouse.move((box?.x ?? 0) + 700, (box?.y ?? 0) + 300);
    await expect(collapsed).toHaveCount(1, { timeout: 10_000 });

    // 关闭开关后悬停不再展开（负断言：给一个确定的时间窗）
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "悬停展开", false, "SidebarExpandOnHover");
    await closePanel(page);
    const boxAfter = await sidebar.boundingBox();
    await page.mouse.move((boxAfter?.x ?? 0) + 20, (boxAfter?.y ?? 0) + 300);
    await page.waitForTimeout(300);
    await expect(collapsed).toHaveCount(1);

    // 复位：移开鼠标 → 展开侧栏 → 打开开关
    await page.mouse.move((boxAfter?.x ?? 0) + 700, (boxAfter?.y ?? 0) + 300);
    await page.keyboard.press("Alt+s");
    await expect(collapsed).toHaveCount(0, { timeout: 10_000 });
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "悬停展开", true, "SidebarExpandOnHover");
  });

  test("侧栏：拖拽把手调宽并落库", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "拖拽调宽", true, "SidebarDraggable");
    await closePanel(page);

    const resizer = page.locator(".sidebar-resizer");
    await expect(resizer).toBeVisible({ timeout: 10_000 });
    const box = await resizer.boundingBox();
    expect(box, "拖拽把手应可见").not.toBeNull();

    // 拖 +60px：拖拽中只改 CSS 变量，松开才落库
    await page.mouse.move((box?.x ?? 0) + 2, (box?.y ?? 0) + 200);
    await page.mouse.down();
    await page.mouse.move((box?.x ?? 0) + 62, (box?.y ?? 0) + 200, {
      steps: 10
    });
    await page.mouse.up();

    // 默认 210 + 60 = 270px，落库到本地存储
    await expect
      .poll(() => sidebarWidthVar(page), { timeout: 10_000 })
      .toBe("270px");
    expect(await storedConfigureValue(page, "sidebarWidth")).toBe(270);

    // 复位：宽度回默认、关闭拖拽开关（面板内数字输入档仍可精确设置）
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setNumber(page, "侧栏宽度", "SidebarWidth", 210);
    await setSwitch(page, "拖拽调宽", false, "SidebarDraggable");
    await expect
      .poll(() => sidebarWidthVar(page), { timeout: 10_000 })
      .toBe("");
  });

  test("偏好入口：位置切悬浮球；总开关关闭后入口与快捷键同步失效", async ({
    page
  }) => {
    const headerGear = page.locator(".navbar .set-icon");
    const floating = page.locator(".setting-fab");

    // 默认：顶栏齿轮可见，无悬浮球
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    await expect(headerGear).toBeVisible();
    await expect(floating).toHaveCount(0);

    // 位置切「悬浮球」：齿轮消失、悬浮球出现且可打开面板
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    await setPrefChoice(page, "fixed", "PreferencesPosition");
    await closePanel(page);
    await expect(headerGear).toHaveCount(0);
    await expect(floating).toBeVisible({ timeout: 10_000 });
    await floating.click();
    await expect(page.locator(".right-panel")).toBeVisible({
      timeout: 10_000
    });

    // 切回「顶栏」：齿轮恢复、悬浮球消失
    await switchSettingTab(page, "通用");
    await setPrefChoice(page, "header", "PreferencesPosition");
    await closePanel(page);
    await expect(headerGear).toBeVisible({ timeout: 10_000 });
    await expect(floating).toHaveCount(0);

    // 总开关关闭：二次确认（恢复路径见提示文案）
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    const toggle = row(page, /设置入口|Settings entry/).locator(".el-switch");
    await waitForSiteConfigPatch(page, "EnablePreferences", false, async () => {
      await toggle.click();
      await page
        .locator(".el-message-box")
        .getByRole("button", { name: /确定|OK|Confirm/ })
        .first()
        .click();
    });
    await expect(toggle.locator("input[type=checkbox]")).not.toBeChecked();

    // 关闭后：两个入口都不渲染、快捷键不再唤起面板
    await closePanel(page);
    await expect(headerGear).toHaveCount(0);
    await expect(floating).toHaveCount(0);
    await page.keyboard.press("Control+,");
    await page.waitForTimeout(300);
    const width = page.viewportSize()?.width ?? 1280;
    expect(
      (await page.locator(".right-panel").first().boundingBox())?.x ?? 0
    ).toBeGreaterThanOrEqual(width - 20);

    // 恢复路径：直写站点配置 + 本地存储后重载即可找回入口。
    // 先等关闭动作的自动保存（600ms 防抖）落地，避免恢复被在途保存覆盖
    await page.waitForTimeout(800);
    await patchSiteConfig(page, {
      EnablePreferences: true,
      PreferencesPosition: "header"
    });
    await page.evaluate(() => {
      const raw = localStorage.getItem("responsive-configure");
      if (!raw) return;
      const cfg = JSON.parse(raw);
      cfg.enablePreferences = true;
      localStorage.setItem("responsive-configure", JSON.stringify(cfg));
    });
    await page.reload();
    await expect(headerGear).toBeVisible({ timeout: 15_000 });
  });

  test("侧栏：折叠态默认只显示图标，悬停临时展开恢复标题", async ({ page }) => {
    const collapsedMenu = page.locator(".sidebar-container .el-menu--collapse");
    const railTitles = page.locator(
      ".sidebar-container .el-sub-menu.outer-most > .el-sub-menu__title > span"
    );

    // 确保「折叠态显示标题」关闭（幂等：失败残留时先归位）
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "折叠态显示标题", false, "SidebarCollapsedShowTitle");
    await closePanel(page);

    // 鼠标移出侧栏后折叠（折叠态悬停会临时展开，避免干扰本次断言）
    await page.mouse.move(700, 300);
    await page.keyboard.press("Alt+s");
    await expect(collapsedMenu).toHaveCount(1, { timeout: 10_000 });

    // 一级带图标项：标题不渲染，只留图标（叶子项标题同样只在悬浮提示里）
    await expect(railTitles).toHaveCount(0);
    await expect(
      page
        .locator(".sidebar-container .el-sub-menu.outer-most .sub-menu-icon")
        .first()
    ).toBeVisible();
    await expect(
      page
        .locator(
          ".sidebar-container .el-menu-item.submenu-title-noDropdown svg"
        )
        .first()
    ).toBeVisible();
    await expect(
      page.locator(".sidebar-container .collapse-show-title-text")
    ).toHaveCount(0);

    // 悬停临时展开：侧栏恢复完整形态，标题随之恢复渲染
    const box = await page.locator(".sidebar-container").boundingBox();
    expect(box, "侧栏应可见").not.toBeNull();
    await page.mouse.move((box?.x ?? 0) + 20, (box?.y ?? 0) + 300);
    await expect(collapsedMenu).toHaveCount(0, { timeout: 10_000 });
    await expect(railTitles.first()).toBeVisible({ timeout: 10_000 });

    // 复位：移开鼠标 → 展开侧栏（折叠态判定复位）
    await page.mouse.move(700, 300);
    await page.keyboard.press("Alt+s");
    await expect(collapsedMenu).toHaveCount(0, { timeout: 10_000 });
  });

  test("侧栏：折叠态显示标题——折叠时一级菜单在图标下方显示标题", async ({
    page
  }) => {
    const collapsedMenu = page.locator(".sidebar-container .el-menu--collapse");
    const showTitleMenu = page.locator(
      ".sidebar-container .el-menu--collapse.sidebar-collapse-show-title"
    );

    // 开启开关（幂等：失败残留时先归位）
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "折叠态显示标题", true, "SidebarCollapsedShowTitle");
    await closePanel(page);

    // 鼠标移出侧栏后折叠（折叠态悬停会临时展开，避免干扰本次断言）
    await page.mouse.move(700, 300);
    await page.keyboard.press("Alt+s");
    await expect(collapsedMenu).toHaveCount(1, { timeout: 10_000 });
    await expect(showTitleMenu).toHaveCount(1);

    // 一级有图标项：标题可见且在图标下方（图标在上、标题在下）
    const item = page
      .locator(".sidebar-container .el-sub-menu.outer-most.collapse-show-title")
      .first();
    await expect(item).toBeVisible();
    const title = item.locator(".el-sub-menu__title > span").first();
    await expect(title).toBeVisible();
    const iconBox = await item.locator(".sub-menu-icon").first().boundingBox();
    const titleBox = await title.boundingBox();
    if (!iconBox || !titleBox) {
      throw new Error("折叠态的一级菜单图标与标题都应可见");
    }
    expect(titleBox.y).toBeGreaterThanOrEqual(iconBox.y + iconBox.height - 1);

    // 叶子项（无子级的一级菜单）同样在图标下方显示标题
    await expect(
      page
        .locator(".sidebar-container .el-menu-item .collapse-show-title-text")
        .first()
    ).toBeVisible();

    // 关闭开关：折叠标题形态与文本均不再渲染
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "折叠态显示标题", false, "SidebarCollapsedShowTitle");
    await closePanel(page);
    await page.mouse.move(700, 300);
    await expect(showTitleMenu).toHaveCount(0);
    await expect(
      page.locator(
        ".sidebar-container .el-sub-menu.outer-most.collapse-show-title"
      )
    ).toHaveCount(0);
    await expect(
      page.locator(".sidebar-container .collapse-show-title-text")
    ).toHaveCount(0);

    // 复位：展开侧栏
    await page.keyboard.press("Alt+s");
    await expect(collapsedMenu).toHaveCount(0, { timeout: 10_000 });
  });

  test("侧栏：自动激活子菜单——点击顶层父级展开时跳转第一个子菜单", async ({
    page
  }) => {
    /** hash 路由的路径（`new URL().pathname` 不含 hash，统一取 hash 段） */
    const hashPath = (url: string) => new URL(url).hash.replace(/^#/, "");

    // 开启开关（幂等：失败残留时先归位）
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "自动激活子菜单", true, "SidebarAutoActivateChild");
    await closePanel(page);

    // 先离开「系统管理」分支：其默认展开时点击为收起动作，不触发自动激活
    await page.goto("/#/welcome");
    expect(hashPath(page.url())).toBe("/welcome");

    // 点击父级展开：自动跳转到该分支下第一个子菜单（/system/**）
    const parentTitle = page
      .locator(
        ".sidebar-container .el-sub-menu.outer-most > .el-sub-menu__title"
      )
      .filter({ hasText: "系统管理" })
      .first();
    await parentTitle.click();
    await expect
      .poll(() => hashPath(page.url()), { timeout: 10_000 })
      .toMatch(/^\/system\//);
    await expect(
      page.locator(".sidebar-container .el-menu-item.is-active").first()
    ).toBeVisible();

    // 复位：关闭开关
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "自动激活子菜单", false, "SidebarAutoActivateChild");
  });
});
