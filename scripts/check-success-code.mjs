#!/usr/bin/env node
// 业务码判定散点门禁：`code === SUCCESS_CODE` 式比较按文件基线只减不增。
//
// 背景：业务码成功判定的统一入口是 `isSuccess()`（src/api/types.ts，成功码变更时
// 只需改一处），但存量仍在调用点直接写 `code === SUCCESS_CODE` 字面量
// （2026-10-13 盘点：300 处 / 168 文件，isSuccess 零引用）。本门禁冻结存量：
// - 新文件出现字面量比较即失败（禁止未登记新增）；
// - 已登记文件超过基线数即失败（只减不增）；
// - 迁移到 isSuccess 后可 --update 收敛（计数降到 0 自动移出基线）。
//
// 口径：匹配「判定位置」的 `code ===|!==|==|!= SUCCESS_CODE`（含 `SUCCESS_CODE === res.code`
// 反序写法）；import 语句、常量定义（`SUCCESS_CODE = 1000`）、期望值比较
// （`toBe(SUCCESS_CODE)`）不计。注释已剔除；.vue 只取 <script> 块。
//
// 用法：
//   node scripts/check-success-code.mjs            # 门禁（CI 用）
//   node scripts/check-success-code.mjs --report   # 仅报告分布，恒不失败
//   node scripts/check-success-code.mjs --update   # 收敛基线（迁移后）
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const BASELINE_PATH = join(ROOT, "scripts/success-code-baseline.json");
const EXTENSIONS = new Set([".ts", ".tsx", ".vue"]);

const COMPARE_RE =
  /\bcode\s*[!=]==?\s*SUCCESS_CODE\b|\bSUCCESS_CODE\s*[!=]==?\s*[\w$?.]*\bcode\b/g;

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      rows.push(...walk(full));
    } else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
      rows.push(full);
    }
  }
  return rows;
}

/** 去掉块注释与整行注释，避免注释里的比较被误判 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)([ \t]*)\/\/[^\n]*/g, "$1$2");
}

/** .vue 只取 <script> 块，其余取全文 */
function extractScript(file, raw) {
  if (!file.endsWith(".vue")) return raw;
  const blocks = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(raw)) !== null) blocks.push(m[1]);
  return blocks.join("\n");
}

const rows = walk(join(ROOT, SCAN_DIR)).map(file => {
  const raw = readFileSync(file, "utf-8");
  const code = stripComments(extractScript(file, raw));
  const hits = code.match(COMPARE_RE)?.length ?? 0;
  return { rel: relative(ROOT, file).split("\\").join("/"), hits };
});

const found = rows.filter(({ hits }) => hits > 0);
const totalHits = found.reduce((n, { hits }) => n + hits, 0);
console.log(
  `业务码字面量门禁：扫描 ${rows.length} 个源文件，${totalHits} 处 / ${found.length} 个文件存在 code 比较字面量。`
);

if (process.argv.includes("--report")) {
  for (const { rel, hits } of found.sort((a, b) => b.hits - a.hits)) {
    console.log(`  ${String(hits).padStart(3)}  ${rel}`);
  }
  process.exit(0);
}

if (process.argv.includes("--update")) {
  const payload = {
    note: "业务码判定散点基线（文件 -> `code === SUCCESS_CODE` 式比较计数，只减不增）。迁移到 isSuccess() 后 --update 收敛；计数降为 0 的文件自动移出。",
    baseline: Object.fromEntries(found.map(({ rel, hits }) => [rel, hits]))
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `已写回基线：scripts/success-code-baseline.json（${found.length} 文件）`
  );
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")).baseline;

const violations = [];
for (const { rel, hits } of found) {
  if (baseline[rel] === undefined) {
    violations.push(`${rel}: ${hits} 处（未登记新增——请改用 isSuccess()）`);
  } else if (hits > baseline[rel]) {
    violations.push(
      `${rel}: ${hits} 处（超过基线 ${baseline[rel]}，只减不增——新增请改用 isSuccess()）`
    );
  }
}
const cleared = Object.keys(baseline).filter(
  rel => !found.some(({ rel: r }) => r === rel)
);
if (cleared.length > 0) {
  console.log("以下文件已清零，可 --update 收敛基线：");
  for (const rel of cleared.sort()) console.log(`  ${rel}`);
}

if (violations.length > 0) {
  console.error("\n业务码字面量门禁失败（未登记新增 / 存量禁止增长）：");
  for (const item of violations) console.error(`  ${item}`);
  console.error('统一入口：import { isSuccess } from "@/api/types"。');
  process.exit(1);
}
console.log("业务码字面量门禁通过（基线均未增长）。");
