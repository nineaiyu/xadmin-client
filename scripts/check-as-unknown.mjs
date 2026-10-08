#!/usr/bin/env node
// `as unknown as` 双重断言基线门禁（类型逃逸防回潮）。
//
// `as unknown as T` 绕过编译器的双向类型检查，是比 `as T` 更彻底的逃逸 hatch：
// 数量随迭代自然漂移（layout 路由类型互转 tree.ts 是存量热点），
// 没有基线时无法区分「必要增量」与「随手逃逸」。本门禁按文件建立基线：
//
// - 新文件出现 `as unknown as` 即失败（禁止未登记新增）；
// - 已登记文件超过基线数即失败（只减不增）；
// - 数量降到 0 时提示移除基线条目。
//
// 用法：
//   node scripts/check-as-unknown.mjs            # 门禁（CI 用）
//   node scripts/check-as-unknown.mjs --report   # 仅报告分布，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const EXTENSIONS = new Set([".ts", ".tsx", ".vue"]);
const PATTERN = /\bas\s+unknown\s+as\b/g;

// 存量基线：相对路径 -> 基线出现次数（只减不增；降到 0 即可从此表移除）
// 2026-09-30：初始登记 109 处 / 70 文件（热点：menu normalize.spec 7、router/index 6、
// useMenuData 4——多为 element-plus 泛型组件与路由元数据互转的既有债务）
// 2026-10-01 ~ 10-07：经 O6 收口与各批滚动拆分净减至 81 处 / 58 文件。
// 2026-10-08：**全量清零**——81 处逐处重构（请求泛型管道补 retrieve/update/detail，
// 路由/菜单跨类型边界改用显式 toMenuNode 转换，localforage 签名如实声明 `T | null`，
// 测试替身改 Reflect 反射桥接与包装函数），基线清空。
// 此后任何 `as unknown as` 出现即门禁失败；新代码请用具体类型收窄、
// 显式转换函数或 Reflect 系列 API。
const BASELINE = {};

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      rows.push(...walk(full));
    } else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
      rows.push(full);
    }
  }
  return rows;
}

const rows = walk(join(ROOT, SCAN_DIR)).map(file => {
  const hits = readFileSync(file, "utf-8").match(PATTERN)?.length ?? 0;
  return { rel: relative(ROOT, file).split("\\").join("/"), hits };
});

const found = rows
  .filter(({ hits }) => hits > 0)
  .sort((a, b) => b.hits - a.hits);
const total = found.reduce((sum, { hits }) => sum + hits, 0);
console.log(
  `as-unknown-as 门禁：扫描 ${rows.length} 个源文件，共 ${total} 处 / ${found.length} 文件（基线 ${Object.keys(BASELINE).length} 文件）。`
);

if (process.argv.includes("--report")) {
  for (const { rel, hits } of found) {
    console.log(`  ${String(hits).padStart(3)} 处  ${rel}`);
  }
  process.exit(0);
}

const violations = [];
for (const { rel, hits } of found) {
  if (BASELINE[rel] === undefined) {
    violations.push(
      `${rel}: ${hits} 处（未登记的新增类型逃逸——请用具体类型收窄或登记基线并说明）`
    );
  } else if (hits > BASELINE[rel]) {
    violations.push(
      `${rel}: ${hits} 处（超过基线 ${BASELINE[rel]}，只减不增）`
    );
  }
}

const cleared = Object.keys(BASELINE).filter(rel => {
  const row = found.find(({ rel: r }) => r === rel);
  return !row || row.hits === 0;
});
if (cleared.length > 0) {
  console.log("以下文件已清零，可从 BASELINE 移除：");
  for (const rel of cleared.sort()) console.log(`  ${rel}`);
}

if (violations.length > 0) {
  console.error("\nas-unknown-as 门禁失败（未登记新增 / 存量禁止增长）：");
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}

console.log("as-unknown-as 门禁通过（基线均未增长）。");
