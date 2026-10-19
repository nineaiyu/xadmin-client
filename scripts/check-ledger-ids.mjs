#!/usr/bin/env node
// 台账编号门禁：禁止 ADR-xxx / 任务编号进入源码、测试与配置。
//
// 口径（与 AGENTS.md「任务编号不进版本库」一致）：
//   - 源码注释 / 测试名 / 基线 JSON 说明字段里不写台账编号；
//   - 台账编号只允许出现在提交信息、docs/ 以及本脚本实现中；
//   - 禁止形态：ADR-090、T03-01、O10-2、TG-3 一类。
//
// 用法：
//   node scripts/check-ledger-ids.mjs            # 门禁（CI 用）
//   node scripts/check-ledger-ids.mjs --report   # 仅报告，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const SCAN_DIRS = ["src", "e2e", "scripts", "tests"];
const SCAN_ROOT_FILES = [
  "renovate.json",
  "package.json",
  "vite.config.ts",
  "playwright.config.ts"
];
const SCAN_SUFFIXES = [
  ".ts",
  ".tsx",
  ".vue",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".scss",
  ".css",
  ".yml",
  ".yaml"
];
const EXCLUDE_DIRS = new Set([
  "node_modules",
  "dist",
  "test-results",
  "playwright-report",
  "__snapshots__"
]);

// 文档类文件允许引用 ADR（是说明，不是台账标记）
const EXEMPT_FILES = new Set([
  "scripts/check-ledger-ids.mjs",
  "CHANGELOG.md",
  "CONTRIBUTING.md"
]);

const PATTERNS = [
  /ADR-\d+/,
  /\bT\d{2,}-\d{2,}\b/,
  /\bO\d{1,2}-\d+\b/,
  /\bTG-\d+\b/
];

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      rows.push(...walk(full));
    } else if (SCAN_SUFFIXES.some(suffix => entry.endsWith(suffix))) {
      rows.push(full);
    }
  }
  return rows;
}

const files = [];
for (const dir of SCAN_DIRS) {
  try {
    files.push(...walk(join(ROOT, dir)));
  } catch {
    // 目录不存在时跳过（不同分支的目录集合可能不同）
  }
}
for (const name of SCAN_ROOT_FILES) {
  try {
    const full = join(ROOT, name);
    if (statSync(full).isFile()) files.push(full);
  } catch {
    // 根文件不存在时跳过
  }
}

const violations = [];
for (const file of files) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (EXEMPT_FILES.has(rel) || rel.endsWith(".md")) continue;
  const lines = readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, index) => {
    const match = PATTERNS.map(pattern => pattern.exec(line)).find(Boolean);
    if (match)
      violations.push({
        rel,
        line: index + 1,
        token: match[0],
        text: line.trim().slice(0, 120)
      });
  });
}

console.log(
  `台账编号门禁：扫描 ${files.length} 个文件，命中 ${violations.length} 处。`
);

if (process.argv.includes("--report")) {
  for (const { rel, line, token, text } of violations)
    console.log(`  ${rel}:${line} ${token} | ${text}`);
  process.exit(0);
}

if (violations.length > 0) {
  console.error(
    "\n台账编号门禁失败（编号只允许出现在提交信息与 docs/ 台账本体）："
  );
  for (const { rel, line, token, text } of violations) {
    console.error(`  ${rel}:${line} ${token} | ${text}`);
  }
  process.exit(1);
}
console.log("台账编号门禁通过。");
