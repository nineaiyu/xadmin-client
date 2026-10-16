#!/usr/bin/env node
// 裸 px 字号门禁（只减不增）：禁止在样式与内联/JSX 里新增「裸 px 字号」。
//
// 口径：字号单一来源为 tokens/primitives.scss 的 `--font-size-*` 阶梯；
// 业务侧应消费 `var(--font-size-*)` 或既有 Tailwind 字号类，不得写死像素值——
// 写死会绕开「设置面板 → 字号档位」的全局缩放（`html[data-font]`）。
//
// 扫描面（src 下）：
//   - 样式声明：`font-size: 13px`（scss / css / vue 的 style 块、tsx 内的 CSS 串）
//   - 内联样式：`fontSize: "13px"`（对象 / JSX style）
//   - 任意值工具类：`text-[13px]`
// 豁免：src/style/tokens/**（令牌定义处）、src/assets/iconfont/**（三方生成物）、
//       *.spec.*（测试夹具），以及下方 BASELINE 登记的存量（按文件计数，只减不增）。
//
// 用法：
//   node scripts/check-font-size-literals.mjs            # 门禁（CI 用）
//   node scripts/check-font-size-literals.mjs --report   # 仅报告分布，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const EXCLUDE_DIRS = new Set(["node_modules", "__tests__"]);
const EXCLUDE_PATHS = [
  "src/style/tokens/", // 令牌定义处：字号阶梯的唯一来源
  "src/assets/iconfont/", // iconfont 生成物（第三方）
  "src/tests/" // 测试环境装配
];

/** 匹配一条裸 px 字号（三种形态，各自独立统计） */
const PATTERNS = [
  /font-size:\s*[0-9.]+px/g, // 样式声明
  /fontSize:\s*["'`][0-9.]+px/g, // 内联对象 / JSX style
  /text-\[[0-9.]+px\]/g // Tailwind 任意值
];

/**
 * 存量基线：相对路径 -> 裸 px 字号条数（只减不增；清零后从本表移除）。
 * 新增文件出现裸 px 字号即失败；存量文件超出登记数同样失败。
 *
 * 收尾说明：原登记 12 个文件 / 14 处的「阶梯外特殊尺寸」已全部并入令牌体系——
 * 微型辅助字（11px）入 `--font-size-2xs`；面板/抽屉标题（15px）对齐 `--font-size-base|md`；
 * 图标字符 / 表情 / 插画 / 大数字（21/26/32/34/48px）入 `--display-size-*` 展示型尺寸组
 * （tokens/primitives.scss）。基线已清零：任何新裸 px 字号都直接失败。
 */
const BASELINE = {};

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

function countLiterals(file) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (rel.includes(".spec.")) return { rel, count: 0 };
  if (EXCLUDE_PATHS.some(prefix => rel.startsWith(prefix))) {
    return { rel, count: 0 };
  }
  const text = readFileSync(file, "utf-8");
  let count = 0;
  for (const pattern of PATTERNS) {
    count += (text.match(pattern) ?? []).length;
  }
  return { rel, count };
}

const rows = walk(join(ROOT, SCAN_DIR))
  .map(countLiterals)
  .filter(row => row.count > 0)
  .sort((a, b) => b.count - a.count || a.rel.localeCompare(b.rel));

const total = rows.reduce((sum, row) => sum + row.count, 0);
console.log(
  `裸 px 字号门禁：扫描 ${SCAN_DIR}，命中 ${rows.length} 个文件 / ${total} 处（基线 ${Object.keys(BASELINE).length} 个文件）。`
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
      `${rel}: ${count} 处（未登记的裸 px 字号——改走 var(--font-size-*)）`
    );
  } else if (count > allowed) {
    violations.push(`${rel}: ${count} 处（超过基线 ${allowed}，只减不增）`);
  }
}
const cleared = Object.keys(BASELINE).filter(
  rel => !rows.some(row => row.rel === rel)
);
if (cleared.length > 0) {
  console.log("以下文件已无裸 px 字号，可从 BASELINE 移除：");
  for (const rel of cleared.sort()) console.log(`  ${rel}`);
}

if (violations.length > 0) {
  console.error(
    "\n裸 px 字号门禁失败（字号唯一来源为 tokens/primitives.scss 的 --font-size-*）："
  );
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}
console.log("裸 px 字号门禁通过（基线均未增长）。");
