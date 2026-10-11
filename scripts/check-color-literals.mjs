#!/usr/bin/env node
// 裸颜色值门禁（只减不增）：禁止在消费端新增「裸 hex / rgb() / rgba() / hsl(数字…)」。
//
// 口径：颜色单一来源为三层令牌——`tokens/primitives.scss`（原始值）与
// `tokens/semantic.scss`（明暗成对语义槽）；业务与组件样式一律消费
// `hsl(var(--x))` / `var(--el-*)` / Tailwind 语义别名（bg-bg-card、text-fg…），
// 写死颜色会绕开「暗色主题 / 语义色自定义 / 主题预设」三套运行期切换。
//
// 扫描面（src 下，先剥离注释再匹配）：
//   - 十六进制：#rgb / #rrggbb / #rrggbbaa（排除 `#` + 非 8 位十六进制字符的 id 选择器）
//   - 函数色：rgb( / rgba( / hsl(数字) —— 含 `var(` 的写法是令牌消费，放行
// 豁免：tokens/**（令牌定义处）、assets/iconfont/**（三方生成物）、*.spec.*、
//       __tests__/**，以及下方 BASELINE 登记的存量（按文件计数，只减不增）。
//
// 用法：
//   node scripts/check-color-literals.mjs            # 门禁（CI 用）
//   node scripts/check-color-literals.mjs --report   # 仅报告分布，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const EXCLUDE_DIRS = new Set(["node_modules", "__tests__"]);
const EXCLUDE_PATHS = [
  "src/style/tokens/", // 令牌定义处：颜色唯一来源
  "src/assets/iconfont/", // iconfont 生成物（第三方）
  "src/tests/" // 测试环境装配
];

const PATTERNS = [
  // 十六进制色值（后面不能紧跟标识符字符，避免把 `#abc` 之类 id 选择器当色值）
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g,
  // 函数色：rgb() / rgba() / hsl()——参数里带 var( 的是令牌消费，单独过滤
  /\brgba?\([^)]*\)/g,
  /\bhsl\([^)]*\)/g
];

/**
 * 存量基线：相对路径 -> 裸颜色值条数（只减不增；清零后从本表移除）。
 * 均为「颜色自身的定义处」或运行期无法消费 CSS 变量的场景，逐条注明原因：
 * - 主题色板：菜单调色板选项 / 内置预设 swatch / 半暗顶栏与侧栏调色板
 * - EP 兜底：图表与 canvas 只接受字面量，`cssVarColor(name, fallback)` 第二参
 * - 语义色默认值：语义色自定义面板的默认值（用户初始色板）
 * - 二维码：扫码需要真白底
 * - 颜色选择器预设色板 / 颜色换算工具
 * 注意：新增业务页面不得进入本表。
 */
const BASELINE = {
  "src/layout/hooks/themeColorScheme.ts": 12,
  "src/layout/hooks/themePresets.ts": 14,
  "src/utils/chartTheme.ts": 12,
  "src/utils/themeConstants.ts": 4,
  "src/views/account/components/ReQrcode/src/index.tsx": 2,
  "src/views/account/components/ReQrcode/src/index.scss": 1,
  "src/components/RePlusPage/src/utils/renderers-form.tsx": 9,
  "src/style/sidebar/_index.scss": 8,
  "src/style/_header.scss": 5,
  "src/utils/imageExport.ts": 1,
  "src/views/dashboard/components/ChartCard.vue": 4,
  "src/views/system/monitor/components/HistoryChart.vue": 1,
  "src/views/system/file/components/CategoryPieChart.vue": 1,
  "src/views/welcome/components/ChartRound.vue": 1,
  "src/views/welcome/components/ChartBar.vue": 1
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

/** 剥离注释：避免把文档/说明里的色值示例计入 */
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
  for (const pattern of PATTERNS) {
    for (const match of text.match(pattern) ?? []) {
      // `hsl(var(...))` / `rgb(var(...))` 是令牌消费，放行
      if (match.includes("var(")) continue;
      count += 1;
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
  `裸颜色值门禁：扫描 ${SCAN_DIR}，命中 ${rows.length} 个文件 / ${total} 处（基线 ${Object.keys(BASELINE).length} 个文件）。`
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
      `${rel}: ${count} 处（未登记的裸颜色值——改走 var(--el-*) / hsl(var(--语义槽)) / Tailwind 语义别名）`
    );
  } else if (count > allowed) {
    violations.push(`${rel}: ${count} 处（超过基线 ${allowed}，只减不增）`);
  }
}
const cleared = Object.keys(BASELINE).filter(
  rel => !rows.some(row => row.rel === rel)
);
if (cleared.length > 0) {
  console.log("以下文件已无裸颜色值，可从 BASELINE 移除：");
  for (const rel of cleared.sort()) console.log(`  ${rel}`);
}

if (violations.length > 0) {
  console.error(
    "\n裸颜色值门禁失败（颜色唯一来源为 tokens/ 语义槽与 EP 变量）："
  );
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}
console.log("裸颜色值门禁通过（基线均未增长）。");
