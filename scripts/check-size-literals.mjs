#!/usr/bin/env node
// 定尺寸字面量门禁（只减不增）：width/height/min-*/max-*/flex-basis 的 px 字面量
// 与模板 w-[Npx]/h-[Npx]/size-[Npx] 任意值纳入登记管理。
//
// 与 check-spacing-literals 的分工：间距门禁管「节奏」（margin/padding/gap 必须
// 落在间距刻度上）；本门禁管「定尺寸」——尺寸没有统一刻度，合法的固定尺寸
// （侧栏宽度、画布、图标、头像、媒体容器）客观存在，故口径是「全量登记、
// 只减不增、新增必须说明语义」，而不是「清零」。
//
// 自动放行（不计数）：
//   - |N| ≤ 2px：描边/发丝线宽度的尺寸化表达；
//   - |N| ≥ 9999px：屏外隐藏 / 离屏测量技巧；
//   - 声明值含 var( / calc(：已是令牌或计算值；
//   - tokens/**（定义处）、assets/iconfont/**（三方生成物）、src/tests/、*.spec.*。
// 优先去向（新增代码按此顺序选择）：
//   1. 已有语义布局令牌（--sidebar-width / --layout-header-h / --nav-item-icon-size …）；
//   2. Tailwind 数值类（w-9 = 36px 等，由 --spacing 派生）；
//   3. 组件私有固定尺寸：留在本基线并在注释里写清语义。
//
// 用法：
//   node scripts/check-size-literals.mjs            # 门禁（CI 用）
//   node scripts/check-size-literals.mjs --report   # 仅报告分布，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const EXCLUDE_DIRS = new Set(["node_modules", "__tests__"]);
const EXCLUDE_PATHS = [
  "src/style/tokens/",
  "src/assets/iconfont/",
  "src/tests/"
];

const DECL =
  /(?:min-|max-)?(?:width|height|flex-basis)\s*:\s*(-?\d+(?:\.\d+)?)px/g;
const TEMPLATE =
  /(?:^|[\s"'`])(?:[a-z-]+:)*(?:w|h|min-w|min-h|max-w|max-h|size|basis)-\[(-?\d+(?:\.\d+)?)px\]/g;

function exempt(abs) {
  return abs <= 2 || abs >= 9999;
}

/**
 * 存量基线：相对路径 -> 条数（只减不增；清零后从本表移除）。
 * 登记口径：图标/头像/徽标/指示条等元件私有固定尺寸、登录卡等页面级定宽、
 * 画布/弹层最大宽、第三方移植组件内部尺寸。新语义布局尺寸不得进本表——
 * 先考虑既有布局令牌（primitives.scss 的「布局尺度」段）。
 */
const BASELINE = {
  // —— 高频登记区（元件私有固定尺寸，逐文件注明语义）——
  // 侧栏体系：徽标 18px、菜单激活条 2/3px、窄列字幕/图标等元件尺寸
  // 页签（lay-tag）：关闭图标 14/16/18px、分隔条、滚动按钮
  // AiThinking：节点圆点 4/12/14px、内容最大高 200px
  // ReSplitPane（第三方移植）：拖拽手柄握把尺寸
  // login.scss：登录卡/表单定宽（280~500px）与品牌插画高
  // ReActionPanel：头像 44px、图标徽章
  // SettingTabbar/SettingMenuLayout/SettingTheme*：微缩预览线框的骨架条
  // 其余条目：组件私有固定尺寸（图标/头像/进度条/验证码元件等），
  // 新增定尺寸优先复用布局令牌或 Tailwind 数值类，确需新增在此登记语义。
  "src/style/sidebar/_common.scss": 20,
  "src/layout/components/lay-tag/index.scss": 10,
  "src/components/AiThinking/index.vue": 9,
  "src/components/ReActionPanel/src/PanelProfile.vue": 8,
  "src/components/ReSplitPane/resizer.css": 8,
  "src/style/login.scss": 8,
  "src/components/ReActionPanel/src/index.vue": 7,
  "src/layout/components/lay-setting/components/SettingTabbar.vue": 7,
  "src/views/integration/knowledge/components/KnowledgePanel.vue": 7,
  "src/views/analysis/screen/components/ScreenPane.vue": 6,
  "src/views/settings/components/settings-shell/index.vue": 6,
  "src/components/ReWordClickCaptcha/src/index.vue": 5,
  "src/layout/components/lay-panel/index.vue": 5,
  "src/layout/components/lay-setting/components/SettingMenuLayout.vue": 5,
  "src/style/element-plus.scss": 5,
  "src/views/account/components/AccountPanel.vue": 5,
  "src/views/system/directory/components/DirectoryAside.vue": 5,
  "src/components/ReIcon/src/Select.vue": 4,
  "src/layout/components/lay-setting/components/PrefRow.vue": 4,
  "src/layout/components/lay-setting/components/ShortcutInput.vue": 4,
  "src/views/dashboard/index.vue": 4,
  "src/views/integration/api-app/components/ApiGrantEditor.vue": 4,
  "src/views/system/menu/components/MenuTreeRow.vue": 4,
  "src/views/system/user/components/UserTree.vue": 4,
  "src/components/ReCollapseParams/src/index.vue": 3,
  "src/components/ReMenuPermissionTree/MenuPermissionTree.vue": 3,
  "src/components/RePlusPage/src/components/ButtonOperation/src/index.vue": 3,
  "src/components/RePlusPage/src/components/TagInput.vue": 3,
  "src/layout/components/lay-impersonation/index.vue": 3,
  "src/layout/components/lay-lock/index.vue": 3,
  "src/layout/components/lay-navbar/NavbarActions.vue": 3,
  "src/layout/components/lay-navbar/NavbarLogo.vue": 3,
  "src/layout/components/lay-setting/components/PrefBlock.vue": 3,
  "src/layout/components/lay-setting/components/SettingAnimation.vue": 3,
  "src/layout/components/lay-setting/components/SettingSemanticColors.vue": 3,
  "src/layout/components/lay-setting/components/SettingTheme.vue": 3,
  "src/layout/components/lay-setting/components/SettingThemePreset.vue": 3,
  "src/layout/components/lay-sidebar/components/SidebarLogo.vue": 3,
  "src/layout/components/lay-sidebar/NavVertical.vue": 3,
  "src/views/integration/api-app/components/ApiAppPanel.vue": 3,
  "src/views/settings/captcha/components/CaptchaInteractiveSetting.vue": 3,
  "src/views/settings/components/settings-shell/SettingPreview.vue": 3,
  "src/components/AiMessageBlock/index.vue": 2,
  "src/components/ReBackTop/src/index.vue": 2,
  "src/components/ReCaptchaChallenge/src/Panel.vue": 2,
  "src/components/ReMenuPermissionTree/PermissionNodeLabel.vue": 2,
  "src/components/ReSegmented/src/index.css": 2,
  "src/components/ReSkeleton/src/index.vue": 2,
  "src/components/ReStateContainer/src/index.vue": 2,
  "src/layout/components/lay-notice/components/NoticeItem.vue": 2,
  "src/layout/components/lay-setting/components/SettingScale.vue": 2,
  "src/layout/components/lay-setting/components/SettingStretch.vue": 2,
  "src/layout/components/lay-setting/index.vue": 2,
  "src/layout/components/lay-sidebar/components/SidebarBreadCrumb.vue": 2,
  "src/layout/components/lay-sidebar/components/SidebarCenterCollapse.vue": 2,
  "src/layout/components/lay-sidebar/components/SidebarLeftCollapse.vue": 2,
  "src/style/_header.scss": 2,
  "src/style/reset.scss": 2,
  "src/style/screen-carousel.scss": 2,
  "src/views/account/components/AccountSidebar.vue": 2,
  "src/views/account/components/BindEmailOrPhone.vue": 2,
  "src/views/analysis/report/components/ReportDesignSidebar.vue": 2,
  "src/views/analysis/report/designer.vue": 2,
  "src/views/analysis/screen/components/FreeCanvasToolbar.vue": 2,
  "src/views/analysis/screen/components/MultiSelectInspector.vue": 2,
  "src/views/settings/captcha/components/CaptchaRiskSetting.vue": 2,
  "src/views/system/menu/components/MenuContextMenu.vue": 2,
  "src/views/system/menu/components/MenuTreeToolbar.vue": 2,
  "src/views/system/monitor/components/HealthBanner.vue": 2,
  "src/views/system/permission/components/RuleListEditor.vue": 2,
  "src/components/ReCaptchaChallenge/src/index.vue": 1,
  "src/components/ReJsonViewer/src/index.vue": 1,
  "src/components/ReMenuPermissionTree/PermissionTreeToolbar.vue": 1,
  "src/components/ReNoticeShow/index.vue": 1,
  "src/components/RePlusPage/src/components/PhoneInput.vue": 1,
  "src/components/RePlusPage/src/index.vue": 1,
  "src/components/ReScrollbar/src/index.vue": 1,
  "src/components/ReSliderCaptcha/src/index.vue": 1,
  "src/layout/components/lay-content/index.vue": 1,
  "src/layout/components/lay-navbar/index.vue": 1,
  "src/layout/components/lay-notice/index.vue": 1,
  "src/layout/components/lay-search/components/SearchHistory.vue": 1,
  "src/layout/components/lay-search/components/SearchResult.vue": 1,
  "src/layout/components/lay-setting/components/PrefChoice.vue": 1,
  "src/style/appearance.scss": 1,
  "src/utils/progress/index.ts": 1,
  "src/views/account/components/Profile.vue": 1,
  "src/views/account/index.vue": 1,
  "src/views/analysis/screen/components/DesignerPalette.vue": 1,
  "src/views/analysis/screen/designer.scss": 1,
  "src/views/chat/components/ChatEmojiPanel.vue": 1,
  "src/views/error/components/ErrorPage.vue": 1,
  "src/views/integration/api-app/components/ApiUsageDrawer.vue": 1,
  "src/views/login/components/LoginPrivacyNotice.vue": 1,
  "src/views/oauth/authorize.vue": 1,
  "src/views/settings/captcha/components/CaptchaDataSetting.vue": 1,
  "src/views/settings/captcha/components/CaptchaImageSetting.vue": 1,
  "src/views/settings/components/settings-shell/SettingItem.vue": 1,
  "src/views/system/codegen/components/ArtifactPreview.vue": 1,
  "src/views/system/file/components/PreviewDrawer.vue": 1,
  "src/views/system/menu/components/MenuPermissionAuditDialog.vue": 1,
  "src/views/system/menu/components/MenuPermissionDialog.vue": 1,
  "src/views/system/notice/components/markdown/MarkdownToolbar.vue": 1,
  "src/views/system/notice/components/MarkdownEditor.vue": 1,
  "src/views/system/permission/components/ScopeSelect.vue": 1
};

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      rows.push(...walk(full));
    } else if (/\.(vue|scss|css|ts|tsx)$/.test(entry)) {
      rows.push(full);
    }
  }
  return rows;
}

/** 剥离注释：避免把文档/说明里的示例计入 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function countLiterals(file) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (rel.includes(".spec.")) return { rel, count: 0 };
  if (EXCLUDE_PATHS.some(prefix => rel.startsWith(prefix))) {
    return { rel, count: 0 };
  }
  const text = stripComments(readFileSync(file, "utf-8"));
  let count = 0;
  for (const line of text.split("\n")) {
    if (line.includes("var(") || line.includes("calc(")) {
      // 模板任意值类仍可能被命中的行（含 var 的 class 串不常见，逐行判断）
    }
    for (const m of line.matchAll(DECL)) {
      // 同行同声明含 var(/calc( 的复合值已在正则层拆不开，这里按值本身判断
      if (!exempt(Math.abs(parseFloat(m[1])))) count++;
    }
    for (const m of line.matchAll(TEMPLATE)) {
      if (!exempt(Math.abs(parseFloat(m[1])))) count++;
    }
  }
  return { rel, count };
}

const rows = walk(join(ROOT, SCAN_DIR))
  .map(countLiterals)
  .filter(row => row.count > 0)
  .sort((a, b) => b.count - a.count || a.rel.localeCompare(b.rel));

const total = rows.reduce((sum, row) => sum + row.count, 0);
console.log(
  `定尺寸字面量门禁：扫描 ${SCAN_DIR}，命中 ${rows.length} 个文件 / ${total} 处（基线 ${Object.keys(BASELINE).length} 个文件）。`
);

if (process.argv.includes("--report")) {
  for (const { rel, count } of rows) {
    console.log(`  ${String(count).padStart(3)}  ${rel}`);
  }
  process.exit(0);
}

const violations = [];
for (const { rel, count } of rows) {
  const allowed = BASELINE[rel];
  if (allowed === undefined) {
    violations.push(
      `${rel}: ${count} 处（未登记的定尺寸字面量——优先复用布局令牌 / Tailwind 数值类，否则登记并注释语义）`
    );
  } else if (count > allowed) {
    violations.push(`${rel}: ${count} 处（超过基线 ${allowed}，只减不增）`);
  }
}
const cleared = Object.keys(BASELINE).filter(
  rel => !rows.some(row => row.rel === rel)
);
if (cleared.length > 0) {
  console.log("以下文件已无定尺寸字面量，可从 BASELINE 移除：");
  for (const rel of cleared.sort()) console.log(`  ${rel}`);
}

if (violations.length > 0) {
  console.error(
    "\n定尺寸字面量门禁失败（口径见脚本头注释：登记只减不增，非清零）："
  );
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}
console.log("定尺寸字面量门禁通过（基线均未增长）。");
