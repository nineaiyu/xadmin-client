#!/usr/bin/env node
// 手写表单门禁：阻止「后端有元数据、前端却整套手写表单」的页面继续扩散。
//
// 背景：列表页已统一走 RePlusPage + 元数据协议，但表单维度存在两套并行契约——
// 框架元数据表单（addOrEditOptions 微调）与手写 XxxForm.vue + getPayload()。
// 两套契约都没有「何时用哪条路」的判定，新人照旧写法会持续产出
// 「后端下发字段、前端却手写 20 个 el-form-item」的页面。
//
// 本门禁做三件事（判定口径见 docs/architecture/component-handbook.md
// 「表单选型判定」）：
// 1. 模块制：同模块存在 RePlusPage 页面时，`el-form-item` 手写表单必须显式豁免；
// 2. 体量制：单文件 `el-form-item` 超过阈值（12）必须显式豁免——
//    超过该体量通常意味着「整套模型字段被手写」，而非少量页面专属输入；
// 3. 登记表对账：scripts/handwritten-forms-exempt.json 的每个登记项都必须存在
//    且附非空理由；文件已删除/改名的登记项直接失败（防豁免腐烂）。
//
// 豁免两种写法（二选一）：
// - 登记表登记（推荐，理由集中可审）；
// - 文件头标记 `<!-- @form-exempt: 理由 -->`（就近豁免，适合一次性/实验性表单）。
//
// 用法：
//   node scripts/check-handwritten-forms.mjs            # 门禁（CI 用）
//   node scripts/check-handwritten-forms.mjs --report   # 只报告，恒不失败
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VIEW_DIR = path.join(ROOT, "src", "views");
const REGISTRY = path.join(ROOT, "scripts", "handwritten-forms-exempt.json");

/** 单文件 el-form-item 数量阈值：超过即视为整套表单手写 */
const MAX_FORM_ITEMS = 12;
/** 就地豁免标记：`<!-- @form-exempt: 理由 -->`（理由不可为空） */
const MARKER = /<!--\s*@form-exempt:\s*([\s\S]*?)-->/;
/** RePlusPage 页面判定（模板使用；仅 import 工具函数不算页面） */
const REPLUS_PAGE = /<RePlusPage\b/;

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
const countFormItems = source =>
  (source.match(/<el-form-item\b/g) ?? []).length;

/** 就近模块页面：向上找到第一个含 RePlusPage 页面的目录 */
function replusModuleOf(file) {
  let dir = path.dirname(file);
  const stop = path.dirname(VIEW_DIR);
  while (dir.startsWith(VIEW_DIR) && dir !== stop) {
    const page = path.join(dir, "index.vue");
    if (existsSync(page) && REPLUS_PAGE.test(read(page))) return rel(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const registry = JSON.parse(read(REGISTRY));
const registryKeys = new Set(Object.keys(registry));
const violations = [];
const warnings = [];
const flagged = [];
let totalWithForm = 0;

for (const file of walk(VIEW_DIR)) {
  const source = read(file);
  const count = countFormItems(source);
  if (!count) continue;
  totalWithForm += 1;
  const key = rel(file);
  const moduleDir = replusModuleOf(file);
  const reason = registry[key];
  const marker = MARKER.exec(source);

  if (marker && !marker[1].trim()) {
    violations.push(`${key}: @form-exempt 标记的理由不能为空`);
    continue;
  }
  if (reason !== undefined && !String(reason).trim()) {
    violations.push(`${key}: 登记表中的豁免理由不能为空`);
    continue;
  }
  if (!moduleDir && count <= MAX_FORM_ITEMS) continue;

  flagged.push({ key, count, moduleDir, exempt: Boolean(reason || marker) });
  if (reason || marker) continue;
  violations.push(
    `${key}: 手写表单未登记豁免（${count} 个 el-form-item` +
      `${moduleDir ? `，同目录 ${moduleDir} 为 RePlusPage 页面` : ""}）——` +
      "改走元数据表单（addOrEditOptions）或登记 scripts/handwritten-forms-exempt.json"
  );
}

// 登记表对账：文件必须存在且仍是手写表单
for (const key of registryKeys) {
  const file = path.join(ROOT, key);
  if (!existsSync(file)) {
    violations.push(`${key}: 登记项文件不存在（已迁移/改名？请清理登记表）`);
    continue;
  }
  if (!countFormItems(read(file))) {
    warnings.push(`${key}: 登记项已不含 el-form-item，可清理登记`);
  }
}

const exemptCount = flagged.filter(item => item.exempt).length;
console.log(
  `手写表单门禁：扫描 src/views，含 el-form-item 的文件 ${totalWithForm} 个，` +
    `命中规则（同模块 RePlusPage 或超过 ${MAX_FORM_ITEMS} 项）${flagged.length} 个，` +
    `其中豁免 ${exemptCount} 个（登记表 ${Object.keys(registry).length} 项），` +
    `未豁免 ${violations.length} 个。`
);

if (reportOnly) {
  for (const item of flagged) {
    const scope = item.moduleDir
      ? `RePlusPage 模块 ${item.moduleDir}`
      : "非模块页";
    console.log(
      `  ${item.exempt ? "[豁免]" : "[命中]"} ${String(item.count).padStart(2)} 项  ` +
        `${item.key}（${scope}）`
    );
  }
  process.exit(0);
}

if (warnings.length) {
  console.log("提示（不失败）：");
  for (const item of warnings) console.log(`  - ${item}`);
}

if (violations.length) {
  console.error(
    "\n手写表单门禁失败（新增/改动手写表单须显式豁免并写明理由；选型口径见 " +
      "docs/architecture/component-handbook.md「表单选型判定」）："
  );
  for (const item of violations) console.error(`  - ${item}`);
  process.exit(1);
}

console.log("手写表单门禁通过。");
