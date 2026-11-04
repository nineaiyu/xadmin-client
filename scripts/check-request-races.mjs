#!/usr/bin/env node
// 请求竞态门禁（审查根因治理：搜索/长列表链路必须接序号守卫）。
//
// 背景：列表页主框架已有标准竞态防护（RePlusPage 的 latestRequestSeq，「仅接受
// 最新一次请求的响应」；网络乱序时旧响应覆盖新结果是偶发且难排查的行为错误），
// 但历史上多次出现「新消费点未接入」的全局搜索、审批人候选、群成员搜索、
// 选人筛选等漏网点——防抖只能降低并发窗口，不消除乱序。可复用范式：
//   - 单槽位（一个搜索框/一个候选缓存）：utils/requestSeq 的 createRequestSeqGuard
//     —— start() 取序号，响应回来 isLatest(ticket) 不通过即丢弃，loading 也
//     只由最新一次收口；
//   - 多槽位（同页多个字段各自远程搜索，如 Record<fieldKey, options>）：
//     createKeyedRequestSeqGuard——按字段键隔离，A 字段的新请求不作废 B 字段
//     的在途响应；
//   - 取消型链路也可用 AbortController（本门禁同样认）。
//
// 静态可检出面（启发式，两条规则）：
//   A. el-select 的 :remote-method 绑定（远程搜索入口的强信号）；
//   B. useDebounceFn/useDebounce/debounce 防抖 + 本文件存在 @/api 值导入
//      （type-only 导入不计），二者叠加视为「防抖请求链路」。
// 命中任一规则的文件必须给出守卫证据：createRequestSeqGuard /
// createKeyedRequestSeqGuard / isLatest( / AbortController，或文件内序号计数器
// （++xxxSeq 形态，存量口径；新代码一律走 requestSeq 工具）；守卫在别的文件
// （委托给 hook/父组件）时，须留「竞态守卫：」或「race-guard:」注释指明位置。
// 不在检出面的形态（如即时逐键远程搜索未走 remote-method/防抖、纯本地过滤）
// 属评审范围，静态不可判——评审时按脚本头「可复用范式」核对。
//
// 自测样例（曾以故意违规验证拦截，见 docs/audit/2026-11-03-frontend-gap-closure.md）：
//   :remote-method="search" + 文件内无任何守卫证据 → 拦截
//   useDebounceFn(load) + import { api } from "@/api/..." + 无守卫 → 拦截
//
// 用法：
//   node scripts/check-request-races.mjs            # 门禁（CI 用）
//   node scripts/check-request-races.mjs --report   # 仅报告命中面，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const EXCLUDE_DIRS = new Set(["node_modules", "__tests__"]);

const REMOTE_METHOD = /:remote-method\s*=/;
const DEBOUNCE = /useDebounceFn\s*\(|useDebounce\b|\bdebounce\s*\(/;
/** @/api 值导入（import type {...} from "@/api/…" 不计入） */
const API_VALUE_IMPORT = /^import\s+(?!type\b)[^;]*?from\s+"@\/api\//m;
/** 守卫证据：共享工具 / AbortController / 文件内序号计数器（存量口径） */
const GUARD_EVIDENCE =
  /createRequestSeqGuard|createKeyedRequestSeqGuard|isLatest\s*\(|AbortController|\+\+\s*\w*[sS]eq\b/;
/** 守卫在别处的显式指路注释 */
const GUARD_MARKER = /(?:竞态守卫|race-guard)\s*[:：]/;

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      rows.push(...walk(full));
    } else if (/\.(vue|ts|tsx)$/.test(entry)) {
      rows.push(full);
    }
  }
  return rows;
}

function checkFile(file) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (rel.includes(".spec.")) return null;
  const text = readFileSync(file, "utf-8");
  const rules = [];
  if (REMOTE_METHOD.test(text)) rules.push("remote-method");
  if (DEBOUNCE.test(text) && API_VALUE_IMPORT.test(text))
    rules.push("防抖+API 值导入");
  if (rules.length === 0) return null;
  if (GUARD_EVIDENCE.test(text) || GUARD_MARKER.test(text)) return null;
  return { rel, rules };
}

const rows = walk(join(ROOT, SCAN_DIR)).map(checkFile).filter(Boolean);

console.log(
  `请求竞态门禁：扫描 ${SCAN_DIR}，remote-method 绑定 / 防抖 API 链路共 ${rows.length} 个文件缺守卫证据。`
);

if (process.argv.includes("--report")) {
  for (const { rel, rules } of rows)
    console.log(`  ${rel}（${rules.join(" + ")}）`);
  process.exit(0);
}

if (rows.length > 0) {
  console.error(
    "\n请求竞态门禁失败（守卫范式见脚本头注释：单槽位 createRequestSeqGuard /" +
      " 多槽位 createKeyedRequestSeqGuard / AbortController；委托场景留「竞态守卫：」注释指路）："
  );
  for (const { rel, rules } of rows) {
    console.error(`  ${rel}（${rules.join(" + ")}）`);
  }
  process.exit(1);
}
console.log("请求竞态门禁通过（搜索/防抖链路均有序号守卫或显式指路）。");
