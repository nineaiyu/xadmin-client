#!/usr/bin/env node
/**
 * E2E 抖动榜单：解析 Playwright JSON 报告（可多份 shard），按「spec × project」聚合
 * 通过 / 抖动（重试后通过）/ 失败 / 跳过 / 重试次数，输出 markdown 榜单（供 CI step
 * summary 与人工阅读）与结构化 JSON（供 artifact 与历史轨道）。
 *
 * 「抖动」判定直接取 Playwright 自身的 test.status：
 *   expected  = 一次性通过
 *   flaky     = 至少失败一次、重试后通过（真抖动）
 *   unexpected= 重试后仍失败
 *   skipped   = 跳过（不计入抖动率分母）
 * 一次性通过率 = passed / (passed + flaky + failed)（跳过不计入）。
 *
 * 用法：
 *   node scripts/e2e-flaky-report.mjs --input-dir e2e-reports \
 *     [--out e2e-reports/flaky-<run>.json] [--run <id>] [--top 10] \
 *     [--summary-file "$GITHUB_STEP_SUMMARY"] [--history e2e/flaky-history.jsonl]
 *   node scripts/e2e-flaky-report.mjs --help
 *
 * - 未指定 --input 时扫描 --input-dir 下全部 *.json（跳过 flaky-*.json 自身）；
 * - --summary-file 未指定时落到 $GITHUB_STEP_SUMMARY（无则该文件时打印到 stdout）；
 * - --history 追加一行 JSONL 历史；无任何报告数据时静默跳过（不写空记录）。
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  appendFileSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const HELP = `E2E 抖动榜单解析器

选项：
  --input-dir <dir>     报告目录（默认 e2e-reports）
  --input <file>       显式报告文件，可重复；指定后忽略 --input-dir 扫描
  --out <file>         榜单 JSON 输出路径（默认 e2e-reports/flaky-<run>.json）
  --run <id>           本次运行标识（默认 $GITHUB_RUN_ID 或 local-<时间戳>）
  --top <n>            榜单条数上限（默认 10）
  --summary-file <f>   markdown 榜单写入文件（默认 $GITHUB_STEP_SUMMARY，再退化为 stdout）
  --history <f>        JSONL 历史轨道文件（追加；无数据时静默跳过）
  --help               打印本帮助`;

function parseArgs(argv) {
  const opts = {
    inputDir: "e2e-reports",
    inputs: [],
    out: null,
    run: process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`,
    top: 10,
    summary: null,
    history: null
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) {
        console.error(`[flaky-report] 选项 ${arg} 缺少参数`);
        process.exit(2);
      }
      return value;
    };
    switch (arg) {
      case "--help":
      case "-h":
        console.log(HELP);
        process.exit(0);
        break;
      case "--input-dir":
        opts.inputDir = next();
        break;
      case "--input":
        opts.inputs.push(next());
        break;
      case "--out":
        opts.out = next();
        break;
      case "--run":
        opts.run = next();
        break;
      case "--top":
        opts.top = Number(next());
        break;
      case "--summary-file":
        opts.summary = next();
        break;
      case "--history":
        opts.history = next();
        break;
      default:
        console.error(`[flaky-report] 未知选项：${arg}（--help 查看用法）`);
        process.exit(2);
    }
  }
  return opts;
}

/** 递归收集报告中的 spec（不同项目合并后同一文件套件下会带多条 tests）。 */
function collectSpecs(report) {
  const specs = [];
  const walk = suites => {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) specs.push(spec);
      if (suite.suites) walk(suite.suites);
    }
  };
  walk(report.suites);
  return specs;
}

/** 校验是否像一份 Playwright JSON 报告（避免把无关 json 当报告解析）。 */
function looksLikeReport(data) {
  return (
    data !== null &&
    typeof data === "object" &&
    (Array.isArray(data.suites) || typeof data.stats === "object")
  );
}

function loadReports(opts) {
  const files = opts.inputs.length
    ? opts.inputs
    : (existsSync(opts.inputDir) ? readdirSync(opts.inputDir) : [])
        .filter(name => name.endsWith(".json"))
        .filter(name => !name.startsWith("flaky-"))
        .map(name => join(opts.inputDir, name));

  const reports = [];
  for (const file of files) {
    if (!existsSync(file)) {
      console.error(`[flaky-report] 报告不存在，跳过：${file}`);
      continue;
    }
    try {
      const data = JSON.parse(readFileSync(file, "utf-8"));
      if (!looksLikeReport(data)) {
        console.error(`[flaky-report] 非 Playwright 报告，跳过：${file}`);
        continue;
      }
      reports.push({ file: resolve(file), data });
    } catch (error) {
      console.error(
        `[flaky-report] 解析失败，跳过：${file}（${error.message}）`
      );
    }
  }
  return reports;
}

/** 归并多份报告：key = file::title::project。 */
function aggregate(reports) {
  const map = new Map();
  for (const { data } of reports) {
    for (const spec of collectSpecs(data)) {
      const file = spec.file ?? "";
      for (const test of spec.tests ?? []) {
        const project = test.projectName ?? "";
        const key = `${file}::${spec.title}::${project}`;
        let entry = map.get(key);
        if (!entry) {
          entry = {
            file,
            title: spec.title ?? "",
            project,
            passed: 0,
            flaky: 0,
            failed: 0,
            skipped: 0,
            retried: 0,
            maxRetry: 0,
            duration: 0,
            runs: 0
          };
          map.set(key, entry);
        }
        entry.runs += 1;
        if (test.status === "expected") entry.passed += 1;
        else if (test.status === "flaky") entry.flaky += 1;
        else if (test.status === "skipped") entry.skipped += 1;
        else entry.failed += 1;

        const results = test.results ?? [];
        entry.retried += results.filter(r => (r.retry ?? 0) > 0).length;
        for (const r of results)
          entry.maxRetry = Math.max(entry.maxRetry, r.retry ?? 0);
        const last = results[results.length - 1];
        entry.duration += last?.duration ?? 0;
      }
    }
  }

  const entries = [...map.values()].map(entry => {
    const effective = entry.passed + entry.flaky + entry.failed;
    return {
      ...entry,
      effective,
      flakinessRate: effective ? entry.flaky / effective : 0
    };
  });
  // 抖动优先、其次有效失败、最后按 key 稳定排序（保证榜单可复现）
  entries.sort(
    (a, b) =>
      b.flaky - a.flaky ||
      b.failed - a.failed ||
      a.file.localeCompare(b.file) ||
      a.title.localeCompare(b.title) ||
      a.project.localeCompare(b.project)
  );

  const totals = entries.reduce(
    (acc, e) => {
      acc.passed += e.passed;
      acc.flaky += e.flaky;
      acc.failed += e.failed;
      acc.skipped += e.skipped;
      acc.retried += e.retried;
      return acc;
    },
    { passed: 0, flaky: 0, failed: 0, skipped: 0, retried: 0 }
  );
  const effective = totals.passed + totals.flaky + totals.failed;
  totals.effective = effective;
  totals.executions =
    totals.passed + totals.flaky + totals.failed + totals.skipped;
  totals.distinct = entries.length;
  totals.oneShotPassRate = effective ? totals.passed / effective : 1;

  return { entries, totals };
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function markdown(report, top) {
  const lines = [];
  lines.push(`## E2E 抖动榜单（run ${report.run}）`);
  lines.push("");
  lines.push(`- 报告输入：${report.inputs.length} 份`);
  lines.push(
    `- 用例：${report.totals.distinct} 个（按 spec × project 计）/ 执行 ${report.totals.executions} 次`
  );
  lines.push(
    `- 结果：通过 ${report.totals.passed} / 抖动 ${report.totals.flaky} / 失败 ${report.totals.failed} / 跳过 ${report.totals.skipped}`
  );
  lines.push(
    `- 一次性通过率：**${pct(report.totals.oneShotPassRate)}**（口径：通过 /（通过 + 抖动 + 失败））`
  );
  lines.push("");

  const flaky = report.entries.filter(e => e.flaky > 0).slice(0, report.top);
  if (flaky.length === 0) {
    lines.push("本次无抖动用例。");
  } else {
    lines.push(`### Top ${flaky.length} 抖动用例`);
    lines.push("");
    lines.push("| 用例 | 项目 | 执行 | 通过 | 抖动 | 失败 | 抖动率 |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const e of flaky)
      lines.push(
        `| ${e.title}（${e.file}） | ${e.project || "-"} | ${e.runs} | ${e.passed} | ${e.flaky} | ${e.failed} | ${pct(e.flakinessRate)} |`
      );
    lines.push("");
  }

  const failed = report.entries.filter(e => e.failed > 0);
  if (failed.length > 0) {
    lines.push(`### 稳定失败用例（${failed.length}）`);
    lines.push("");
    lines.push("| 用例 | 项目 | 失败 |");
    lines.push("| --- | --- | --- |");
    for (const e of failed.slice(0, report.top))
      lines.push(
        `| ${e.title}（${e.file}） | ${e.project || "-"} | ${e.failed} |`
      );
    lines.push("");
  }

  lines.push(
    "> 聚类口径：抖动 = 重试后通过；同一条目下 `chromium`/`webkit` 分别统计，" +
      "仅单浏览器抖动通常指向浏览器差异或共享库状态残留，双浏览器同抖更可能是时序或环境。"
  );
  return lines.join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const reports = loadReports(opts);
  const { entries, totals } = aggregate(reports);

  const generatedAt = new Date().toISOString();
  const report = {
    run: opts.run,
    generated_at: generatedAt,
    inputs: reports.map(r => r.file),
    top: opts.top,
    totals,
    entries,
    top_flaky: entries.filter(e => e.flaky > 0).slice(0, opts.top)
  };

  const outFile = opts.out ?? join(opts.inputDir, `flaky-${opts.run}.json`);
  mkdirSync(dirname(resolve(outFile)), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

  const md = markdown(report, opts.top);
  const summaryFile = opts.summary ?? process.env.GITHUB_STEP_SUMMARY ?? "";
  if (summaryFile) {
    mkdirSync(dirname(resolve(summaryFile)), { recursive: true });
    appendFileSync(summaryFile, `\n${md}\n`);
  } else {
    console.log(md);
  }

  // 历史轨道：无任何报告数据时静默跳过（不写空记录）
  if (opts.history && reports.length > 0) {
    const line = JSON.stringify({
      run: opts.run,
      at: generatedAt,
      totals,
      top_flaky: report.top_flaky.map(e => ({
        file: e.file,
        title: e.title,
        project: e.project,
        flaky: e.flaky
      }))
    });
    if (!existsSync(opts.history))
      mkdirSync(dirname(resolve(opts.history)), { recursive: true });
    appendFileSync(opts.history, `${line}\n`);
  }

  console.log(
    `[flaky-report] 输入 ${reports.length} 份 / 用例 ${totals.distinct} / ` +
      `抖动 ${totals.flaky} / 失败 ${totals.failed} / 一次性通过率 ${pct(totals.oneShotPassRate)} → ${outFile}`
  );
}

main();
