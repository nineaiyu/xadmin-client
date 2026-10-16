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
  | "PreferencesStickyNav"
  | "EnableCopyPreferences"
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
  | "SemiDarkSidebarSub"
  | "SemiDarkHeader"
  | "HideFooter"
  | "TagsKeepAlive"
  | "TagsVisitHistory"
  | "FooterFixed"
  | "ShowLogo"
  | "LogoShowText"
  | "SidebarHidden"
  | "SidebarFixedButton"
  | "SidebarExtraCollapse"
  | "HeaderHidden"
  | "NavigationSplit";

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
  | "PreferencesStickyNav"
  | "EnableCopyPreferences"
  | "Timezone"
  | "Locale"
  | "EpThemeColor"
  | "ShortcutLockKeys"
  | "ShortcutSidebarKeys"
  | "ShortcutSearchKeys"
  | "ShortcutPreferencesKeys"
  | "ShortcutLogoutKeys"
  | "ThemePreset"
  | "NavigationStyle"
  | "TagsHeight"
  | "FooterHeight"
  | "LogoSource"
  | "LogoFit"
  | "HeaderMenuAlign"
  | "SidebarCollapseWidth"
  | "SidebarMixedWidth"
  | "SuccessColor"
  | "WarningColor"
  | "DangerColor"
  | "NavbarMoreWidgets"
  | "WidgetPositions"
  | "HeaderMode"
  | "Layout";

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

/** 卡片组（PrefChoice）：按 data-choice 精确定位目标卡片，与档位选择同口径 */
async function setChoice(
  page: Page,
  label: string | RegExp,
  choice: string,
  field: PreferenceField,
  value: string
) {
  const target = row(page, label);
  await expect(target).toBeVisible({ timeout: 10_000 });
  const option = target.locator(`.pref-choice__item[data-choice="${choice}"]`);
  if ((await option.getAttribute("aria-pressed")) === "true") return;
  await waitForSiteConfigPatch(page, field, value, async () => {
    await option.click();
  });
}

/** 顶栏模式四态：静止 = 非固定头布局（旧「固定顶栏」关闭的等价档） */
async function setHeaderMode(page: Page, mode: string) {
  await setChoice(page, /顶栏模式|Header mode/, mode, "HeaderMode", mode);
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

/** 主题预设属性（默认 / 自定义档不写属性） */
const presetAttr = (page: Page) =>
  page.evaluate(() =>
    document.documentElement.getAttribute("data-theme-preset")
  );

/** 根元素内联 CSS 变量值（语义色 / 页签高度 / 侧栏宽度等的运行时覆写） */
const inlineVar = (page: Page, name: string) =>
  page.evaluate(
    key => document.documentElement.style.getPropertyValue(key).trim(),
    name
  );

/** 令牌 → 实际颜色的解析结果（探针元素读 computed 值，验证派生链路） */
const resolvedColor = (page: Page, expression: string) =>
  page.evaluate(value => {
    const probe = document.createElement("span");
    probe.style.background = value;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, expression);

/** 根元素上某令牌的 computed 取值（用于档位型令牌断言） */
const rootVar = (page: Page, name: string) =>
  page.evaluate(
    key =>
      getComputedStyle(document.documentElement).getPropertyValue(key).trim(),
    name
  );

/**
 * 命中悬浮球的 `.set-icon:hover` 规则选择器（判定 = 去掉 `:hover` 后仍匹配该元素）。
 *
 * 悬浮球自带主色底 + 白色图标，一旦被顶栏动作项的浅色 hover 规则命中，
 * 悬停时就会出现「白球消失」——返回空数组才是正确形态。
 */
const fabHoverRuleSelectors = (page: Page) =>
  page.evaluate(() => {
    const fab = document.querySelector(".setting-fab");
    if (!fab) return ["missing-fab"];
    const hits: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRule[];
      try {
        rules = Array.from(sheet.cssRules) as CSSRule[];
      } catch {
        // 跨域样式表读不到规则，跳过
        continue;
      }
      for (const rule of rules) {
        const selector = (rule as CSSStyleRule).selectorText;
        if (!selector?.includes(".set-icon") || !selector.includes(":hover")) {
          continue;
        }
        const matched = selector
          .split(",")
          .map(part => part.replace(/:hover/g, "").trim())
          .some(part => part.length > 0 && fab.matches(part));
        if (matched) hits.push(selector);
      }
    }
    return hits;
  });

/** 主题预设色卡（title 为预设名称，key 为偏好取值） */
async function pickThemePreset(page: Page, label: string, key: string) {
  const item = page.locator(
    `.right-panel .theme-preset__item[title="${label}"]`
  );
  await expect(item).toBeVisible({ timeout: 10_000 });
  await waitForSiteConfigPatch(page, "ThemePreset", key, async () => {
    await item.click();
  });
}

/** 功能色取色（原生 input[type=color] 跨浏览器用脚本填值 + 派发 input） */
async function pickSemanticColor(
  page: Page,
  label: string | RegExp,
  color: string,
  field: PreferenceField
) {
  const target = row(page, label);
  await expect(target).toBeVisible({ timeout: 10_000 });
  const picker = target.locator(".semantic-color__picker");
  await waitForSiteConfigPatch(page, field, color, async () => {
    await picker.evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, color);
  });
}

/** 功能色恢复默认（panel 行内的恢复按钮，写入空串） */
async function resetSemanticColor(
  page: Page,
  label: string | RegExp,
  field: PreferenceField
) {
  const target = row(page, label);
  const button = target.locator(".semantic-color__reset");
  if (!(await button.count())) return;
  await waitForSiteConfigPatch(page, field, "", async () => {
    await button.click();
  });
}

/** 文本偏好行填值（失焦提交，如 Logo 图片地址） */
async function setText(
  page: Page,
  label: string | RegExp,
  field: PreferenceField,
  value: string
) {
  const target = row(page, label);
  await expect(target).toBeVisible({ timeout: 10_000 });
  const input = target.locator("input").first();
  if ((await input.inputValue()) === value) return;
  await waitForSiteConfigPatch(page, field, value, async () => {
    await input.fill(value);
    await input.blur();
  });
}

/**
 * 确保导航模式为「垂直」：侧栏 / 顶栏齿轮 / 侧栏 Logo 等断言只在垂直布局成立，
 * 而布局模式随站点配置持久化——上个用例（或上一次跑批）留下的水平 / 混合布局
 * 会让后续用例找不到入口（`.set-icon` 不在水平顶栏里）。
 */
async function ensureVerticalLayout(page: Page) {
  await ensurePanelClosed(page);
  await openSettingPanel(page);
  await switchSettingTab(page, "布局");
  const block = page
    .locator(".right-panel .pref-block")
    .filter({ hasText: /菜单布局/ })
    .first();
  const vertical = block.locator('.pref-choice__item[data-choice="vertical"]');
  await expect(vertical).toBeVisible({ timeout: 10_000 });
  if ((await vertical.getAttribute("aria-pressed")) !== "true") {
    await waitForSiteConfigPatch(page, "Layout", "vertical", async () => {
      await vertical.click();
    });
  }
  await closePanel(page);
}

/** 确保设置面板处于关闭态：抽屉遮罩会盖住顶栏图标，跨用例残留会让入口不可见 */
async function ensurePanelClosed(page: Page) {
  const panel = page.locator(".right-panel");
  if (await panel.isVisible().catch(() => false)) {
    await closePanel(page);
  }
}

/** 顶栏组件落位选择（组件列表不是 `PrefRow`，用列表项自身的选择器定位） */
async function setWidgetPosition(
  page: Page,
  label: string | RegExp,
  optionLabel: string | RegExp,
  value: string
) {
  const item = page
    .locator(".right-panel .navbar-widgets__item")
    .filter({ hasText: label })
    .first();
  await expect(item).toBeVisible({ timeout: 10_000 });
  await waitForSiteConfigPatch(page, "NavbarMoreWidgets", value, async () => {
    await item.locator(".el-select").click();
    const listId = await item
      .locator("[aria-controls]")
      .first()
      .getAttribute("aria-controls");
    const option = listId
      ? page.locator(`#${listId} .el-select-dropdown__item`)
      : page.locator(".el-select-dropdown__item");
    await option.filter({ hasText: optionLabel }).first().click();
  });
}

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
 * 外观归一：部分用例假设浅色外观（「半暗侧栏 / 半暗顶栏」的 `:not(.dark)` 选择器、
 * 「顶栏明暗切换」的初始 `not.toHaveClass(/dark/)` 断言）——跑批前环境若被手动切成
 * 深色会整条失败。用例内先经面板把主题模式切回「浅色」（实现与 e2e/theme-dark.e2e.ts
 * 的 switchTheme 同口径：走面板控件，不直接写 localStorage）。
 */
async function ensureLightTheme(page: Page) {
  const dark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark")
  );
  if (!dark) return;
  await openSettingPanel(page);
  await page
    .locator(".right-panel")
    .locator(".pure-segmented")
    .first()
    .locator(".pure-segmented-item", { hasText: /浅色|Light/ })
    .click();
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("dark")
  );
  await closePanel(page);
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

/** PrefChoice 卡片组（面包屑样式 / 偏好入口位置等）：按 data-choice 定位并等待落库。
 * 可选 `label` 把定位收进目标行——不同区块可能出现同值档位（如顶栏模式的「固定」
 * 与偏好入口的「悬浮球」同为 `fixed`），不收窄会命中多个卡片（strict mode 冲突）。 */
async function setPrefChoice(
  page: Page,
  value: string,
  field: PreferenceField,
  label?: string | RegExp
) {
  const scope = label ? row(page, label) : page.locator(".right-panel");
  const choice = scope.locator(`.pref-choice__item[data-choice="${value}"]`);
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
    // 布局残留防御：切换菜单布局的用例会把 Layout 落库（站点配置），跨用例 /
    // 跨浏览器批次残留时页面会以横向或混合布局启动，依赖纵向形态的断言随之失败
    await ensureVerticalLayout(page);
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

    // 面板头部吸顶开关（Pin 按钮，不属任何页签）：关闭态点回开启
    const pinButton = page.locator(
      ".right-panel .lay-panel__header button[aria-pressed]"
    );
    if (
      (await pinButton.getAttribute("aria-pressed").catch(() => "true")) ===
      "false"
    ) {
      await pinButton.click().catch(() => undefined);
    }

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
    await setHeaderMode(page, "fixed").catch(() => undefined);
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
      /显示复制偏好按钮|Show copy-preferences button/,
      true,
      "EnableCopyPreferences"
    ).catch(() => undefined);
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
    await setPrefChoice(
      page,
      "header",
      "PreferencesPosition",
      /入口位置|Entry position/
    ).catch(() => undefined);

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

    // 圆角「特大」：--radius-scale 2 → 按钮圆角翻倍（EP 基础圆角基准 --radius-lg = 8px）
    await setScale(page, "圆角", "特大", "Radius", "xlarge");
    await expect(page.locator("html")).toHaveAttribute("data-radius", "xlarge");
    await expect.poll(radiusOf).toBe("16px");

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
    await ensureLightTheme(page);
    await openSettingPanel(page);
    // 归一：先点回「亮白」预设色——前序失败用例可能未执行结尾的回退，
    // 残留的自定义主色会让「默认无内联覆写」的初始断言级联失败
    await page.locator(".right-panel .theme-color li").first().click();
    // 外观为默认页签；默认状态下主色无内联覆写
    await expect.poll(() => primaryTriplet(page), { timeout: 10_000 }).toBe("");

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
    // 基准宽度取设计令牌现值：令牌调整（如 224px）不牵动用例
    const baseWidth = await rootVar(page, "--sidebar-width");
    expect(await sidebarWidth()).toBe(baseWidth);

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
    await setNumber(
      page,
      "侧栏宽度",
      "SidebarWidth",
      Number.parseInt(baseWidth, 10)
    );
    // 复位后：库值等于设计令牌默认时会撤除内联覆写；库值若为历史值则保留内联基准
    await expect
      .poll(
        async () => {
          const value = await sidebarWidthVar(page);
          return value === "" || value === baseWidth;
        },
        { timeout: 10_000 }
      )
      .toBe(true);
    await expect.poll(sidebarWidth, { timeout: 10_000 }).toBe(baseWidth);
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

    // 顶栏模式四态：静止档 = 非固定头布局（固定头部整块消失，改由外层滚动）
    await setHeaderMode(page, "static");
    await expect(page.locator("section.app-main-nofixed-header")).toBeVisible({
      timeout: 10_000
    });
    await expect(page.locator(".fixed-header")).toHaveCount(0);

    // 回到固定档恢复固定头布局
    await setHeaderMode(page, "fixed");
    await expect(page.locator("section.app-main")).toBeVisible({
      timeout: 10_000
    });
    await expect(page.locator(".fixed-header")).toHaveCount(1);
  });

  test("布局：顶栏模式四态与会话级自动隐藏可切换", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    // 自动档：固定头保留 + 自动隐藏生效（下滑隐藏、上滑恢复由顶栏用例覆盖）
    await setHeaderMode(page, "auto");
    await expect(page.locator(".fixed-header")).toHaveCount(1);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const raw = localStorage.getItem("responsive-configure");
            return raw ? JSON.parse(raw).headerAutoHide === true : false;
          }),
        { timeout: 10_000 }
      )
      .toBe(true);

    // 复位：回固定档（同时把镜像键 headerAutoHide 归位）
    await setHeaderMode(page, "fixed");
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const raw = localStorage.getItem("responsive-configure");
            return raw ? JSON.parse(raw).headerAutoHide === false : false;
          }),
        { timeout: 10_000 }
      )
      .toBe(true);
  });

  /**
   * 水平布局的顶栏在固定档下是覆盖层（`.fixed-header` 脱离文档流），内容区必须按
   * 固定头部总高留出 padding-top。漏让位时页面顶部一整行被顶栏压住——首页顶部统计卡
   * 只见数字不见标题、点阵时钟只露一部分。
   */
  test("布局：水平布局 + 固定顶栏时内容区为顶栏让位", async ({ page }) => {
    /**
     * 本用例要改「菜单布局」本身，故不走 `row()`（含 `:visible` 过滤，布局切到水平后
     * 命中不稳），改用区块级定位——与其它用例的档位选择同口径的 `.pref-block`。
     */
    const setMenuLayout = async (choice: "vertical" | "horizontal") => {
      const target = page
        .locator(".right-panel .pref-block")
        .filter({ hasText: /菜单布局/ })
        .first();
      await expect(target).toBeVisible({ timeout: 10_000 });
      const option = target.locator(
        `.pref-choice__item[data-choice="${choice}"]`
      );
      if ((await option.getAttribute("aria-pressed")) === "true") return;
      await waitForSiteConfigPatch(page, "Layout", choice, async () => {
        await option.click();
      });
    };

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    // 用例可能在任意持久化布局下开跑：先归位垂直（`setHeaderMode` 走 row()，依赖
    // 垂直态的面板行结构），顶栏模式设好后再切水平
    await setMenuLayout("vertical");
    await setHeaderMode(page, "fixed");
    await setMenuLayout("horizontal");
    await closePanel(page);

    await page.goto("/#/welcome");
    await expect(page.locator(".fixed-header")).toBeVisible({
      timeout: 10_000
    });
    // 首页卡片有入场位移（v-motion y: 100 → 0），等动画结束再量几何
    await page.waitForTimeout(1200);

    const geometry = await page.evaluate(() => {
      const chrome = document.querySelector(
        ".fixed-header"
      ) as HTMLElement | null;
      const main = document.querySelector(
        "section.app-main"
      ) as HTMLElement | null;
      const firstCard = document.querySelector(
        ".el-card.app-card"
      ) as HTMLElement | null;
      const chromeRect = chrome?.getBoundingClientRect();
      const cardRect = firstCard?.getBoundingClientRect();
      return {
        chromeBottom: chromeRect ? Math.round(chromeRect.bottom) : 0,
        chromePosition: chrome ? getComputedStyle(chrome).position : null,
        paddingTop: main
          ? Number.parseFloat(getComputedStyle(main).paddingTop)
          : 0,
        cardTop: cardRect ? Math.round(cardRect.top) : 0
      };
    });

    // 固定档下顶栏是覆盖层（不是文档流内占位），让位必须由内容区自己完成
    expect(geometry.chromePosition).toBe("fixed");
    expect(geometry.paddingTop).toBeGreaterThanOrEqual(
      geometry.chromeBottom - 2
    );
    expect(geometry.cardTop).toBeGreaterThanOrEqual(geometry.chromeBottom);

    // 复位：垂直布局 + 固定档（后续用例与视觉基线依赖默认布局）
    await ensurePanelClosed(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setMenuLayout("vertical");
    await closePanel(page);
  });

  test("布局：显示顶栏关闭后顶栏整块不渲染（页签条保留）", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    await setSwitch(page, /显示顶栏|Show header/, false, "HeaderHidden");
    await expect(page.locator(".navbar")).toHaveCount(0);
    // 页签条保留（还原入口仍在）
    await expect(page.locator(".tags-view")).toBeVisible();

    await setSwitch(page, /显示顶栏|Show header/, true, "HeaderHidden");
    await expect(page.locator(".navbar")).toHaveCount(1);
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

  test("通用：站点标题实时生效（品牌区 + 标签页）并落库", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");

    const patchBodies: string[] = [];
    page.on("request", req => {
      if (req.url().includes(SITE_CONFIG_URL) && req.method() === "PATCH") {
        patchBodies.push(req.postData() ?? "");
      }
    });

    const input = row(page, /站点标题|Site title/).locator("input");
    await expect(input).toBeVisible();

    const nextTitle = `xAdmin-E2E-${Date.now()}`;
    await input.fill(nextTitle);
    await input.press("Enter");

    // 品牌区（侧栏 Logo 文字）与浏览器标签页即时更新
    await expect(page.locator(".sidebar-title").first()).toHaveText(nextTitle);
    await expect
      .poll(() => page.title(), { timeout: 10_000 })
      .toContain(nextTitle);

    // 回写后端：站点配置整包 PATCH 载荷含 Title（此前 Title 不在清单，改不动）
    await expect
      .poll(
        () => patchBodies.some(body => body.includes(`"Title":"${nextTitle}"`)),
        { timeout: SITE_CONFIG_PATCH_TIMEOUT }
      )
      .toBe(true);

    // 复位（避免污染其它用例与视觉基线）
    await input.fill("xAdmin");
    await input.press("Enter");
    await expect(page.locator(".sidebar-title").first()).toHaveText("xAdmin");
  });

  test("布局：半暗侧栏与字号自定义档实时生效", async ({ page }) => {
    await ensureLightTheme(page);
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

    // 容器实际底色与菜单文字色必须同步变深/变浅（历史缺陷：`--sidebar` 在 :root
    // 已按浅色主题求值，容器覆盖菜单调色板不会回填 → 白底 + 浅色文字，菜单不可见）
    const containerBg = () =>
      page
        .locator(".sidebar-container")
        .first()
        .evaluate(el => getComputedStyle(el).backgroundColor);
    // 断言普通菜单项（排除激活项）：激活项取 --pure-theme-sub-menu-active-text（#fff）
    // 属设计口径，选 .first() 会命中激活的「首页」而误报
    const itemColor = () =>
      page
        .locator(".sidebar-container .el-menu-item:not(.is-active)")
        .first()
        .evaluate(el => getComputedStyle(el).color);
    await expect.poll(containerBg, { timeout: 10_000 }).toBe("rgb(29, 43, 69)");
    expect(await itemColor()).toMatch(/rgba\(254, 254, 254/);

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
    await ensureLightTheme(page);
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
    await ensureLightTheme(page);
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
    // closePanel 的遮罩点击落在侧栏区域内（x≈120），会先触发一次悬停展开；
    // 先把鼠标移出侧栏并等折叠态稳定，再做负断言（否则状态残留导致 flaky）
    await page.mouse.move(900, 300);
    await expect(collapsed).toHaveCount(1, { timeout: 10_000 });
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
    // 基准宽度：当前有效值（内联覆写优先、默认档回落设计令牌），
    // 拖拽断言基于该值推导，不依赖前序用例留下的宽度状态
    const baseWidth = await page.evaluate(() => {
      const inline =
        document.documentElement.style.getPropertyValue("--sidebar-width");
      const raw =
        inline ||
        getComputedStyle(document.documentElement).getPropertyValue(
          "--sidebar-width"
        );
      return Number.parseInt(raw, 10);
    });
    const expectedWidth = Math.min(320, Math.max(160, baseWidth + 60));

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

    // 基准 + 60px 落库到站点配置（宽度可调范围 160-320，拖拽量在范围内）
    await expect
      .poll(() => sidebarWidthVar(page), { timeout: 10_000 })
      .toBe(`${expectedWidth}px`);
    expect(await storedConfigureValue(page, "sidebarWidth")).toBe(
      expectedWidth
    );

    // 复位：宽度设回基准值、关闭拖拽开关（面板内数字输入档仍可精确设置）；
    // 基准等于设计令牌默认时撤除内联覆写，容量内的历史基准则保留为内联值
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setNumber(page, "侧栏宽度", "SidebarWidth", baseWidth);
    await setSwitch(page, "拖拽调宽", false, "SidebarDraggable");
    await expect
      .poll(
        async () => {
          const value = await sidebarWidthVar(page);
          return value === "" || value === `${baseWidth}px`;
        },
        { timeout: 10_000 }
      )
      .toBe(true);
  });

  test("偏好入口：位置切悬浮球；总开关关闭后仍可从头像菜单与快捷键找回", async ({
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
    await setPrefChoice(
      page,
      "fixed",
      "PreferencesPosition",
      /入口位置|Entry position/
    );
    await closePanel(page);
    await expect(headerGear).toHaveCount(0);
    await expect(floating).toBeVisible({ timeout: 10_000 });
    await floating.click();
    await expect(page.locator(".right-panel")).toBeVisible({
      timeout: 10_000
    });

    // 切回「顶栏」：齿轮恢复、悬浮球消失
    await switchSettingTab(page, "通用");
    await setPrefChoice(
      page,
      "header",
      "PreferencesPosition",
      /入口位置|Entry position/
    );
    await closePanel(page);
    await expect(headerGear).toBeVisible({ timeout: 10_000 });
    await expect(floating).toHaveCount(0);

    // 总开关关闭：二次确认（提示文案给出兜底入口）
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

    // 关闭后：显眼入口（顶栏齿轮 / 悬浮球）都不渲染
    await closePanel(page);
    await expect(headerGear).toHaveCount(0);
    await expect(floating).toHaveCount(0);

    // 兜底通道一：快捷键仍能唤出面板——入口全关不能把用户锁在门外
    // （「打开项目配置」是恢复入口的唯一可见通道，不随入口设置失效）
    await page.keyboard.press("Control+,");
    await expect(page.locator(".right-panel").first()).toBeVisible({
      timeout: 10_000
    });

    // 面板内就地恢复总开关（无需清本地存储）
    await switchSettingTab(page, "通用");
    await setSwitch(page, /设置入口|Settings entry/, true, "EnablePreferences");
    await closePanel(page);
    await expect(headerGear).toBeVisible({ timeout: 10_000 });
  });

  test("偏好入口：不显示档仍可从头像菜单找回面板", async ({ page }) => {
    const headerGear = page.locator(".navbar .set-icon");
    const floating = page.locator(".setting-fab");

    await openMenuPath(page, ["系统管理"], "/system/user/index");
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    await setPrefChoice(
      page,
      "none",
      "PreferencesPosition",
      /入口位置|Entry position/
    );
    await closePanel(page);
    await expect(headerGear).toHaveCount(0);
    await expect(floating).toHaveCount(0);

    // 兜底通道二：头像菜单保留「打开项目配置」项
    await page
      .locator(
        ".navbar .el-dropdown-link, .horizontal-header-right .el-dropdown-link"
      )
      .first()
      .click();
    const entryItem = page
      .locator(".el-dropdown-menu:visible")
      .getByText(/打开项目配置|Open ProjectConfig/)
      .first();
    await expect(entryItem).toBeVisible({ timeout: 10_000 });
    await entryItem.click();
    await expect(page.locator(".right-panel").first()).toBeVisible({
      timeout: 10_000
    });

    // 复位：位置回顶栏
    await switchSettingTab(page, "通用");
    await setPrefChoice(
      page,
      "header",
      "PreferencesPosition",
      /入口位置|Entry position/
    );
    await closePanel(page);
    await expect(headerGear).toBeVisible({ timeout: 10_000 });
  });

  test("悬浮球：可拖到任意位置、记忆位置且不误触面板", async ({ page }) => {
    const floating = page.locator(".setting-fab");

    await openMenuPath(page, ["系统管理"], "/system/user/index");
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    await setPrefChoice(
      page,
      "fixed",
      "PreferencesPosition",
      /入口位置|Entry position/
    );
    await closePanel(page);
    await expect(floating).toBeVisible({ timeout: 10_000 });

    // 悬停不落浅底（回归守卫）：悬浮球沿用 `.set-icon` 类做定位契约，
    // 侧栏折叠时 `.app-wrapper.hideSidebar` 里的顶栏动作项浅色 hover 规则
    // 会经后代选择器命中它——白图标压在浅底上等于「球消失」。
    // 判据不采样 hover 态（dev 下样式注入顺序会让采样抖动），改为断言
    // 「没有任何 `.set-icon:hover` 规则能匹配这颗球」，即该缺陷形态本身。
    const collapsed = page.locator(".app-wrapper.hideSidebar");
    // 先归一为展开态（残留状态不定），再折叠复现触发条件
    if ((await collapsed.count()) === 1) await page.keyboard.press("Alt+s");
    await expect(collapsed).toHaveCount(0, { timeout: 10_000 });
    await page.keyboard.press("Alt+s");
    await expect(collapsed).toHaveCount(1, { timeout: 10_000 });
    const fabHoverRules = await fabHoverRuleSelectors(page);
    expect(fabHoverRules).toEqual([]);
    // 展开恢复（侧栏收起会影响到后续用例的菜单定位）
    await page.keyboard.press("Alt+s");
    await expect(collapsed).toHaveCount(0, { timeout: 10_000 });
    await page.mouse.move(600, 400);

    const before = await floating.boundingBox();
    if (!before) throw new Error("悬浮球不可见");
    const from = {
      x: before.x + before.width / 2,
      y: before.y + before.height / 2
    };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 320, from.y - 220, { steps: 10 });
    await page.mouse.up();

    // 拖动生效：球左上角跟着指针移动，位置写入本地偏好
    const after = await floating.boundingBox();
    if (!after) throw new Error("拖动后悬浮球消失");
    expect(after.x).toBeLessThan(before.x - 200);
    expect(after.y).toBeLessThan(before.y - 100);
    const saved = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem("responsive-preferences-fab-position") ?? "null"
      )
    );
    expect(saved?.x).toBeCloseTo(after.x, 0);

    // 拖拽松手不触发点击：设置面板保持关闭（面板收起 = 移出视口右侧）
    const width = page.viewportSize()?.width ?? 1280;
    expect(
      (await page.locator(".right-panel").first().boundingBox())?.x ?? 0
    ).toBeGreaterThanOrEqual(width - 20);

    // 位置记忆：重载后仍落在拖动后的位置
    await page.reload();
    await expect(floating).toBeVisible({ timeout: 15_000 });
    const afterReload = await floating.boundingBox();
    expect(Math.abs((afterReload?.x ?? 0) - after.x)).toBeLessThanOrEqual(1);

    // 复位：位置回顶栏 + 清掉位置记录（避免污染后续批次）
    await floating.click();
    await expect(page.locator(".right-panel").first()).toBeVisible({
      timeout: 10_000
    });
    await switchSettingTab(page, "通用");
    await setPrefChoice(
      page,
      "header",
      "PreferencesPosition",
      /入口位置|Entry position/
    );
    await closePanel(page);
    await page.evaluate(() =>
      localStorage.removeItem("responsive-preferences-fab-position")
    );
    await expect(page.locator(".navbar .set-icon")).toBeVisible({
      timeout: 10_000
    });
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

  test("外观：主题预设切换表面色系并应用配套主色，回默认复位", async ({
    page
  }) => {
    await ensurePanelClosed(page);
    const bgPage = () => rootVar(page, "--bg-page");
    const defaultBg = await bgPage();
    expect(defaultBg).not.toBe("");
    expect(await presetAttr(page)).toBeNull();

    await openSettingPanel(page);
    await switchSettingTab(page, "外观");
    await pickThemePreset(page, "紫罗兰", "violet");

    expect(await presetAttr(page)).toBe("violet");
    // 表面色系：背景令牌换到预设色相（内置值 220 系 → 紫罗兰 245 系）
    expect(await bgPage()).toContain("245");
    // 配套主色：内联三元组写入，且色阶随主色派生
    // 配套主色经 hex 往返写入（通道值有 ±0.1 的换算误差），解析后与预设色一致
    expect(await inlineVar(page, "--primary")).toMatch(/^24[45](\.\d)?\s/);
    expect(await resolvedColor(page, "hsl(var(--primary))")).toBe(
      "rgb(113, 102, 240)"
    );

    // 回默认：属性撤除、表面与主色复位
    await pickThemePreset(page, "默认", "default");
    expect(await presetAttr(page)).toBeNull();
    expect(await bgPage()).toBe(defaultBg);
    expect(await inlineVar(page, "--primary")).toBe("");
    await closePanel(page);
  });

  test("外观：功能色自定义生效并可恢复默认", async ({ page }) => {
    await ensurePanelClosed(page);
    expect(await resolvedColor(page, "hsl(var(--success))")).toBe(
      "rgb(87, 209, 136)"
    );

    await openSettingPanel(page);
    await switchSettingTab(page, "外观");
    await pickSemanticColor(page, "成功色", "#123456", "SuccessColor");
    expect(await inlineVar(page, "--success")).not.toBe("");
    expect(await resolvedColor(page, "hsl(var(--success))")).toBe(
      "rgb(18, 52, 86)"
    );

    await resetSemanticColor(page, "成功色", "SuccessColor");
    expect(await inlineVar(page, "--success")).toBe("");
    expect(await resolvedColor(page, "hsl(var(--success))")).toBe(
      "rgb(87, 209, 136)"
    );
    await closePanel(page);
  });

  test("布局：页签高度调整后令牌与实际页签高度同步", async ({ page }) => {
    await ensurePanelClosed(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setNumber(page, "页签高度", "TagsHeight", 42);
    await closePanel(page);

    expect(await inlineVar(page, "--layout-tags-item-h")).toBe("42px");
    const box = await page
      .locator(".tags-view .scroll-item")
      .first()
      .boundingBox();
    expect(Math.round(box?.height ?? 0)).toBe(42);

    // 设回设计令牌默认档（38）：内联覆写撤除、回到令牌基准值
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setNumber(page, "页签高度", "TagsHeight", 38);
    expect(await inlineVar(page, "--layout-tags-item-h")).toBe("");
    await closePanel(page);
  });

  test("布局：页签缓存与访问历史开关（关闭后关签回落不落空）", async ({
    page
  }) => {
    await ensurePanelClosed(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "页签缓存", false, "TagsKeepAlive");
    expect(await storedPreferenceValue(page, "TagsKeepAlive")).toBe(false);
    await setSwitch(page, "页签访问历史", false, "TagsVisitHistory");
    expect(await storedPreferenceValue(page, "TagsVisitHistory")).toBe(false);
    await closePanel(page);

    // 关闭历史后：关闭当前页签仍回落相邻页签（回落路径不回归）
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    await openMenuPath(page, ["系统管理"], "/system/menu/index");
    const tags = page.locator(".tags-view .scroll-item");
    const total = await tags.count();
    expect(total).toBeGreaterThan(1);
    await middleClick(page, total - 1);
    await expect.poll(() => tags.count(), { timeout: 10_000 }).toBe(total - 1);
    expect(new URL(page.url()).hash).toMatch(/^#\/system\//);

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "页签缓存", true, "TagsKeepAlive");
    await setSwitch(page, "页签访问历史", true, "TagsVisitHistory");
    await closePanel(page);
  });

  test("布局：页脚固定与高度生效", async ({ page }) => {
    await ensurePanelClosed(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    // 前置：页脚需可见（「隐藏页脚」可能在其它用例被改过）
    await setSwitch(page, "隐藏页脚", false, "HideFooter");
    await setSwitch(page, "固定页脚", true, "FooterFixed");
    await setNumber(page, "页脚高度", "FooterHeight", 40);
    await closePanel(page);

    const footer = page.locator(".layout-footer").first();
    await expect(footer).toBeVisible();
    const style = await footer.evaluate(el => {
      const computed = getComputedStyle(el);
      return { height: computed.height, position: computed.position };
    });
    expect(style.height).toBe("40px");
    expect(style.position).toBe("sticky");

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setNumber(page, "页脚高度", "FooterHeight", 0);
    await setSwitch(page, "固定页脚", false, "FooterFixed");
    await closePanel(page);
  });

  test("布局：Logo 图片地址与文字开关生效", async ({ page }) => {
    await ensureVerticalLayout(page);
    // 内置 logo 的 src 按环境取值（dev 下可能是内联 data URI），复位时与它比对
    const builtinSrc = await page
      .locator(".sidebar-logo-container img")
      .first()
      .getAttribute("src");
    expect(builtinSrc).toBeTruthy();

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setText(page, "Logo 图片", "LogoSource", "/favicon.ico");
    await setSwitch(page, "Logo 文字", false, "LogoShowText");
    await closePanel(page);

    const logo = page.locator(".sidebar-logo-container img").first();
    await expect(logo).toHaveAttribute("src", /favicon\.ico/);
    await expect(
      page.locator(".sidebar-logo-container .sidebar-title")
    ).toHaveCount(0);

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setText(page, "Logo 图片", "LogoSource", "");
    await setSwitch(page, "Logo 文字", true, "LogoShowText");
    await closePanel(page);
    await expect(
      page.locator(".sidebar-logo-container img").first()
    ).toHaveAttribute("src", builtinSrc as string);
    await expect(
      page.locator(".sidebar-logo-container .sidebar-title").first()
    ).toBeVisible();
  });

  test("布局：「侧边栏Logo」与「Logo 文字」两开关正交（只关图片时文字保留）", async ({
    page
  }) => {
    await ensureVerticalLayout(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    // 关「侧边栏Logo」：只隐藏 Logo 图片，标题文字保留（品牌位仍占位 has-logo）
    await setSwitch(page, /侧边栏Logo|Sidebar Logo/, false, "ShowLogo");
    await closePanel(page);
    await expect(page.locator(".sidebar-logo-container img")).toHaveCount(0);
    await expect(
      page.locator(".sidebar-logo-container .sidebar-title")
    ).not.toBeEmpty();
    await expect(page.locator(".sidebar-container")).toHaveClass(/has-logo/);

    // 再关「Logo 文字」：品牌位整块收起（no-logo，菜单滚动区上移）
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, /Logo 文字|Logo text/, false, "LogoShowText");
    await closePanel(page);
    await expect(page.locator(".sidebar-logo-container")).toHaveCount(0);
    await expect(page.locator(".sidebar-container")).toHaveClass(/no-logo/);

    // 复位
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, /Logo 文字|Logo text/, true, "LogoShowText");
    await setSwitch(page, /侧边栏Logo|Sidebar Logo/, true, "ShowLogo");
    await closePanel(page);
    await expect(page.locator(".sidebar-logo-container img")).toHaveCount(1);
    await expect(page.locator(".sidebar-container")).toHaveClass(/has-logo/);
  });

  test("布局：导航风格切朴素后菜单激活块去圆角", async ({ page }) => {
    await ensurePanelClosed(page);
    // 圆角基准取设计令牌现值：只校验「plain 归零 / rounded 恢复」
    const baseRadius = await rootVar(page, "--nav-item-radius");
    expect(baseRadius).not.toBe("0px");

    const navStyleBlock = () =>
      page
        .locator(".right-panel .pref-block")
        .filter({ hasText: /导航风格/ })
        .first();

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await waitForSiteConfigPatch(page, "NavigationStyle", "plain", async () => {
      await navStyleBlock()
        .locator('.pref-choice__item[data-choice="plain"]')
        .click();
    });
    await closePanel(page);

    expect(await rootVar(page, "--nav-item-radius")).toBe("0px");
    expect(await rootVar(page, "--nav-item-inset")).toBe("0px");

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await waitForSiteConfigPatch(
      page,
      "NavigationStyle",
      "rounded",
      async () => {
        await navStyleBlock()
          .locator('.pref-choice__item[data-choice="rounded"]')
          .click();
      }
    );
    expect(await rootVar(page, "--nav-item-radius")).toBe(baseRadius);
    await closePanel(page);
  });

  test("布局：折叠宽度、隐藏侧栏与钉住按钮生效", async ({ page }) => {
    await ensureVerticalLayout(page);
    await page.keyboard.press("Alt+S");
    await page.mouse.move(700, 300);
    const container = page.locator(".sidebar-container").first();
    const containerWidth = () =>
      container.evaluate(el => getComputedStyle(el).width);
    const baseCollapseWidth = await rootVar(page, "--sidebar-collapse-width");
    await expect
      .poll(containerWidth, { timeout: 10_000 })
      .toBe(baseCollapseWidth);

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setNumber(page, "折叠宽度", "SidebarCollapseWidth", 72);
    expect(await inlineVar(page, "--sidebar-collapse-width")).toBe("72px");
    await setSwitch(page, "钉住按钮", true, "SidebarFixedButton");
    await closePanel(page);

    await page.mouse.move(700, 300);
    await expect.poll(containerWidth, { timeout: 10_000 }).toBe("72px");

    // 钉住：常驻展开（取消悬停展开形态）
    const pin = page.locator(".sidebar-fixed-button");
    await expect(pin).toBeVisible();
    await pin.click();
    await expect(page.locator(".app-wrapper").first()).not.toHaveClass(
      /hideSidebar/
    );
    // 再点一次：取消钉住并收起
    await pin.click();
    await expect(page.locator(".app-wrapper").first()).toHaveClass(
      /hideSidebar/
    );

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "隐藏侧栏", true, "SidebarHidden");
    await closePanel(page);
    await expect(container).toBeHidden();

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, "隐藏侧栏", false, "SidebarHidden");
    await setSwitch(page, "钉住按钮", false, "SidebarFixedButton");
    await setNumber(
      page,
      "折叠宽度",
      "SidebarCollapseWidth",
      Number.parseInt(baseCollapseWidth, 10)
    );
    await closePanel(page);
    // 复位展开态（与用例开始前一致）
    await page.mouse.move(700, 300);
    await page.keyboard.press("Alt+S");
    await expect.poll(containerWidth, { timeout: 10_000 }).not.toBe("72px");
  });

  test("布局：顶栏组件可移入「更多」下拉并复位", async ({ page }) => {
    await ensureVerticalLayout(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setWidgetPosition(page, "顶栏刷新", "更多下拉", '["refresh"]');
    await closePanel(page);

    await expect(page.locator("#header-more")).toBeVisible();
    // 移出顶栏：直挂顶栏的刷新按钮消失；组件出现在「更多」下拉里
    await expect(
      page.locator(".vertical-header-right > #header-refresh")
    ).toHaveCount(0);
    await expect(
      page.locator(".more-widgets #header-refresh").first()
    ).toBeAttached();
    await page.locator("#header-more").click();
    await expect(
      page.locator(".more-widgets #header-refresh").first()
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setWidgetPosition(page, "顶栏刷新", "顶栏", "[]");
    await closePanel(page);
    await expect(page.locator("#header-refresh")).toBeVisible();
    await expect(page.locator("#header-more")).toHaveCount(0);
  });

  test("布局：顶栏组件可移入头像菜单并复位", async ({ page }) => {
    await ensureVerticalLayout(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    // 刷新按钮落位改「头像菜单」：顶栏不再直挂，头像下拉内出现
    await setWidgetPosition(
      page,
      "顶栏刷新",
      /头像菜单|User menu/,
      JSON.stringify({ refresh: "user-dropdown" })
    );
    await closePanel(page);
    await expect(
      page.locator(".vertical-header-right > #header-refresh")
    ).toHaveCount(0);
    await page.locator(".navbar .el-dropdown-link").first().click();
    await expect(page.locator("#header-refresh")).toBeVisible();

    // 复位：顶栏（同时把 widgetPositions 与镜像旧键都归位）
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setWidgetPosition(
      page,
      "顶栏刷新",
      /顶栏|Header/,
      JSON.stringify({ refresh: "header" })
    );
    await closePanel(page);
    await expect(page.locator("#header-refresh")).toBeVisible();
  });

  test("布局：落位「更多下拉」的顶栏组件按菜单项形态展示（图标 + 名称）", async ({
    page
  }) => {
    await ensureVerticalLayout(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");

    // 刷新按钮落位改「更多下拉」：顶栏不再直挂，「更多」入口出现
    await setWidgetPosition(page, "顶栏刷新", /更多下拉|More/, '["refresh"]');
    await closePanel(page);
    await expect(
      page.locator(".vertical-header-right > #header-refresh")
    ).toHaveCount(0);

    await page.locator("#header-more").click();
    const moreItem = page
      .locator(".more-widgets:visible .el-dropdown-menu__item")
      .first();
    // 菜单项为「图标 + 名称」内联形态——组件本体带顶栏热区（navbar-action），
    // 在下拉里必须收敛为 16px 图标，否则会显示为 36px 孤立方块（历史缺陷）
    await expect(moreItem).toContainText(/刷新|Refresh/);
    const iconSize = await moreItem
      .locator(".navbar-action svg")
      .first()
      .evaluate(el => Math.round(el.getBoundingClientRect().width));
    expect(iconSize).toBe(16);
    await page.keyboard.press("Escape");

    // 复位：顶栏（同时把 widgetPositions 与镜像旧键都归位）
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setWidgetPosition(page, "顶栏刷新", /顶栏|Header/, "[]");
    await closePanel(page);
    await expect(
      page.locator(".vertical-header-right > #header-refresh")
    ).toBeVisible();
  });

  test("布局：双列菜单 / 侧边导航 / 混合双列三种模式可切换并复位", async ({
    page
  }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    const block = page
      .locator(".right-panel .pref-block")
      .filter({ hasText: /菜单布局/ })
      .first();

    // 双列菜单：一级窄列 + 二级列，顶栏与首列同排（无通栏）
    await waitForSiteConfigPatch(
      page,
      "Layout",
      "sidebar-mixed-nav",
      async () => {
        await block
          .locator('.pref-choice__item[data-choice="sidebar-mixed-nav"]')
          .click();
      }
    );
    await closePanel(page);
    await expect(page.locator("body[layout='sidebar-mixed-nav']")).toHaveCount(
      1
    );
    await expect(
      page.locator(".sidebar-container.is-two-column")
    ).toBeVisible();
    await expect(page.locator(".sidebar-mixed-narrow")).toBeVisible();
    // 二级列要有多项可展示才展开（首页目录下只有一个首页页，会收为窄列）：
    // 先进入含多项子菜单的一级，再断言次级列内容
    await page.goto("/#/system/user/index");
    await expect(
      page.locator(".sidebar-container .sidebar-main")
    ).toBeVisible();

    // 左上角品牌不重复：站点 Logo 只在一级窄列顶部出现一次（图标形态）；
    // 次级列顶部是「当前一级菜单」的分区标题，
    // 不得再渲染一次品牌 Logo
    await expect(
      page.locator(".sidebar-container .sidebar-logo-link")
    ).toHaveCount(1);
    await expect(
      page.locator(".sidebar-container .sidebar-mixed-narrow__logo")
    ).toHaveCount(1);
    await expect(
      page.locator(".sidebar-container .sidebar-mixed-brand")
    ).toBeVisible();
    await expect(
      page.locator(".sidebar-container .sidebar-mixed-brand .sidebar-logo-link")
    ).toHaveCount(0);

    // 窄列品牌位：站点标题与图标竖排居中展示（曾因父级 scoped
    // 覆盖失效导致图标偏左 14px，且标题被 hideTitle 隐藏）
    await expect(
      page.locator(".sidebar-mixed-narrow__logo .sidebar-title")
    ).not.toBeEmpty();
    const brandOffset = await page
      .locator(".sidebar-mixed-narrow__logo .sidebar-logo-link img")
      .evaluate(el => {
        const img = el.getBoundingClientRect();
        const narrow = el
          .closest(".sidebar-mixed-narrow")!
          .getBoundingClientRect();
        return Math.abs(img.x + img.width / 2 - (narrow.x + narrow.width / 2));
      });
    expect(brandOffset).toBeLessThanOrEqual(1);

    // 侧边导航：顶栏通栏（宽度 100%、只有面包屑与动作区）、侧栏排在顶栏下方并显示完整菜单
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await waitForSiteConfigPatch(
      page,
      "Layout",
      "header-sidebar-nav",
      async () => {
        await block
          .locator('.pref-choice__item[data-choice="header-sidebar-nav"]')
          .click();
      }
    );
    await closePanel(page);
    await expect(page.locator("body[layout='header-sidebar-nav']")).toHaveCount(
      1
    );
    const fullWidthHeader = await page
      .locator(".fixed-header")
      .evaluate(el => el.getBoundingClientRect().width);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(Math.abs(fullWidthHeader - viewportWidth)).toBeLessThan(2);
    // 顶栏不承载一级菜单条，改由面包屑指示当前位置
    await expect(page.locator(".fixed-header .horizontal-header")).toHaveCount(
      0
    );
    await expect(
      page.locator(".fixed-header .breadcrumb-container")
    ).toBeVisible();

    // 混合双列：双列侧栏全高，顶栏在侧栏右侧（承载一级菜单）
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await waitForSiteConfigPatch(
      page,
      "Layout",
      "header-mixed-nav",
      async () => {
        await block
          .locator('.pref-choice__item[data-choice="header-mixed-nav"]')
          .click();
      }
    );
    await closePanel(page);
    await expect(page.locator("body[layout='header-mixed-nav']")).toHaveCount(
      1
    );
    await expect(
      page.locator(".sidebar-container.is-two-column")
    ).toBeVisible();
    // 顶栏让位侧栏宽度（左边界落在侧栏右缘），且承载一级菜单条
    await expect(page.locator(".fixed-header .horizontal-header")).toHaveCount(
      1
    );
    const mixedHeader = await page
      .locator(".fixed-header")
      .evaluate(el => el.getBoundingClientRect());
    const mixedSidebarWidth = await page
      .locator(".sidebar-container")
      .evaluate(el => el.getBoundingClientRect().width);
    expect(Math.abs(mixedHeader.x - mixedSidebarWidth)).toBeLessThan(2);

    // 复位竖排
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await waitForSiteConfigPatch(page, "Layout", "vertical", async () => {
      await block.locator('.pref-choice__item[data-choice="vertical"]').click();
    });
    await closePanel(page);
    await expect(page.locator("body[layout='vertical']")).toHaveCount(1);
  });

  test("布局：双列菜单下当前一级只有一项时第二列不渲染", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    const block = page
      .locator(".right-panel .pref-block")
      .filter({ hasText: /菜单布局/ })
      .first();
    await waitForSiteConfigPatch(
      page,
      "Layout",
      "sidebar-mixed-nav",
      async () => {
        await block
          .locator('.pref-choice__item[data-choice="sidebar-mixed-nav"]')
          .click();
      }
    );
    await closePanel(page);

    // 「首页」目录下只有一个首页页：二级列没有可展示内容（与一级窄列重复），
    // 整列不渲染、侧栏收为窄列宽度，内容区随之占满
    await page.goto("/#/welcome");
    const container = page.locator(".sidebar-container").first();
    await expect(container).toHaveClass(/is-narrow-only/);
    await expect(page.locator(".sidebar-container .sidebar-main")).toHaveCount(
      0
    );
    const widths = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>(".sidebar-container");
      const narrow = document.querySelector<HTMLElement>(
        ".sidebar-mixed-narrow"
      );
      return {
        container: box?.getBoundingClientRect().width ?? -1,
        narrow: narrow?.getBoundingClientRect().width ?? -1
      };
    });
    expect(widths.narrow).toBeGreaterThan(0);
    expect(Math.abs(widths.container - widths.narrow)).toBeLessThan(2);

    // 进入含多项子菜单的一级：二级列恢复展示
    await page.goto("/#/system/user/index");
    await expect(container).not.toHaveClass(/is-narrow-only/);
    await expect(
      page.locator(".sidebar-container .sidebar-main")
    ).toBeVisible();

    // 复位竖排
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await waitForSiteConfigPatch(page, "Layout", "vertical", async () => {
      await block.locator('.pref-choice__item[data-choice="vertical"]').click();
    });
    await closePanel(page);
    await expect(page.locator("body[layout='vertical']")).toHaveCount(1);
  });

  test("布局：导航切割关闭后混合模式顶栏与侧栏都显示完整菜单", async ({
    page
  }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    const block = page
      .locator(".right-panel .pref-block")
      .filter({ hasText: /菜单布局/ })
      .first();
    await waitForSiteConfigPatch(page, "Layout", "mix", async () => {
      await block.locator('.pref-choice__item[data-choice="mix"]').click();
    });
    // 侧栏一级项（分支项为 el-sub-menu，叶子项为外层 router-link）
    const sidebarEntries = page.locator(
      ".sidebar-container .sidebar-main .el-menu.outer-most " +
        "> .el-sub-menu, .sidebar-container .sidebar-main .el-menu.outer-most > a[role=menuitem]"
    );
    // 切割开（默认）：侧栏只显示当前一级的子菜单
    const splitCount = await sidebarEntries.count();

    await setSwitch(
      page,
      /导航切割|Navigation split/,
      false,
      "NavigationSplit"
    );
    await closePanel(page);
    await expect(page.locator("body[layout='mix']")).toHaveCount(1);
    // 形态：Logo 归顶栏并与一级菜单条并排（顶栏为 flex 行，不堆叠），侧栏不再渲染品牌区
    const brand = await page
      .locator(".fixed-header .navbar-logo")
      .evaluate(el => el.getBoundingClientRect());
    const navHeader = await page
      .locator(".fixed-header .horizontal-header")
      .evaluate(el => el.getBoundingClientRect());
    expect(navHeader.x).toBeGreaterThanOrEqual(brand.x + brand.width - 1);
    await expect(
      page.locator(".sidebar-container .sidebar-logo-container")
    ).toHaveCount(0);
    // 未切割：侧栏回到完整菜单树（一级项全部铺开，项数必然多于子菜单）
    await expect
      .poll(() => sidebarEntries.count(), { timeout: 10_000 })
      .toBeGreaterThan(splitCount);

    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await setSwitch(page, /导航切割|Navigation split/, true, "NavigationSplit");
    await waitForSiteConfigPatch(page, "Layout", "vertical", async () => {
      await block.locator('.pref-choice__item[data-choice="vertical"]').click();
    });
    await closePanel(page);
    await expect(page.locator("body[layout='vertical']")).toHaveCount(1);
  });

  test("布局：内容全屏模式不渲染外壳，设置入口回落悬浮球并可切回", async ({
    page
  }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    const block = page
      .locator(".right-panel .pref-block")
      .filter({ hasText: /菜单布局/ })
      .first();
    await waitForSiteConfigPatch(page, "Layout", "full-content", async () => {
      await block
        .locator('.pref-choice__item[data-choice="full-content"]')
        .click();
    });
    await closePanel(page);

    // 外壳整块不渲染：顶栏（含页签条）与侧栏都不可见，仅内容主体
    await expect(page.locator("body[layout='full-content']")).toHaveCount(1);
    await expect(page.locator(".fixed-header")).toHaveCount(0);
    await expect(page.locator(".tags-view")).toHaveCount(0);
    await expect(page.locator(".sidebar-container")).toBeHidden();
    await expect(page.locator("#main-content")).toBeVisible();

    // 全屏内容没有顶栏齿轮，设置入口回落到悬浮球（保证有切回其它布局的入口）
    await expect(page.locator(".setting-fab")).toBeVisible();

    // 悬浮球打开面板 → 切回竖排 → 外壳恢复
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await waitForSiteConfigPatch(page, "Layout", "vertical", async () => {
      await block.locator('.pref-choice__item[data-choice="vertical"]').click();
    });
    await closePanel(page);
    await expect(page.locator("body[layout='vertical']")).toHaveCount(1);
    await expect(page.locator(".fixed-header")).toHaveCount(1);
  });

  test("偏好：面板吸顶导航、复制偏好按钮与组件快捷键提示", async ({ page }) => {
    await openSettingPanel(page);
    const panel = page.locator(".right-panel").first();
    const tabsRoot = panel.locator(".setting-tabs");

    // 默认吸顶开启：页签头 sticky 类在、头部 Pin 按钮按下
    await expect(tabsRoot).toHaveClass(/setting-tabs--sticky/);
    const pin = panel.locator(".lay-panel__header button[aria-pressed]");
    await expect(pin).toHaveAttribute("aria-pressed", "true");

    // 顶栏组件行快捷键提示（kbd）：菜单搜索显示 ⌘/Ctrl+K（符号随平台）
    await switchSettingTab(page, "布局");
    const searchWidgetRow = panel
      .locator(".navbar-widgets__item")
      .filter({ hasText: /菜单搜索|Menu search/ })
      .first();
    await expect(searchWidgetRow.locator("kbd")).toHaveText(/⌘K|Ctrl\+K/);

    // 关闭吸顶：sticky 类移除并落库
    await waitForSiteConfigPatch(
      page,
      "PreferencesStickyNav",
      false,
      async () => {
        await pin.click();
      }
    );
    await expect(tabsRoot).not.toHaveClass(/setting-tabs--sticky/);
    await expect(pin).toHaveAttribute("aria-pressed", "false");

    // 关闭「显示复制偏好按钮」：页脚「更多」菜单里的复制项消失
    await switchSettingTab(page, "通用");
    const moreTrigger = panel.locator(".lay-panel__footer-more");
    const moreMenu = page.locator(".el-dropdown-menu:visible");
    const copyItem = () =>
      moreMenu
        .locator(".el-dropdown-menu__item")
        .filter({ hasText: /复制偏好|Copy preferences/ });
    // 开合收敛为确定性步骤：菜单不残留开启态，后续断言才不会被「点一下反而关掉」干扰
    const openMore = async () => {
      await moreTrigger.click();
      await expect(moreMenu).toHaveCount(1, { timeout: 10_000 });
    };
    // 收起菜单：点面板头部（面板内、弹层外）——Escape 在 EP 下拉上不生效；
    // 不能点遮罩（会连带关掉整个面板），头部标题区为纯展示元素，最稳
    const closeMore = async () => {
      await panel.locator(".lay-panel__title").click();
      await expect(moreMenu).toHaveCount(0, { timeout: 10_000 });
    };

    await openMore();
    await expect(copyItem()).toHaveCount(1);
    await closeMore();
    await setSwitch(
      page,
      /显示复制偏好按钮|Show copy-preferences button/,
      false,
      "EnableCopyPreferences"
    );
    await openMore();
    await expect(copyItem()).toHaveCount(0);
    await closeMore();

    // 复位：复制按钮开关恢复，吸顶重新开启
    await setSwitch(
      page,
      /显示复制偏好按钮|Show copy-preferences button/,
      true,
      "EnableCopyPreferences"
    );
    await openMore();
    await expect(copyItem()).toHaveCount(1);
    await closeMore();
    await waitForSiteConfigPatch(
      page,
      "PreferencesStickyNav",
      true,
      async () => {
        await pin.click();
      }
    );
    await expect(tabsRoot).toHaveClass(/setting-tabs--sticky/);
  });

  test("偏好：撤销本次调整按钮脏标记随偏好差异联动", async ({ page }) => {
    await openSettingPanel(page);
    const footer = page.locator(".right-panel .lay-panel__footer");
    const undoButton = footer
      .locator(".el-button")
      .filter({ hasText: /撤销本次调整|Undo session changes/ })
      .first();
    const defaultsButton = footer
      .locator(".el-button")
      .filter({ hasText: /恢复默认|Restore defaults/ })
      .first();
    const dirtyDot = page.locator(".right-panel .lay-panel__dirty-dot");

    // 以初始态为基准（跑批环境可能有其它未复位差异，不做绝对「干净」假设）
    const initiallyDisabled = await undoButton.isDisabled();
    const initialDotCount = await dirtyDot.count();
    // 「恢复默认」与本次会话改动无关：任何时刻都可用（确认框后清除个人偏好）
    await expect(defaultsButton).toBeEnabled();

    // 产生差异：切换紧凑模式 → 标记出现、撤销按钮可用
    await switchSettingTab(page, "通用");
    const baseline = await storedPreferenceValue(page, "CompactMode");
    await setSwitch(
      page,
      /紧凑模式|Compact mode/,
      baseline !== true,
      "CompactMode"
    );
    await expect(dirtyDot).toBeVisible({ timeout: 10_000 });
    await expect(undoButton).toBeEnabled();

    // 撤销本次调整：回填到打开面板时的基线（本地即时生效 + 立即整包落库）
    await waitForSiteConfigPatch(
      page,
      "CompactMode",
      baseline as boolean,
      async () => {
        await undoButton.click();
      }
    );
    expect(await storedPreferenceValue(page, "CompactMode")).toBe(baseline);
    // 面板控件（本地快照型组件已重挂载）同步显示回退后的值
    await expect(
      row(page, /紧凑模式|Compact mode/)
        .locator("input[type=checkbox]")
        .first()
    ).toBeChecked({ checked: baseline === true });
    if (initialDotCount === 0) {
      await expect(dirtyDot).toHaveCount(0, { timeout: 10_000 });
    }
    if (initiallyDisabled) {
      await expect(undoButton).toBeDisabled({ timeout: 10_000 });
    }
  });

  test("通用：时区选择落库并持久化", async ({ page }) => {
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    const timezoneRow = row(page, /^时区|^Timezone/);
    await expect(timezoneRow).toBeVisible({ timeout: 10_000 });

    const pickTimezone = async (
      typed: string,
      optionLabel: string | RegExp,
      patchText?: string
    ) => {
      const action = async () => {
        await timezoneRow.locator(".el-select").click();
        if (typed) await page.keyboard.type(typed);
        const listId = await timezoneRow
          .locator("[aria-controls]")
          .first()
          .getAttribute("aria-controls");
        const option = listId
          ? page.locator(`#${listId} .el-select-dropdown__item`)
          : page.locator(".el-select-dropdown__item");
        await option.filter({ hasText: optionLabel }).first().click();
      };
      if (patchText === undefined) {
        await action();
        return;
      }
      await waitForSiteConfigPatch(page, "Timezone", patchText, action);
    };

    // 选择 Asia/Tokyo（filterable 下拉：键入过滤后点选）
    if ((await storedPreferenceValue(page, "Timezone")) !== "Asia/Tokyo") {
      await pickTimezone("Tokyo", "Asia/Tokyo", "Asia/Tokyo");
    }
    expect(await storedPreferenceValue(page, "Timezone")).toBe("Asia/Tokyo");

    // 复位：跟随浏览器（空串）
    if ((await storedPreferenceValue(page, "Timezone")) !== "") {
      await pickTimezone("", /跟随浏览器时区|Follow browser timezone/, "");
    }
    expect(await storedPreferenceValue(page, "Timezone")).toBe("");
  });
});

test.describe("布局：内容区回顶", () => {
  // 矮视口：保证可滚动距离显著超过回顶按钮的出现阈值（200px）
  test.use({ viewport: { width: 1280, height: 600 } });

  test("滚动后出现回顶按钮，点击回到顶部并隐藏", async ({ page }) => {
    await login(page);
    await openMenuPath(page, ["系统管理"], "/system/user/index");

    const wrap = page.locator(".app-main .el-scrollbar__wrap").first();
    await wrap.waitFor({ state: "visible", timeout: 15_000 });

    const backtop = page.locator(".re-backtop");
    await expect(backtop).toBeHidden();

    await wrap.evaluate(el => (el as HTMLElement).scrollTo({ top: 9999 }));
    await expect(backtop).toBeVisible({ timeout: 5_000 });
    const start = await wrap.evaluate(el => (el as HTMLElement).scrollTop);
    expect(start).toBeGreaterThan(200);

    // 平滑回顶守护：采样 scroll 事件，必须出现中间位置（瞬跳只有一次 scroll 且直接落 0）
    const samples = await wrap.evaluate(async el => {
      const node = el as HTMLElement;
      const seen: number[] = [];
      const onScroll = () => seen.push(node.scrollTop);
      node.addEventListener("scroll", onScroll);
      document.querySelector<HTMLElement>(".re-backtop")?.click();
      await new Promise(resolve => setTimeout(resolve, 1200));
      node.removeEventListener("scroll", onScroll);
      return { seen, top: node.scrollTop };
    });
    expect(samples.top).toBeLessThan(10);
    expect(samples.seen.some(value => value > 10 && value < start)).toBe(true);
    await expect(backtop).toBeHidden({ timeout: 5_000 });
  });
});

test.describe("布局：侧栏菜单装饰与激活联动", () => {
  /**
   * 「E2E菜单演示」目录（E2E 种子，rank 靠后位于侧栏底部）：
   * 徽标 / 红点 / 分组标题 / 查询参数 / 高亮路径（activePath）的渲染素材。
   */
  const demoGroups = (page: Page) =>
    page.locator(".sidebar-container .sidebar-menu-group");

  test("侧栏装饰：徽标与分组标题渲染，带查询参数菜单点击后 URL 携带参数", async ({
    page
  }) => {
    await login(page);
    await openMenuPath(page, ["E2E菜单演示"], "/e2e-menu-demo/badge");

    // 分组标题：两个组按 groupRank 升序（基础功能 → 高级功能）
    const groups = demoGroups(page);
    await expect(groups).toHaveCount(2, { timeout: 10_000 });
    await expect(
      groups.nth(0).locator(".el-menu-item-group__title")
    ).toHaveText("基础功能");
    await expect(
      groups.nth(1).locator(".el-menu-item-group__title")
    ).toHaveText("高级功能");

    // 组内聚合：基础功能组含徽标项与红点项，高级功能组仅查询项
    await expect(groups.nth(0).locator(".el-menu-item")).toHaveCount(2);
    await expect(groups.nth(1).locator(".el-menu-item")).toHaveCount(1);

    // 文本徽标（12 不截断）
    await expect(
      groups
        .nth(0)
        .locator(".el-menu-item")
        .filter({ hasText: "E2E徽标菜单" })
        .locator(".sidebar-menu-badge")
    ).toHaveText("12");

    // 红点徽标：无文本 + is-dot
    const dot = groups
      .nth(0)
      .locator(".el-menu-item")
      .filter({ hasText: "E2E红点菜单" })
      .locator(".sidebar-menu-badge");
    await expect(dot).toHaveClass(/is-dot/);
    await expect(dot).toHaveText("");

    // 查询参数：点击后路由携带 meta.query（tab=e2e）
    await page.locator('a[href^="#/e2e-menu-demo/query"]').first().click();
    await expect(page).toHaveURL(/\/e2e-menu-demo\/query\?tab=e2e/, {
      timeout: 10_000
    });
  });

  test("侧栏装饰：菜单外页面进入时高亮 activePath 指定菜单", async ({
    page
  }) => {
    await login(page);
    // 「E2E详情页」菜单不可见（showLink=false），只能经 URL 进入
    await page.goto("/#/e2e-menu-demo/detail");
    await expect(page.locator('a[href="#/e2e-menu-demo/detail"]')).toHaveCount(
      0
    );

    // 目录自动展开（EP 展开包含激活项的子菜单），activePath 指定的「E2E徽标菜单」高亮
    await expect(
      page.locator('a[href="#/e2e-menu-demo/badge"] .el-menu-item')
    ).toHaveClass(/is-active/, { timeout: 10_000 });
  });

  test("侧栏装饰：进入侧栏底部路由后激活项自动滚入可视区", async ({ page }) => {
    await login(page);
    const wrap = page.locator(".sidebar-container .el-scrollbar__wrap").first();
    await wrap.waitFor({ state: "visible", timeout: 15_000 });
    expect(
      await wrap.evaluate(el => el.scrollTop),
      "首页时侧栏滚动位置在顶部"
    ).toBeLessThan(5);

    // 整页进入底部路由（不产生人工滚动），激活项应被自动滚入可视区
    await page.goto("/#/e2e-menu-demo/query");
    const active = page.locator(
      'a[href^="#/e2e-menu-demo/query"] .el-menu-item'
    );
    await expect(active).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(() => wrap.evaluate(el => el.scrollTop), { timeout: 5_000 })
      .toBeGreaterThan(0);

    // 展开动画期间位置会变化：轮询等待校正收敛（激活项完整落入滚动容器可视区）
    await expect
      .poll(
        async () => {
          const wrapBox = await wrap.boundingBox();
          const itemBox = await active.boundingBox();
          if (!wrapBox || !itemBox) return "hidden";
          const fits =
            itemBox.y >= wrapBox.y - 2 &&
            itemBox.y + itemBox.height <= wrapBox.y + wrapBox.height + 2;
          return fits
            ? "visible"
            : `overflow:${Math.round(itemBox.y + itemBox.height - (wrapBox.y + wrapBox.height))}`;
        },
        { timeout: 5_000 }
      )
      .toBe("visible");
  });

  test("侧栏装饰：悬停菜单项出现浅背景与图标放大", async ({ page }) => {
    await login(page);
    await page.mouse.move(700, 300);

    // 取首个一级叶子菜单项（`.submenu-title-noDropdown` 标记）：与语言/文案解耦
    const item = page
      .locator(".sidebar-container .el-menu-item.submenu-title-noDropdown")
      .first();
    await expect(item).toBeVisible({ timeout: 10_000 });
    expect(
      await item.evaluate(el => getComputedStyle(el).backgroundColor),
      "默认无悬停背景"
    ).toBe("rgba(0, 0, 0, 0)");

    await item.hover();
    await expect
      .poll(() => item.evaluate(el => getComputedStyle(el).backgroundColor), {
        timeout: 5_000
      })
      .not.toBe("rgba(0, 0, 0, 0)");
    await expect
      .poll(
        () =>
          item
            .locator(".sub-menu-icon > *")
            .first()
            .evaluate(el => getComputedStyle(el).transform),
        { timeout: 5_000 }
      )
      /* 悬停缩放：菜单 hover 的 scale(1.2) */
      .toContain("1.2");
  });

  test("侧栏装饰：折叠态目录徽标以角标显示", async ({ page }) => {
    await login(page);
    await page.mouse.move(700, 300);
    await page.keyboard.press("Alt+s");
    const collapsed = page.locator(".sidebar-container .el-menu--collapse");
    await expect(collapsed).toHaveCount(1, { timeout: 10_000 });

    await expect(
      page
        .locator(".sidebar-container .el-menu--collapse .sidebar-menu-badge")
        .first()
    ).toBeVisible();

    // 复位展开
    await page.mouse.move(700, 300);
    await page.keyboard.press("Alt+s");
    await expect(collapsed).toHaveCount(0, { timeout: 10_000 });
  });
});

test.describe("布局：顶栏水平菜单溢出", () => {
  test.afterEach(async ({ page }) => {
    // 复位布局偏好：本组用例会切到水平布局并落库（站点配置），本地存储与后端值
    // 都要复位——只改本地存储时下一个用例、甚至下一个浏览器批次仍会读回横向布局
    await ensureVerticalLayout(page).catch(() => undefined);
    await page
      .evaluate(() => {
        const raw = localStorage.getItem("responsive-layout");
        if (!raw) return;
        const cfg = JSON.parse(raw);
        cfg.layout = "vertical";
        localStorage.setItem("responsive-layout", JSON.stringify(cfg));
      })
      .catch(() => undefined);
  });

  test("窄视口下放不下的一级菜单收纳进「更多」下拉", async ({ page }) => {
    // 窄视口保证一级菜单超出顶栏可用宽度
    await page.setViewportSize({ width: 900, height: 720 });
    await login(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "布局");
    await page
      .locator('.right-panel .pref-choice__item[data-choice="horizontal"]')
      .first()
      .click();
    await expect(page.locator("body[layout='horizontal']")).toHaveCount(1, {
      timeout: 10_000
    });
    await closePanel(page);

    const headerMenu = page.locator(".horizontal-header-menu").first();
    await expect(headerMenu).toBeVisible({ timeout: 10_000 });

    // 溢出收纳：放不下的项折叠进带 More 图标的子菜单（图标标记 el-sub-menu__icon-more）
    const more = headerMenu
      .locator(".el-sub-menu:has(.el-sub-menu__icon-more)")
      .first();
    await expect(more).toBeVisible({ timeout: 10_000 });

    // 被收纳的一级菜单可从「更多」下拉进入（悬停展开弹层；
    // 页面存在多个常驻隐藏弹层，按可见性筛选，避免命中隐藏副本）
    await more.locator(".el-sub-menu__title").hover();
    const popup = page.locator(".el-menu--popup:visible").first();
    await expect(popup).toBeVisible({ timeout: 10_000 });
    await expect(
      popup.locator(".el-sub-menu__title, .el-menu-item").first()
    ).toBeVisible();
  });
});

test.describe("通用：自动检查更新开关", () => {
  test("默认开启，切换写入本地偏好并复位", async ({ page }) => {
    await login(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");

    const target = page
      .locator(".right-panel .pref-row")
      .filter({ hasText: "自动检查更新" })
      .first();
    await expect(target).toBeVisible({ timeout: 10_000 });
    const toggle = target.locator('.el-switch input[type="checkbox"]');
    const stored = () =>
      page.evaluate(() =>
        localStorage.getItem("responsive-check-updates-enabled")
      );

    // 默认开启（无存储 = 与历史行为一致）
    await expect(toggle).toBeChecked();

    await target.locator(".el-switch").click();
    await expect.poll(stored).toBe("false");
    await expect(toggle).not.toBeChecked();

    // 复位：重新开启，避免污染同批后续用例
    await target.locator(".el-switch").click();
    await expect.poll(stored).toBe("true");
    await expect(toggle).toBeChecked();
  });
});
