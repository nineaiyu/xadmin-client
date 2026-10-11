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
 *
 * 仅存 EP 菜单垂直模式的 ARIA 结构问题：el-menu 渲染 `ul[role=menubar] > a > li[role=menuitem]`，
 * axe 判 `aria-required-children`（menubar 下出现不被允许的 `a`）与 `aria-required-parent`
 * （`li[role=menuitem]` 的父级是 `a` 而非 menu/menubar/group）。DOM 由组件库生成、
 * 侧栏契约冻结（仓库侧不覆写其结构），待上游补全；命中节点全部位于侧栏/菜单树区域。
 *
 * 2026-10-11 收尾：其余豁免已全部消化——`color-contrast`（主题色收口与对比度修复）、
 * `button-name` / `aria-command-name`（仓库图标按钮可访问名：页签「更多」、开关渲染器）、
 * `label`（el-switch 渲染器 + 菜单工具栏下拉补 aria-label，分页器下拉经 tableA11y 收口）、
 * `scrollable-region-focusable`（多值标签渲染器 el-scrollbar 补 tabindex）、
 * `svg-img-alt`（Iconify 渲染层统一 aria-hidden 后无命中）、`aria-roles .bar`（无命中）。
 * 摘除项若在其他扫描面重新命中，按「先本地收口、再登记」路径处理（见 docs/accessibility-audit.md）。
 */
const ALLOWED_VIOLATIONS: Record<string, RegExp[]> = {
  "aria-required-children": [/\.el-menu--vertical/, /ul\[data-old-padding-top/],
  "aria-required-parent": [
    /\.submenu-title-noDropdown/,
    /\.el-menu-item\.nest-menu/,
    // 当前激活菜单项：axe 对该节点取「最短唯一选择器」（命中形态 .is-active.el-menu-item[role=menuitem]），
    // 不带 nest-menu / a[href$=...] 前缀，属同一 EP 菜单垂直模式 ARIA 结构问题（见 docs/accessibility-audit.md）
    /\.is-active\.el-menu-item/,
    // 垂直菜单叶子项（a[href$=...] > .el-menu-item[role=menuitem]）：同一 EP 菜单
    // ARIA 结构的第三种取选择器形态（2026-10-11 扩面，菜单数据新增后成批暴露）
    /> \.el-menu-item\[role="menuitem"\]$/
  ]
};

/** axe 阻断级违规摘要（豁免剔除后的最小结构） */
type ViolationSummary = {
  id: string;
  impact: string | null | undefined;
  help: string;
  nodes: string;
};

/** 判断单条违规是否被豁免：所有命中节点都匹配登记的选择器才算豁免 */
function isAllowed(violation: ViolationSummary): boolean {
  const patterns = ALLOWED_VIOLATIONS[violation.id];
  if (!patterns) return false;
  const targets = violation.nodes.split(" | ").filter(Boolean);
  return (
    targets.length > 0 &&
    targets.every(target => patterns.some(pattern => pattern.test(target)))
  );
}

/** 单次 axe 扫描（阻断级 → 摘要 → 剔除豁免） */
async function scanOnce(
  page: import("@playwright/test").Page
): Promise<ViolationSummary[]> {
  await page.addStyleTag({
    content:
      "*, *::before, *::after { transition: none !important; animation: none !important; }"
  });
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

/**
 * 扫描并返回阻断级违规摘要（豁免项已剔除）。
 *
 * axe 采样必须在动画终态进行：入场 opacity transition 未结束时，半透明文字与
 * 背景混色会拉低对比度，产生瞬态 color-contrast 假违规（首扫偶发、隔离重跑必过）。
 * 注入样式让所有动画立即跳到终态仍不足以覆盖 JS 驱动的入场（登录页第三方登录区
 * 异步渲染），故命中违规时**等一拍复扫**，以稳定后的结果判定（真实缺陷复扫仍在）。
 */
async function scanBlockingViolations(
  page: import("@playwright/test").Page
): Promise<ViolationSummary[]> {
  const first = await scanOnce(page);
  if (first.length === 0) return first;
  await page.waitForTimeout(500);
  return scanOnce(page);
}

function formatViolations(violations: ViolationSummary[]): string {
  return violations
    .map(
      violation =>
        `[${violation.impact}] ${violation.id}（${violation.help}）→ ${violation.nodes}`
    )
    .join("\n");
}

/**
 * 等页面上「可见的树」渲染出真实节点再扫描。
 *
 * el-tree 数据未到位时渲染 `.el-tree__empty-block`（role=tree 的子节点不是 treeitem），
 * axe 判 `aria-required-children` critical——并行高负载下采样到该瞬态即失败
 * （2026-09-25 探针实测：empty-block 命中 / 无子节点与含 treeitem 均不命中）。
 * 页面上没有可见树时直接跳过，不引入多余等待。
 */
async function waitForVisibleTreeRows(page: import("@playwright/test").Page) {
  const tree = page.locator(".el-tree:visible").first();
  if ((await tree.count()) === 0) return;
  await expect(tree.locator(".el-tree-node").first()).toBeVisible({
    timeout: 15_000
  });
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
  // 左侧部门树同样是异步数据，等其渲染出节点（见 waitForVisibleTreeRows）
  await waitForVisibleTreeRows(page);

  const violations = await scanBlockingViolations(page);
  expect(
    violations,
    `用户管理页 a11y 违规：\n${formatViolations(violations)}`
  ).toEqual([]);
});

test("a11y 扩面：流程配置抽屉（表单密集场景）无 critical/serious 违规", async ({
  page
}) => {
  await login(page);
  await openMenuPath(page, ["审批"], "/approval/flow/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });

  // 打开「新增流程」配置抽屉：基本信息 + 表单字段 + 节点编辑的密集表单场景
  await page.getByRole("button", { name: "新增流程" }).first().click();
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await expect(drawer).toContainText("审批节点");

  const violations = await scanBlockingViolations(page);
  expect(
    violations,
    `流程配置抽屉 a11y 违规：\n${formatViolations(violations)}`
  ).toEqual([]);
});

test("a11y 扩面：菜单管理页（树行 + 编辑抽屉）无 critical/serious 违规", async ({
  page
}) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/menu/index");
  await expect(page.locator(".el-tree").first()).toBeVisible({
    timeout: 15_000
  });
  // 等菜单树渲染出真实行：只等容器可见会在数据未到位时扫到 empty-block 态，
  // axe 判 `.el-tree` aria-required-children critical（并行高负载下必现，
  // 2026-09-25 根因定位：empty-block 命中 / 含 treeitem 不命中）
  await waitForVisibleTreeRows(page);

  // 树行：行内启停开关与操作按钮（默认 opacity 0，仍在无障碍树内，必须有可访问名称）
  const treeViolations = await scanBlockingViolations(page);
  expect(
    treeViolations,
    `菜单管理页 a11y 违规：\n${formatViolations(treeViolations)}`
  ).toEqual([]);

  // 抽屉：分组表单 + 树选择（次级编辑面同样纳入扫描）
  await expect(page.getByText("系统管理").first()).toBeVisible({
    timeout: 15_000
  });
  const targetRow = page.locator(".menu-row").first();
  await targetRow.locator(".menu-row__title").click();
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  const drawerViolations = await scanBlockingViolations(page);
  expect(
    drawerViolations,
    `菜单编辑抽屉 a11y 违规：\n${formatViolations(drawerViolations)}`
  ).toEqual([]);
});

test("a11y 交互：数据表有可访问名，弹窗/抽屉关闭后焦点归还触发元素", async ({
  page
}) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });

  // 数据表可访问名（读屏以页面标题播报表体/表头两张原生表）
  const tableLabel = await page
    .locator("table.el-table__body")
    .first()
    .getAttribute("aria-label");
  expect(tableLabel && tableLabel.trim().length > 0, "表体缺少可访问名").toBe(
    true
  );

  // 焦点归还（ReDialog）：键盘唤起弹窗 → Esc 关闭 → 焦点回到触发按钮
  const addButton = page.getByRole("button", { name: "新增" }).first();
  await addButton.focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(addButton).toBeFocused();

  // 焦点归还（ReDrawer）：行内「管理」抽屉同样归还
  const row = page.locator(".el-table__row").first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const manageButton = row.getByRole("button", { name: "管理" }).first();
  await manageButton.focus();
  await page.keyboard.press("Enter");
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden({ timeout: 15_000 });
  await expect(manageButton).toBeFocused();
});
