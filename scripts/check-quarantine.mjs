#!/usr/bin/env node
/**
 * 隔离清单（quarantine）到期与字段校验：清单是「临时收容已知抖动」的账本，
 * 必须保证每条都有责任人、可追踪、且在到期日后被强制复核——否则隔离会无限期
 * 沉淀成「永久跳过」。
 *
 * 校验项（任一不满足即 exit 1）：
 *   - 条目为对象，且 spec / title / owner 为非空字符串；
 *   - project 字段存在（字符串；空串=两个浏览器都适用）；
 *   - reason 属于四分类：时序 | 数据 | 环境 | 外部依赖；
 *   - issue 字段存在（可为空字符串；外部依赖类必须非空）；
 *   - expires 为合法 ISO 日期（YYYY-MM-DD）且不早于今天（过期即失败）。
 *
 * 用法：
 *   node scripts/check-quarantine.mjs [--file e2e/quarantine.json] [--help]
 *   node scripts/check-quarantine.mjs --count              # 只打印条目数（供 workflow 判定）
 *   node scripts/check-quarantine.mjs --hint <report.json> # 依据抖动榜单给出移出提示
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const HELP = `隔离清单校验器

选项：
  --file <path>      清单路径（默认 e2e/quarantine.json）
  --count            只打印隔离条目数后退出（用于 workflow 判定是否单跑）
  --hint <report>    读取抖动榜单 JSON，提示哪些条目已可移出清单（不阻断）
  --help             打印本帮助`;

const REASONS = new Set(["时序", "数据", "环境", "外部依赖"]);

function parseArgs(argv) {
  const opts = { file: "e2e/quarantine.json", count: false, hint: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
    }
    if (arg === "--count") {
      opts.count = true;
    } else if (arg === "--file" || arg === "--hint") {
      const value = argv[++i];
      if (value === undefined) {
        console.error(`[quarantine] ${arg} 缺少参数`);
        process.exit(2);
      }
      if (arg === "--file") opts.file = value;
      else opts.hint = value;
    } else {
      console.error(`[quarantine] 未知选项：${arg}（--help 查看用法）`);
      process.exit(2);
    }
  }
  return opts;
}

function readManifest(file) {
  const path = resolve(file);
  if (!existsSync(path)) {
    console.error(`[quarantine] 清单不存在：${path}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    console.error(`[quarantine] 清单解析失败：${path}（${error.message}）`);
    process.exit(1);
  }
}

/** 依据抖动榜单报告：全绿提示可移出，否则列出仍有抖动/失败的条目。 */
function printHint(reportFile) {
  const path = resolve(reportFile);
  if (!existsSync(path)) {
    console.log(
      "[quarantine] 无榜单报告（跑批可能未产出），无法判定可移出条目。"
    );
    return;
  }
  let report;
  try {
    report = JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    console.log(`[quarantine] 榜单报告解析失败：${error.message}`);
    return;
  }
  const entries = Array.isArray(report.entries) ? report.entries : [];
  const unstable = entries.filter(
    e => (e.flaky ?? 0) > 0 || (e.failed ?? 0) > 0
  );
  if (entries.length > 0 && unstable.length === 0) {
    console.log(
      "✅ 隔离用例本次全部通过：可将对应条目从 e2e/quarantine.json 移出（复核后关闭追踪 issue）。"
    );
    return;
  }
  console.log(`⚠️ 仍有 ${unstable.length} 个隔离条目抖动或失败，暂不可移出：`);
  for (const e of unstable)
    console.log(
      `  - ${e.title}（${e.file}，${e.project || "-"}）：抖动 ${e.flaky ?? 0} / 失败 ${e.failed ?? 0}`
    );
}

/** 接受「空数组」或「{ tests: [...] }」两种顶层形态。 */
function extractEntries(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.tests)) return data.tests;
  return null;
}

function parseDay(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayUtc() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.count) {
    const countData = extractEntries(readManifest(opts.file));
    console.log(countData ? String(countData.length) : "0");
    return;
  }
  if (opts.hint) {
    printHint(opts.hint);
    return;
  }

  const file = resolve(opts.file);
  const entries = extractEntries(readManifest(opts.file));
  if (entries === null) {
    console.error(
      `[quarantine] 清单顶层必须是数组，或含 tests 数组的对象：${file}`
    );
    process.exit(1);
  }

  const today = todayUtc();
  const errors = [];
  entries.forEach((entry, index) => {
    const at = `条目 #${index + 1}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${at}：不是对象`);
      return;
    }
    if (typeof entry.spec !== "string" || !entry.spec.trim())
      errors.push(`${at}：缺少 spec`);
    if (typeof entry.title !== "string" || !entry.title.trim())
      errors.push(`${at}：缺少 title`);
    if (typeof entry.project !== "string")
      errors.push(`${at}：缺少 project 字段（可为空字符串）`);
    if (!REASONS.has(entry.reason))
      errors.push(
        `${at}：reason 非法（${JSON.stringify(entry.reason)}），须为 时序|数据|环境|外部依赖`
      );
    if (typeof entry.owner !== "string" || !entry.owner.trim())
      errors.push(`${at}：缺少 owner`);
    if (typeof entry.issue !== "string")
      errors.push(`${at}：缺少 issue 字段（可为空字符串）`);
    if (
      entry.reason === "外部依赖" &&
      typeof entry.issue === "string" &&
      !entry.issue.trim()
    )
      errors.push(`${at}：外部依赖类必须填写 issue`);

    const expires = parseDay(entry.expires);
    if (!expires) {
      errors.push(
        `${at}：expires 非法（${JSON.stringify(entry.expires)}），须为 YYYY-MM-DD`
      );
    } else if (expires < today) {
      errors.push(
        `${at}：已过期（expires=${entry.expires}）——请复核后移出清单或更新到期日`
      );
    }
  });

  if (errors.length > 0) {
    console.error(`[quarantine] 校验失败（${errors.length} 项）：`);
    for (const message of errors) console.error(`  - ${message}`);
    process.exit(1);
  }

  console.log(`[quarantine] 校验通过：${entries.length} 条隔离条目（${file}）`);
}

main();
