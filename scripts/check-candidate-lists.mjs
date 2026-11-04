#!/usr/bin/env node
// 候选列表可访问性门禁（审查根因治理：可键盘导航的候选列表必须带
// combobox/listbox/option 语义——键盘可达但读屏不可达的静态可检出部分）。
//
// 背景：命令面板与搜索候选此前是纯 div + @click（键盘 ↑↓/Enter 导航完整，但
// 读屏用户听到的是一串无状态文本），同仓 ChatWindow @ 候选已有正确 listbox
// 语义——属「机制已建好、个别消费点漏网」。语义接线范式（SearchModal 家族 +
// paletteA11y.ts 同源）：
//   输入框   role="combobox" + :aria-expanded + :aria-activedescendant
//   容器     role="listbox"（+ id，供 aria-controls / activedescendant 指向）
//   候选项   role="option" + :id（与 activedescendant 同源构造）+ :aria-selected
//   combobox 角色两种等价形态：①模板字面 role="combobox"；②EP el-input 的
//   useAttrs 排除表丢弃 role attr（模板写了也不渲染、aria-* 正常透传），须以
//   paletteA11y.applyPaletteComboboxRole 在挂载后补写到内层 input（角色落位由
//   运行时单测 searchA11y.spec 与 e2e/a11y 命令面板用例断言），②与①同权认定，
//   aria-expanded / aria-activedescendant 仍须同文件可见。
//
// 静态可检出面（四条规则，全部零容忍）：
//   A. 文件含 aria-activedescendant → 必须同文件具备 combobox 角色 + listbox
//      （或 grid）容器 + option 项（三层接线缺一不可）；
//   B. 文件含 role="combobox" → 必须同文件具备 aria-expanded 与
//      aria-activedescendant（半接线 = 未完成）；
//   C. 文件含 role="listbox" → 必须同文件具备 role="option"（空 listbox 语义）；
//   D. 候选列表签名（v-for 项 + @mouseenter 悬停跟随 + @click 选中）→ 项必须
//      带 role="option"；导航 chrome（页签条/侧栏菜单等非候选列表）在 EXEMPT
//      登记并写明理由（其语义由 tab/menu 惯例或 EP 组件内部承担）。
// aria-activedescendant 之外的 roving tabindex 形态、无鼠标跟随的纯键盘候选、
// 动态注入的语义属评审范围，静态不可判。
//
// 自测样例（曾以故意违规验证拦截，见 docs/audit/2026-11-03-frontend-gap-closure.md）：
//   aria-activedescendant 无 listbox/option → 规则 A 拦截
//   v-for + @mouseenter + @click 且无 role="option" → 规则 D 拦截
//
// 用法：
//   node scripts/check-candidate-lists.mjs            # 门禁（CI 用）
//   node scripts/check-candidate-lists.mjs --report   # 仅报告命中面，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const EXCLUDE_DIRS = new Set(["node_modules", "__tests__"]);

/** 候选签名窗口：@mouseenter 前后各行数（覆盖多行开标签） */
const SIGNATURE_WINDOW = 12;

/**
 * 规则 D 豁免表：相对路径 -> 理由。只收录「v-for + 悬停跟随 + 点击」签名但
 * 语义由其它体系承担的导航 chrome；候选列表（搜索/选人/命令面板）不得进本表。
 */
const EXEMPT = {
  // 页签条：悬停是关闭按钮的悬停反馈（onMouseenter 展开关闭图标），项的角色
  // 由「页签 = 可关闭的路由入口」导航语义承担，键盘走标签页惯例而非列表选择。
  "src/layout/components/lay-tag/index.vue":
    "页签条为导航 chrome（悬停反馈非候选跟随），语义由页签导航惯例承担",
  // EP 菜单项：el-menu/el-sub-menu 内部承担 menuitem 语义与键盘导航。
  "src/layout/components/lay-sidebar/NavVertical.vue":
    "EP 菜单项语义（menu/menuitem）由 el-menu 体系承担"
};

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      rows.push(...walk(full));
    } else if (entry.endsWith(".vue")) {
      rows.push(full);
    }
  }
  return rows;
}

function stripCommentsKeepLines(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function checkFile(file) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (rel.includes(".spec.")) return null;
  const raw = readFileSync(file, "utf-8");
  const text = stripCommentsKeepLines(raw);
  const problems = [];

  const hasCombobox =
    text.includes('role="combobox"') ||
    // 等价形态②（见头注释）：EP el-input 丢弃 role attr，combobox 角色经
    // paletteA11y.applyPaletteComboboxRole 运行时补写，接线与字面形态同权
    text.includes("applyPaletteComboboxRole");
  const hasExpanded =
    /:?aria-expanded/.test(text) || /aria-expanded"/.test(text);
  const hasActivedescendant =
    /:?aria-activedescendant/.test(text) || /aria-activedescendant"/.test(text);
  const hasListbox = text.includes('role="listbox"');
  const hasOption = text.includes('role="option"');

  // A：activedescendant 三层接线完备
  if (
    (raw.includes("aria-activedescendant") ||
      raw.includes(":aria-activedescendant")) &&
    !(hasCombobox && (hasListbox || text.includes('role="grid"')) && hasOption)
  ) {
    problems.push(
      "aria-activedescendant 存在但 combobox/listbox/option 三层接线不全"
    );
  }
  // B：combobox 半接线
  if (hasCombobox && !(hasExpanded && hasActivedescendant)) {
    problems.push('role="combobox" 缺 aria-expanded / aria-activedescendant');
  }
  // C：listbox 空语义
  if (hasListbox && !hasOption) {
    problems.push('role="listbox" 下没有 role="option"');
  }
  // D：候选签名（v-for + 悬停跟随 + 点击）必须 option 语义
  const lines = text.split("\n");
  const exempt = EXEMPT[rel];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("@mouseenter")) continue;
    const from = Math.max(0, i - SIGNATURE_WINDOW);
    const to = Math.min(lines.length, i + SIGNATURE_WINDOW);
    const window = lines.slice(from, to).join("\n");
    const isCandidate =
      window.includes("v-for") &&
      (window.includes("@click") || window.includes("@keydown"));
    if (!isCandidate) continue;
    if (window.includes('role="option"')) continue;
    if (exempt) continue; // 豁免 = 登记 + 理由，恒放行（演进为候选列表时须移出）
    problems.push(
      '候选列表签名（v-for + @mouseenter 跟随 + @click 选中）缺 role="option" 语义'
    );
  }
  if (problems.length === 0) return null;
  return { rel, problems: [...new Set(problems)] };
}

const rows = walk(join(ROOT, SCAN_DIR)).map(checkFile).filter(Boolean);

console.log(
  `候选列表可访问性门禁：扫描 ${SCAN_DIR}，${rows.length} 个文件语义接线不全。`
);

if (process.argv.includes("--report")) {
  for (const { rel, problems } of rows) {
    for (const p of problems) console.log(`  ${rel}: ${p}`);
  }
  process.exit(0);
}

if (rows.length > 0) {
  console.error(
    "\n候选列表可访问性门禁失败（接线范式见脚本头注释：combobox + listbox + option + aria-selected）："
  );
  for (const { rel, problems } of rows) {
    for (const p of problems) console.error(`  ${rel}: ${p}`);
  }
  process.exit(1);
}
console.log("候选列表可访问性门禁通过（combobox/listbox/option 接线完备）。");
