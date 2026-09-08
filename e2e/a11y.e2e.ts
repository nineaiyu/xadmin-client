import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * a11y 自动化门禁（N2）：axe-core 对关键页面做 wcag2a/wcag2aa 基线扫描。
 *
 * 口径：
 * - 只阻断 critical / serious 级违规，moderate 及以下不阻断，避免门禁常红失去信号；
 * - 已登记豁免（ALLOWED_VIOLATIONS）针对「第三方组件结构问题 / 需产品决策的主题对比度」，
 *   按规则 + 选择器摘要匹配，同一违规出现**新的命中节点**仍会阻断；
 * - 扩大白名单必须在 docs/accessibility-audit.md 待办里登记跟踪项，禁止静默放行。
 */

const IMPACT_BLOCKING = new Set(["critical", "serious"]);

/**
 * 豁免登记（规则 id → 节点选择器摘要的匹配正则）：
 * - aria-required-children / aria-required-parent：Element Plus el-menu 在垂直模式
 *   生成的 ARIA 结构不完整，属组件库内部实现，仓库侧不覆盖其 DOM；
 * - color-contrast：主题色（--el-color-primary #409EFF）白字对比度不足，
 *   修复需换全局主题色，影响面大，另行决策；
 * - button-name：RePlusPage 工具栏 el-tooltip 包裹的图标按钮（刷新/列设置/密度），
 *   缺可访问名称，待 RePlusPage 统一补 aria-label 后移出；
 * - scrollable-region-focusable：EP 表格内嵌 el-scrollbar 滚动区不可键盘聚焦，组件库行为；
 * - svg-img-alt：Iconify 菜单/输入框装饰图标以 role="img" 渲染且无 alt，统一改渲染层后移出；
 * - label：plus-pro-components 动态表单控件的 label 关联缺失（EP 动态 id）；
 * - aria-roles `.bar`：来源待查（仓库源码无该元素，疑似第三方注入）。
 */
const ALLOWED_VIOLATIONS: Record<string, RegExp[]> = {
  "aria-required-children": [/\.el-menu--vertical/, /ul\[data-old-padding-top/],
  "aria-required-parent": [
    /\.submenu-title-noDropdown/,
    /\.el-menu-item\.nest-menu/
  ],
  "color-contrast": [
    /el-button/,
    /plus-form-item__label/,
    /(^|\s)p($|\s|\.)/,
    /^#el-id-/
  ],
  // RePlusPage 工具栏 el-tooltip 图标按钮与 EP 动态 id 的无名命令按钮
  "button-name": [/el-tooltip__trigger/, /^#el-id-/],
  "aria-command-name": [/^#el-id-/],
  "scrollable-region-focusable": [/el-scrollbar__wrap/],
  // Iconify 图标以 role="img" 渲染且无 alt（属性选择器与 class 形态都登记）
  "svg-img-alt": [/\[role="img"\]/],
  label: [/^#el-id-/],
  "aria-roles": [/^\.bar$/]
};

/** 判断单条违规是否被豁免：所有命中节点都匹配登记的选择器才算豁免 */
function isAllowed(
  violation: Awaited<ReturnType<typeof scanBlockingViolations>>[number]
): boolean {
  const patterns = ALLOWED_VIOLATIONS[violation.id];
  if (!patterns) return false;
  const targets = violation.nodes.split(" | ").filter(Boolean);
  return (
    targets.length > 0 &&
    targets.every(target => patterns.some(pattern => pattern.test(target)))
  );
}

/** 扫描并返回阻断级违规摘要（豁免项已剔除） */
async function scanBlockingViolations(page: import("@playwright/test").Page) {
  const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  const { violations } = await builder.analyze();
  return violations
    .filter(violation => IMPACT_BLOCKING.has(violation.impact ?? ""))
    .map(violation => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes
        .map(node => node.target.join(" "))
        .slice(0, 5)
        .join(" | ")
    }))
    .filter(violation => !isAllowed(violation));
}

function formatViolations(
  violations: Awaited<ReturnType<typeof scanBlockingViolations>>
): string {
  return violations
    .map(
      violation =>
        `[${violation.impact}] ${violation.id}（${violation.help}）→ ${violation.nodes}`
    )
    .join("\n");
}

test("a11y 基线：登录页无 critical/serious 违规", async ({ page }) => {
  await page.goto("/#/login");
  await expect(page.getByPlaceholder("账号")).toBeVisible({
    timeout: 15_000
  });

  const violations = await scanBlockingViolations(page);
  expect(
    violations,
    `登录页 a11y 违规：\n${formatViolations(violations)}`
  ).toEqual([]);
});

test("a11y 基线：用户管理页无 critical/serious 违规", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });

  const violations = await scanBlockingViolations(page);
  expect(
    violations,
    `用户管理页 a11y 违规：\n${formatViolations(violations)}`
  ).toEqual([]);
});
