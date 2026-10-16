#!/usr/bin/env node
/**
 * 生成分片权重表（e2e/shard-weights.json）供 e2e-parallel.mjs 做时长均衡分片。
 *
 * 输入：Playwright JSON 报告目录（默认 e2e-reports/，文件名 shard-*.json；
 * CI 全量档每个 shard 输出一份，`PLAYWRIGHT_JSON_OUTPUT_NAME=shard-<i>.json`）。
 * 输出：{ generated_at, source, files: { "<spec 文件>": <秒> } }，按文件累计各浏览器
 * 的最后一次尝试耗时（重试不计入，避免把抖动放大成权重）。
 *
 * 用法：
 *   node scripts/e2e-weights.mjs                      # 默认 e2e-reports → e2e/shard-weights.json
 *   node scripts/e2e-weights.mjs --input-dir /tmp/x --output e2e/shard-weights.json
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { inputDir: "e2e-reports", output: "e2e/shard-weights.json" };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--input-dir") opts.inputDir = args[i + 1];
    else if (args[i] === "--output") opts.output = args[i + 1];
  }
  return opts;
}

const { inputDir, output } = parseArgs();
const inputPath = resolve(inputDir);
if (!existsSync(inputPath)) {
  console.error(`[e2e-weights] 报告目录不存在：${inputPath}`);
  process.exit(2);
}

const files = {};
let shardCount = 0;
for (const name of readdirSync(inputPath).sort()) {
  if (!name.startsWith("shard-") || !name.endsWith(".json")) continue;
  shardCount += 1;
  const report = JSON.parse(readFileSync(resolve(inputPath, name), "utf-8"));
  const walk = suites => {
    for (const suite of suites ?? []) {
      const file = suite.file ?? "";
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          const last = test.results?.[test.results.length - 1];
          if (!last || !file) continue;
          // skipped 用例（如未开启 E2E_VISUAL 的视觉档）不计入权重
          if (last.status === "skipped") continue;
          files[file] = (files[file] ?? 0) + (last.duration ?? 0) / 1000;
        }
      }
      walk(suite.suites);
    }
  };
  walk(report.suites);
}

if (!shardCount || Object.keys(files).length === 0) {
  console.error("[e2e-weights] 未从报告解析到用例耗时，权重表未生成");
  process.exit(1);
}

const payload = {
  $comment:
    "E2E 分片时长权重（秒/文件，最后一次尝试口径）。由 scripts/e2e-weights.mjs 从一次全量跑批的 JSON 报告生成；新增大文件或明显改动用例结构后请重跑生成，避免分片失衡。",
  generated_at: new Date().toISOString(),
  source: inputDir,
  shards_observed: shardCount,
  files: Object.fromEntries(
    Object.entries(files)
      .map(([key, value]) => [key, Math.round(value * 10) / 10])
      .sort((a, b) => b[1] - a[1])
  )
};

writeFileSync(resolve(output), `${JSON.stringify(payload, null, 2)}\n`);
const total = Object.values(files).reduce((sum, value) => sum + value, 0);
console.log(
  `[e2e-weights] 已写入 ${output}：${Object.keys(files).length} 个文件，合计 ${Math.round(total)}s`
);
