#!/usr/bin/env node
// 视口高度门禁（审查根因治理：视口高度魔数 + dvh 兜底双规则）。
//
// 背景：布局层已把「固定头部总高」导出为 --layout-chrome-h（layout/index.vue 写入，
// 侧栏/内容区/报表设计器消费），且全站惯例是 vh/dvh 双写（移动端动态工具栏：
// iOS Safari 地址栏收放时 dvh 跟随、vh 不动；不支持 dvh 的旧浏览器经 CSS 级联
// 回落 vh）。此前的偏离形态有二，均为「机制已建好、个别消费点漏网」：
//   1. 页面各自硬编码 calc(100vh - 141px) 一类经验值——用户偏好「隐藏页签/
//      隐藏顶栏/紧凑模式/用户模拟横幅」时魔数不再成立；
//   2. 视口高度声明只写 vh 不写 dvh——移动端底部内容被动态工具栏遮住。
//
// 规则 A（视口魔数，零容忍，无基线）：
//   calc(100vh - <字面量 px>) 一律失败。合规去向（按序选择）：
//     1. 布局内页面：calc(100dvh - var(--layout-chrome-h) - <页面私有让位>)；
//     2. 分栏/双栏页：hooks/useFullHeightPanel（视口实测，偏好组合全自适应）；
//     3. 弹层/抽屉（覆盖层，不随布局 chrome 变化）：单值 dvh + 注释说明私有让位
//        （先例：CardDrillDrawer / renderers-detail）；
//     4. 列内自适应：flex 流式分配（先例：ArtifactPreview 右列）。
//   覆盖层场景写 calc(100dvh - Npx) 不在本规则命中面（规则只认 100vh 减字面量），
//   布局场景若绕过 --layout-chrome-h 写 dvh 减字面量，属评审问题，静态不可判。
//
// 规则 B（dvh 兜底缺失，基线只减不增）：
//   height/min-height/max-height 的 vh 取值必须有 dvh 伴随（同一声明串内，或
//   紧随其后的同级声明——vh 先声明、dvh 后声明的双写惯例）；模板属性无法双写
//   的存量命中进 BASELINE 并写明收敛路径。位置类取值（top/left）不在扫描面。
//
// 自测样例（曾以故意违规验证拦截，见 docs/audit/2026-11-03-frontend-gap-closure.md）：
//   height: calc(100vh - 200px)  → 规则 A 拦截
//   height: 50vh（无 dvh 伴随）  → 规则 B 拦截
//
// 用法：
//   node scripts/check-viewport-heights.mjs            # 门禁（CI 用）
//   node scripts/check-viewport-heights.mjs --report   # 仅报告分布，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const EXCLUDE_DIRS = new Set(["node_modules", "__tests__"]);

/** calc(100vh - <字面量 px>)：布局魔数（零容忍） */
const VIEWPORT_MAGIC = /calc\(\s*100vh\s*-\s*\d+(?:\.\d+)?px\s*\)/gi;
/** height 系声明的 vh 取值（CSS 声明 / TS style 字符串；不跨声明边界） */
const VH_HEIGHT_DECL =
  /((?:min-|max-)?height)\s*:\s*[^;{}\n"']*?\d+(?:\.\d+)?vh\b/gi;
/** 模板属性（含 : 绑定形态）的 vh 取值 */
const VH_HEIGHT_ATTR =
  /(?::)?(?:min-height|max-height|height)\s*=\s*"[^"]*\d+(?:\.\d+)?vh[^"]*"/gi;
const DVH = /\d+(?:\.\d+)?dvh/;

/**
 * 规则 B 存量基线：相对路径 -> 允许的「vh 高度取值缺 dvh 伴随」条数（只减不增）。
 * 登记口径：模板属性单值无法双写的存量（收敛路径 = 改 CSS 类双写或 dvh 单值
 * + 注释，见脚本头「先例」）；清零后从本表移除。
 */
const BASELINE = {
  // 上游移植组件（RePureTableBar 列设置弹层的候选列表）：属性 max-height="36vh"
  // 无法在单属性内双写；收敛路径是改作用域类双写（上游同步成本 > 收益，暂缓）。
  "src/components/RePureTableBar/src/bar.tsx": 1
};

/** 剥离注释但保留行结构（dvh 伴随判定依赖行窗口） */
function stripCommentsKeepLines(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      rows.push(...walk(full));
    } else if (/\.(vue|scss|ts|tsx)$/.test(entry)) {
      rows.push(full);
    }
  }
  return rows;
}

function checkFile(file) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (rel.includes(".spec.")) return null;
  const text = stripCommentsKeepLines(readFileSync(file, "utf-8"));
  const magic = [...text.matchAll(VIEWPORT_MAGIC)].map(m => m[0]);

  const missingDvh = [];
  const lines = text.split("\n");
  const lineOf = index => text.slice(0, index).split("\n").length - 1;
  for (const m of [
    ...text.matchAll(VH_HEIGHT_DECL),
    ...text.matchAll(VH_HEIGHT_ATTR)
  ]) {
    const i = lineOf(m.index);
    // 伴随判定：命中行与后两行内出现 dvh（CSS 双写惯例 = vh 行 + 紧随 dvh 行；
    // TS style 字符串 = 同行两条声明）
    const window = lines.slice(i, i + 3).join("\n");
    if (!DVH.test(window)) missingDvh.push(m[0].trim());
  }
  const hasIssue = magic.length > 0 || missingDvh.length > 0;
  if (!hasIssue) return null;
  return { rel, magic, missingDvh };
}

const rows = walk(join(ROOT, SCAN_DIR)).map(checkFile).filter(Boolean);

const magicTotal = rows.reduce((sum, r) => sum + r.magic.length, 0);
const missingTotal = rows.reduce((sum, r) => sum + r.missingDvh.length, 0);
console.log(
  `视口高度门禁：扫描 ${SCAN_DIR}，视口魔数 ${magicTotal} 处 / dvh 缺伴随 ${missingTotal} 处。`
);

if (process.argv.includes("--report")) {
  for (const { rel, magic, missingDvh } of rows) {
    for (const m of magic) console.log(`  [magic]    ${rel}: ${m}`);
    for (const m of missingDvh) console.log(`  [no-dvh]   ${rel}: ${m}`);
  }
  process.exit(0);
}

const violations = [];
for (const { rel, magic, missingDvh } of rows) {
  for (const m of magic) {
    violations.push(
      `${rel}: 视口魔数 ${m} —— 改 --layout-chrome-h / useFullHeightPanel / flex 流式分配 / 覆盖层 dvh+注释`
    );
  }
  const allowed = BASELINE[rel] ?? 0;
  if (missingDvh.length > allowed) {
    violations.push(
      `${rel}: vh 高度缺 dvh 伴随 ${missingDvh.length} 处（基线 ${allowed}，只减不增）`
    );
  }
}
const cleared = Object.keys(BASELINE).filter(
  rel => !rows.some(row => row.rel === rel && row.missingDvh.length > 0)
);
if (cleared.length > 0) {
  console.log("以下文件已无 dvh 缺伴随命中，可从 BASELINE 移除：");
  for (const rel of cleared.sort()) console.log(`  ${rel}`);
}

if (violations.length > 0) {
  console.error("\n视口高度门禁失败（口径见脚本头注释）：");
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}
console.log("视口高度门禁通过（无新增视口魔数，dvh 伴随均在基线内）。");
