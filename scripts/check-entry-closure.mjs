#!/usr/bin/env node
// 首屏入口白名单门禁：src/main.ts 与 src/App.vue 的顶层静态导入必须逐条登记。
//
// 背景：main.ts / App.vue 是首屏闭包的根（index.html 的入口与 modulepreload 由此展开），
// 随手加一行静态 import 会把整条依赖链拖进首屏——check-bundle-size 的 15KB 预算拦不住
// 数 KB 级的悄然增量（历史例：chartTheme / useScrollLock 数 KB 级块进闭包无人察觉）。
// 本门禁把「谁能进首屏根」显式化为基线清单：
// - 新增条目 → 失败（确认依赖链必须进首屏后 --update 登记，并在提交说明中给出理由）；
// - 移除条目 → 通过（只减不增），并提示同步 --update 收敛基线。
//
// 口径：只统计顶层静态 import/export-from 与副作用 import（.vue 只取 <script> 块），
// 纯类型子句（import type / 全 type 命名导入）编译期擦除不计；动态 import() 不计。
//
// 用法：
//   node scripts/check-entry-closure.mjs            # 门禁（CI 用）
//   node scripts/check-entry-closure.mjs --report   # 仅报告当前清单
//   node scripts/check-entry-closure.mjs --update   # 写回基线
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASELINE_PATH = `${ROOT}scripts/entry-closure-baseline.json`;
const ENTRY_FILES = ["src/main.ts", "src/App.vue"];

/** 去掉块注释与整行注释，避免注释里的 import 被误判 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)([ \t]*)\/\/[^\n]*/g, "$1$2");
}

/** 提取待分析的脚本内容：.vue 只取 <script> 块，其余取全文 */
function extractScript(file, raw) {
  if (!file.endsWith(".vue")) return raw;
  const blocks = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(raw)) !== null) blocks.push(m[1]);
  return blocks.join("\n");
}

/** 判断 import/export 子句是否纯类型（编译期擦除） */
function isTypeOnlyClause(clause) {
  const c = clause.trim();
  if (/^type\b/.test(c)) return true;
  const braces = c.match(/\{([\s\S]*)\}/);
  if (!braces) return false;
  const parts = braces[1]
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every(p => /^type\b/.test(p));
}

const STATEMENT_RE =
  /(?:^|\n)[ \t]*(import|export)\s+([A-Za-z0-9_$*{},\s]*?)\s*from\s*["']([^"']+)["']/g;
const SIDE_EFFECT_RE = /(?:^|\n)[ \t]*import\s*["']([^"']+)["']/g;

function collectSpecifiers(rel) {
  const raw = readFileSync(`${ROOT}${rel}`, "utf-8");
  const code = stripComments(extractScript(rel, raw));
  const specs = new Set();
  let m;
  STATEMENT_RE.lastIndex = 0;
  while ((m = STATEMENT_RE.exec(code)) !== null) {
    if (isTypeOnlyClause(m[2])) continue;
    specs.add(m[3]);
  }
  SIDE_EFFECT_RE.lastIndex = 0;
  while ((m = SIDE_EFFECT_RE.exec(code)) !== null) specs.add(m[1]);
  return [...specs].sort();
}

const current = {};
for (const rel of ENTRY_FILES) current[rel] = collectSpecifiers(rel);

const total = Object.values(current).reduce((n, list) => n + list.length, 0);
console.log(
  `首屏入口白名单：${ENTRY_FILES.join(" + ")} 共 ${total} 条顶层静态导入。`
);

if (process.argv.includes("--report")) {
  for (const [rel, list] of Object.entries(current)) {
    console.log(`  ${rel}（${list.length} 条）：`);
    for (const spec of list) console.log(`    ${spec}`);
  }
  process.exit(0);
}

if (process.argv.includes("--update")) {
  const payload = {
    note: "首屏入口（src/main.ts / src/App.vue）顶层静态导入白名单。新增条目必须确认其依赖链应进首屏闭包（否则改动态 import()）；--update 登记并在提交说明中给出理由。",
    ...current
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`已写回基线：scripts/entry-closure-baseline.json`);
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  console.error(
    "基线不存在：运行 node scripts/check-entry-closure.mjs --update 生成。"
  );
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));

const violations = [];
const removable = [];
for (const rel of ENTRY_FILES) {
  const base = new Set(baseline[rel] ?? []);
  const now = new Set(current[rel]);
  for (const spec of now) {
    if (!base.has(spec)) violations.push(`${rel}: 新增 "${spec}"`);
  }
  for (const spec of base) {
    if (!now.has(spec)) removable.push(`${rel}: "${spec}"`);
  }
}

if (removable.length > 0) {
  console.log("以下条目已移除（只减不增，可 --update 收敛基线）：");
  for (const item of removable) console.log(`  ${item}`);
}

if (violations.length > 0) {
  console.error("\n首屏入口白名单校验失败（新增未登记）：");
  for (const item of violations) console.error(`  ${item}`);
  console.error(
    "确认依赖链必须进首屏闭包后运行 --update 登记；否则改用动态 import()。"
  );
  process.exit(1);
}
console.log("首屏入口白名单通过（无未登记新增）。");
