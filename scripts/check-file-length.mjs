#!/usr/bin/env node
// 源码文件行数门禁（防巨型文件回潮）。
//
// 口径：
// - 扫描 src/ 下的源码文件（.ts / .tsx / .vue / .js）；
// - 单文件超过阈值（500 行）即视为巨型文件；
// - 纯数据文件（如图标数据集）在 EXEMPT 中显式豁免并注明原因。
//
// 存量处理：
// - 当前已超阈值的文件登记在 BASELINE 并记录基线行数；
// - 基线文件只允许缩小、不允许继续增长（超过登记值即失败）；
// - 未登记的新增超阈值文件直接失败。
//
// 用法：
//   node scripts/check-file-length.mjs            # 门禁（CI 用）
//   node scripts/check-file-length.mjs --report   # 仅报告分布，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const EXTENSIONS = new Set([".ts", ".tsx", ".vue", ".js"]);
const THRESHOLD = 500;

// 数据文件豁免（不计入源码行数口径）
const EXEMPT = {
  "src/components/ReIcon/data.ts": "图标数据集（数据文件）"
};

// 存量基线：相对路径 -> 基线行数（只减不增；降到阈值内即可从此表移除）
// 2026-09-17：存量巨型文件已全部拆分清零（历史 4 处 → 0），保留空表以承接未来回归
const BASELINE = {};

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      rows.push(...walk(full));
    } else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
      rows.push(full);
    }
  }
  return rows;
}

function countLines(file) {
  const parts = readFileSync(file, "utf-8").split(/\r\n|\n|\r/);
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts.length;
}

const sources = walk(join(ROOT, SCAN_DIR));
const rows = sources.map(file => ({
  rel: relative(ROOT, file).split("\\").join("/"),
  lines: countLines(file)
}));

const oversized = rows
  .filter(row => !EXEMPT[row.rel] && row.lines > THRESHOLD)
  .sort((a, b) => b.lines - a.lines);

console.log(
  `文件行数门禁：扫描 ${rows.length} 个源文件，阈值 ${THRESHOLD} 行，超阈值 ${oversized.length} 个（豁免 ${Object.keys(EXEMPT).length} 个数据文件）。`
);
for (const { rel, lines } of oversized) {
  let flag = "";
  if (BASELINE[rel] !== undefined) {
    const delta = lines - BASELINE[rel];
    const note =
      delta > 0 ? `超基线 +${delta}` : delta < 0 ? `降 ${-delta}` : "维持";
    flag = `（存量基线 ${BASELINE[rel]}，${note}）`;
  }
  console.log(`  ${String(lines).padStart(5)} 行  ${rel}${flag}`);
}

if (process.argv.includes("--report")) {
  process.exit(0);
}

const violations = [];
for (const { rel, lines } of oversized) {
  if (BASELINE[rel] === undefined) {
    violations.push(`${rel}: ${lines} 行（未登记的新增巨型文件）`);
  } else if (lines > BASELINE[rel]) {
    violations.push(
      `${rel}: ${lines} 行（超过存量基线 ${BASELINE[rel]}，只减不增）`
    );
  }
}

const stopped = oversized
  .filter(({ rel, lines }) => BASELINE[rel] !== undefined && lines <= THRESHOLD)
  .map(({ rel }) => rel);
if (stopped.length > 0) {
  console.log("以下文件已降到阈值内，可从 BASELINE 移除：");
  for (const rel of stopped.sort()) console.log(`  ${rel}`);
}

if (violations.length > 0) {
  console.error(
    "\n巨型文件门禁失败（禁止新增 / 存量禁止增长；确需保留请拆分或更新基线说明）："
  );
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}

console.log(
  `巨型文件门禁通过（存量基线 ${Object.keys(BASELINE).length} 项，均未增长）。`
);
