#!/usr/bin/env node
/**
 * E2E 固定延时门禁：`waitForTimeout` 是盲等，快机器白等、慢机器照样挂，
 * 还会掩盖「信号未到」的真实原因。除时间域场景（动画帧、拖拽轨迹、负向观察窗）
 * 在 allowlist 中逐文件登记外，新增一处即失败。
 *
 * 用法：
 *   node scripts/check-e2e-waits.mjs
 *   node scripts/check-e2e-waits.mjs --update   # 按当前数量刷新基线（需人工补理由）
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const E2E_DIR = join(ROOT, "e2e");
const ALLOWLIST = join(E2E_DIR, "wait-for-timeout-allowlist.json");
const WAIT_RE = /\.waitForTimeout\s*\(/g;

function scan() {
  const counts = new Map();
  for (const name of readdirSync(E2E_DIR).sort()) {
    if (!name.endsWith(".e2e.ts")) continue;
    const rel = `e2e/${name}`;
    const text = readFileSync(join(E2E_DIR, name), "utf8");
    const lines = [];
    for (const [index, line] of text.split("\n").entries()) {
      WAIT_RE.lastIndex = 0;
      if (WAIT_RE.test(line)) lines.push(index + 1);
    }
    if (lines.length) counts.set(rel, lines);
  }
  return counts;
}

function loadAllowlist() {
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
    return new Map(Object.entries(raw));
  } catch (error) {
    console.error(`[e2e-waits] 无法读取 allowlist：${error.message}`);
    process.exit(2);
  }
}

function main() {
  const counts = scan();
  const allow = loadAllowlist();
  const errors = [];

  for (const [file, lines] of counts) {
    const entry = allow.get(file);
    if (!entry) {
      errors.push(
        `${file}: ${lines.length} 处 waitForTimeout 未登记（改用 expect.poll/toBeVisible）`
      );
      continue;
    }
    if (typeof entry.max !== "number" || !entry.reason) {
      errors.push(`${file}: allowlist 条目需要数字 max 与非空 reason`);
      continue;
    }
    if (lines.length > entry.max) {
      const added = lines.slice(entry.max);
      errors.push(
        `${file}: waitForTimeout 增长到 ${lines.length} 处（基线 ${entry.max}），新增行 ${added.join(", ")}`
      );
    }
  }

  for (const file of allow.keys()) {
    if (!counts.has(file)) {
      errors.push(`${file}: allowlist 条目已无 waitForTimeout，请删除该条`);
    }
  }

  if (process.argv.includes("--update")) {
    const next = {};
    for (const [file, lines] of counts) {
      next[file] = {
        max: lines.length,
        reason: allow.get(file)?.reason ?? "TODO: 补充时间域理由"
      };
    }
    writeFileSync(ALLOWLIST, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`[e2e-waits] 已更新基线：${Object.keys(next).length} 个文件`);
    return 0;
  }

  if (errors.length) {
    console.error("E2E 固定延时门禁失败：");
    for (const item of errors) console.error(`  - ${item}`);
    console.error(
      "修复：优先换 expect.poll / 自动重试断言；确属时间域场景登记到 e2e/wait-for-timeout-allowlist.json。"
    );
    return 1;
  }
  const total = [...counts.values()].reduce(
    (sum, lines) => sum + lines.length,
    0
  );
  console.log(
    `[e2e-waits] 通过：${counts.size} 个文件 / ${total} 处固定延时均为已登记的时间域例外。`
  );
  return 0;
}

process.exit(main());
