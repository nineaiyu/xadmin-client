#!/usr/bin/env node
// 裸 el-table 门禁：阻止「页面直接手写 <el-table>」继续扩散。
//
// 背景：手写表格缺少统一表头样式与可访问名（DataTable 封装了这两件事），
// 也让「列表页走元数据协议」的边界变模糊。已有用法登记在
// scripts/bare-tables-baseline.json（只减不增）：新增文件必须改走 DataTable /
// ReReadonlyTable / RePlusPage，或在该 JSON 登记并写明理由。
//
// 判定口径：模板里出现 `<el-table` 且后面不是 `-`（`el-table-column` 不算）。
// DataTable / ReReadonlyTable 两个封装本体天然直接使用 el-table，属豁免面。
//
// 用法：
//   node scripts/check-bare-tables.mjs            # 门禁（CI 用）
//   node scripts/check-bare-tables.mjs --report   # 只报告，恒不失败
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_DIR = path.join(ROOT, "src");
const REGISTRY = path.join(ROOT, "scripts", "bare-tables-baseline.json");
const BARE_TABLE = /<el-table(?![-A-Za-z0-9_])/g;

const reportOnly = process.argv.includes("--report");

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) rows.push(...walk(full));
    else if (entry.endsWith(".vue")) rows.push(full);
  }
  return rows;
}

const rel = file => path.relative(ROOT, file).split(path.sep).join("/");
const read = file => readFileSync(file, "utf-8");

const registry = JSON.parse(read(REGISTRY));
const violations = [];
const warnings = [];
const hits = [];

for (const file of walk(SRC_DIR)) {
  const key = rel(file);
  const count = (read(file).match(BARE_TABLE) ?? []).length;
  if (!count) continue;
  hits.push({ key, count, exempt: Object.hasOwn(registry, key) });
  if (Object.hasOwn(registry, key)) {
    if (!String(registry[key]).trim()) {
      violations.push(`${key}: 登记表中的豁免理由不能为空`);
    }
    continue;
  }
  violations.push(
    `${key}: 直接使用 <el-table> 未登记——改走 DataTable / ReReadonlyTable / ` +
      "RePlusPage，或登记 scripts/bare-tables-baseline.json（写明理由）"
  );
}

for (const key of Object.keys(registry)) {
  const file = path.join(ROOT, key);
  if (!existsSync(file)) {
    violations.push(`${key}: 登记项文件不存在（已迁移/改名？请清理登记表）`);
    continue;
  }
  if (!(read(file).match(BARE_TABLE) ?? []).length) {
    warnings.push(`${key}: 已不再直接使用 el-table，请从登记表移除`);
  }
}

console.log(
  `裸 el-table 门禁：扫描 src，命中文件 ${hits.length} 个（登记 ${Object.keys(registry).length} 个）。`
);

if (reportOnly) {
  for (const item of hits) {
    console.log(`  ${item.exempt ? "[登记]" : "[新增]"} ${item.key}`);
  }
  process.exit(0);
}

if (warnings.length) {
  console.log("提示（不失败）：");
  for (const item of warnings) console.log(`  - ${item}`);
}

if (violations.length) {
  console.error("\n裸 el-table 门禁失败：");
  for (const item of violations) console.error(`  - ${item}`);
  process.exit(1);
}

console.log("裸 el-table 门禁通过。");
