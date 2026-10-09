#!/usr/bin/env node
// hook 超长门禁（≥120 行的 hook 形态文件禁止新增、存量只减不增）。
//
// 口径：`src` 下文件名形如 `useXxx.ts` / `useXxx.tsx` / `hook.tsx`（排除 `.spec.`、
// `__tests__`、`.d.ts`）。行数 ≥ 120 计入。行数门禁（check-file-length 的 500 行）
// 管不到该区间，此前存量从 45 增长到 80+，本门禁用于防回潮 + 存量逐步下沉。
//
// 用法：
//   node scripts/check-hook-length.mjs            # 门禁（CI 用）
//   node scripts/check-hook-length.mjs --report   # 仅报告分布，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const THRESHOLD = 120;
const HOOK_PATTERN = /^(use[A-Z].*|hook)\.(ts|tsx)$/;

// 存量基线：相对路径 -> 行数（只减不增；拆到 <120 即从此表移除）。
// 2026-10-08：初始登记（此前 R3 滚动债余量 45 个后又自然增长，门禁首次覆盖 120 线）。
// 2026-10-09：集成域 11 个（ai 4 / knowledge 3 / api-app / subscription / login / login-policy）拆分下线。
// 2026-10-09：系统域 / 布局与框架 / 表单域 / 仪表盘数据集全部拆分下线，基线清零
//             （即当前口径为零容忍：任何 ≥120 行的 hook 形态文件都会失败）。
const BASELINE = {};

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      rows.push(...walk(full));
    } else if (HOOK_PATTERN.test(entry) && !entry.includes(".spec.")) {
      rows.push(full);
    }
  }
  return rows;
}

const rows = walk(join(ROOT, SCAN_DIR)).map(file => {
  const rel = relative(ROOT, file).split("\\").join("/");
  // 行数与 `wc -l` / 逐行读取口径一致：末尾换行不额外计行
  const content = readFileSync(file, "utf-8");
  const lines = content.replace(/\n$/, "").split("\n").length;
  return { rel, lines };
});

const found = rows
  .filter(({ lines }) => lines >= THRESHOLD)
  .sort((a, b) => b.lines - a.lines);
console.log(
  `hook 超长门禁：扫描 ${rows.length} 个 hook 文件，≥${THRESHOLD} 行 ${found.length} 个（基线 ${Object.keys(BASELINE).length} 个）。`
);

if (process.argv.includes("--report")) {
  for (const { rel, lines } of found) {
    console.log(`  ${String(lines).padStart(4)}  ${rel}`);
  }
  process.exit(0);
}

const violations = [];
for (const { rel, lines } of found) {
  if (BASELINE[rel] === undefined) {
    violations.push(
      `${rel}: ${lines} 行（未登记的超长 hook 新增——请拆分或登记基线）`
    );
  } else if (lines > BASELINE[rel]) {
    violations.push(
      `${rel}: ${lines} 行（超过基线 ${BASELINE[rel]}，只减不增）`
    );
  }
}
const cleared = Object.keys(BASELINE).filter(
  rel => !found.some(({ rel: r }) => r === rel)
);
if (cleared.length > 0) {
  console.log("以下文件已降到阈值内，可从 BASELINE 移除：");
  for (const rel of cleared.sort()) console.log(`  ${rel}`);
}

if (violations.length > 0) {
  console.error("\nhook 超长门禁失败（未登记新增 / 存量禁止增长）：");
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}
console.log("hook 超长门禁通过（基线均未增长）。");
