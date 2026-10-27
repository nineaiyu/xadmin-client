#!/usr/bin/env node
// 声明式弹层门禁：阻止「页面直接手写 <el-dialog> / <el-drawer>」继续扩散。
//
// 背景：addDialog / addDrawer 基于 ReDialog / ReDrawer（overlay 内核统一滚动锁、
// 页脚与尺寸）；常驻面板类声明式弹层统一走 OverlayDialog / OverlayDrawer
// （同一 overlay 内核的声明式壳）。页面内联 EP 弹层会另起一套滚动/尺寸行为，
// 且同一页面可能混用两条弹层路径。已有用法登记在
// scripts/declarative-overlays-baseline.json（只减不增）；新增文件必须改走上述
// 内核入口，或在登记表写明保留理由。
//
// 判定口径：模板里出现 `<el-dialog` / `<el-drawer`（后面不是 `-` 或标识符）。
// ReDialog / ReDrawer / OverlayDialog / OverlayDrawer 等封装本体天然直接使用 EP
// 组件，登记为豁免面。
//
// 用法：
//   node scripts/check-declarative-overlays.mjs            # 门禁（CI 用）
//   node scripts/check-declarative-overlays.mjs --report   # 只报告，恒不失败
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_DIR = path.join(ROOT, "src");
const REGISTRY = path.join(
  ROOT,
  "scripts",
  "declarative-overlays-baseline.json"
);
// 覆盖模板字面量、PascalCase 组件与 h(ElDialog) 渲染函数三种形态
const OVERLAY =
  /(?:<el-(?:dialog|drawer)(?![-A-Za-z0-9_])|<El(?:Dialog|Drawer)(?![\w])|\bh\(\s*El(?:Dialog|Drawer)\b)/g;
const SOURCE_EXT = new Set([".vue", ".tsx", ".jsx"]);

const reportOnly = process.argv.includes("--report");

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) rows.push(...walk(full));
    else if (SOURCE_EXT.has(path.extname(entry))) rows.push(full);
  }
  return rows;
}

const rel = file => path.relative(ROOT, file).split(path.sep).join("/");
const read = file => readFileSync(file, "utf-8");
/** 注释里的同形字符串不算违规（避免文档示例触发误报） */
const stripComments = source =>
  source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const registry = JSON.parse(read(REGISTRY)).files;
const violations = [];
const warnings = [];
const hits = [];

for (const file of walk(SRC_DIR)) {
  const key = rel(file);
  const count = (stripComments(read(file)).match(OVERLAY) ?? []).length;
  if (!count) continue;
  hits.push({ key, count, exempt: Object.hasOwn(registry, key) });
  const entry = registry[key];
  if (!entry) {
    violations.push(
      `${key}: 直接使用 <el-dialog> / <el-drawer> 未登记——一次性弹层改走 addDialog / addDrawer，` +
        "常驻面板改走 OverlayDialog / OverlayDrawer，或登记 scripts/declarative-overlays-baseline.json（写明保留理由）"
    );
    continue;
  }
  if (!String(entry.reason ?? "").trim()) {
    violations.push(`${key}: 登记表中的保留理由不能为空`);
    continue;
  }
  if (count > Number(entry.count ?? 0)) {
    violations.push(
      `${key}: 内联弹层 ${count} 处，超过登记基线 ${entry.count} 处（只减不增——一次性弹层请走 addDialog / addDrawer，常驻面板请走 OverlayDialog / OverlayDrawer）`
    );
  } else if (count < Number(entry.count ?? 0)) {
    warnings.push(`${key}: 内联弹层已降至 ${count} 处，请下调登记基线`);
  }
}

for (const [key, entry] of Object.entries(registry)) {
  const file = path.join(ROOT, key);
  if (!existsSync(file)) {
    violations.push(`${key}: 登记项文件不存在（已迁移/改名？请清理登记表）`);
    continue;
  }
  if (!(read(file).match(OVERLAY) ?? []).length) {
    warnings.push(`${key}: 已不再内联弹层，请从登记表移除`);
  }
  if (!String(entry.reason ?? "").trim()) {
    violations.push(`${key}: 登记表中的保留理由不能为空`);
  }
}

console.log(
  `声明式弹层门禁：扫描 src，命中文件 ${hits.length} 个（登记 ${Object.keys(registry).length} 个）。`
);

if (reportOnly) {
  for (const item of hits) {
    console.log(
      `  ${item.exempt ? "[登记]" : "[新增]"} ${item.key} (${item.count})`
    );
  }
  process.exit(0);
}

if (warnings.length) {
  console.log("提示（不失败）：");
  for (const item of warnings) console.log(`  - ${item}`);
}

if (violations.length) {
  console.error("\n声明式弹层门禁失败：");
  for (const item of violations) console.error(`  - ${item}`);
  process.exit(1);
}

console.log("声明式弹层门禁通过。");
