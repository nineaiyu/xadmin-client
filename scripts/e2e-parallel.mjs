#!/usr/bin/env node
/**
 * 并行跑全量 E2E：把测试按文件 shard 切成 E2E_PARALLEL 份，每份由独立进程执行，
 * 并为每个 shard 分配独立后端端口 + 独立前端端口 + 独立 PG 库
 * （E2E_DB_NAME），彻底隔离共享状态，避免并发时用例互相抢数据产生 flaky。
 *
 * 用法：
 *   pnpm test:e2e:parallel              # 默认 4 路，跑 chromium + webkit 全量
 *   E2E_PARALLEL=8 pnpm test:e2e:parallel
 *   E2E_PARALLEL=1 pnpm test:e2e:parallel        # 退化为原串行全量
 *   pnpm test:e2e:parallel --project=chromium     # 额外参数透传给 playwright
 *
 * 环境变量：
 *   E2E_PARALLEL      并发路数（默认 4）
 *   E2E_API_PORT      后端起始端口（默认 18896，第 i 路使用 +i*2）
 *   E2E_FRONT_PORT    前端起始端口（默认 8848，第 i 路使用 +i*2）
 *   E2E_STUB_LLM_PORT 桩 LLM 起始端口（默认 18897，第 i 路使用 +i*2，避开偶数段的后端端口）
 *   E2E_NO_KILL=1     跳过启动前清理端口（CI 全新无残留，或自行管理端口）
 */
import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const total = Number(process.env.E2E_PARALLEL ?? "4");
if (!Number.isInteger(total) || total < 1) {
  console.error(
    `[e2e-parallel] E2E_PARALLEL 非法: ${process.env.E2E_PARALLEL}`
  );
  process.exit(2);
}

const baseApi = Number(process.env.E2E_API_PORT ?? "18896");
const baseFront = Number(process.env.E2E_FRONT_PORT ?? "8848");
// 桩 LLM 端口必须按路分配：webServer 会真的 bind 该端口，共用会让后起的 shard
// 直接 EADDRINUSE 退出（表现为「随机 shard 启动即失败」）。步长取 2 与后端同段错开
const baseStub = Number(process.env.E2E_STUB_LLM_PORT ?? "18897");
const extra = process.argv.slice(2);

// 隔离清单排除（由 scripts/e2e-run.mjs 下发）：主线跑批跳过已知抖动用例
const grepInvert = process.env.E2E_GREP_INVERT;
// JSON 上报（CI 全量档）：每个 shard 输出到独立目录 + 独立文件名，避免并行互相覆盖；
// 榜单解析见 scripts/e2e-flaky-report.mjs
const jsonReport = process.env.E2E_JSON_REPORT === "1";
const jsonReportDir = process.env.E2E_JSON_REPORT_DIR ?? "e2e-reports";

// 启动前清理本次并行将独占的端口：上一次串行/并行 e2e 若有残留 daphne/vite，
// webServer 的 reuseExistingServer=false 探活会命中旧进程直接报 "already used"。
function freePort(port) {
  try {
    execSync(`lsof -ti :${port} | xargs kill 2>/dev/null || true`, {
      stdio: "ignore"
    });
  } catch {
    // lsof 不存在 / 端口空闲均忽略
  }
}
if (process.env.E2E_NO_KILL !== "1") {
  for (let i = 0; i < total; i++) {
    freePort(baseApi + i * 2);
    freePort(baseFront + i * 2);
    freePort(baseStub + i * 2);
  }
  await new Promise(r => setTimeout(r, 500)); // 等杀掉的进程释放端口
}

/**
 * 时长预算：跑批总时长相对同环境基线只允许 +20%（`E2E_BUDGET_RATIO` 可覆盖）。
 * 基线按「平台-CI + 分片数」分组（时长随机器/分片数变化，跨环境不可比）；
 * 首次在某环境运行即记录基线（`e2e/duration-budget.json`），子集运行（透传参数）
 * 不参与比对。
 */
const BUDGET_FILE = fileURLToPath(
  new URL("../e2e/duration-budget.json", import.meta.url)
);
const BUDGET_RATIO = Number(process.env.E2E_BUDGET_RATIO ?? "1.2");
// 预算键 = 平台-CI-运行范围：时长随环境与用例范围变化，跨键不可比；
// smoke 子集与全量分别记录，避免「拿 smoke 基线卡全量」的错配。
const RUN_SCOPE = process.env.E2E_SMOKE ? "smoke" : "full";
const ENV_KEY = `${process.platform}-${process.env.CI ? "ci" : "local"}-${RUN_SCOPE}`;

function checkDurationBudget(seconds) {
  if (extra.length > 0) {
    console.log("[e2e-budget] 子集运行（透传参数），跳过时长预算比对");
    return;
  }
  let data = {};
  if (existsSync(BUDGET_FILE)) {
    try {
      data = JSON.parse(readFileSync(BUDGET_FILE, "utf-8"));
    } catch {
      data = {};
    }
  }
  const key = String(total);
  const entry = data[ENV_KEY]?.[key];
  if (process.env.E2E_BUDGET_UPDATE === "1" || !entry) {
    data[ENV_KEY] = {
      ...(data[ENV_KEY] ?? {}),
      [key]: {
        seconds: Math.round(seconds),
        recorded_at: new Date().toISOString()
      }
    };
    writeFileSync(BUDGET_FILE, `${JSON.stringify(data, null, 2)}\n`);
    console.log(
      `[e2e-budget] 基线已记录：env=${ENV_KEY} shards=${key} seconds=${Math.round(seconds)}`
    );
    return;
  }
  const budgetSeconds = entry.seconds * BUDGET_RATIO;
  const line =
    `[e2e-budget] 本次 ${Math.round(seconds)}s / 基线 ${entry.seconds}s` +
    `（上限 +${Math.round((BUDGET_RATIO - 1) * 100)}% = ${Math.round(budgetSeconds)}s）`;
  if (seconds > budgetSeconds) {
    console.error(`${line} —— 超出时长预算（刷新基线：E2E_BUDGET_UPDATE=1）`);
    process.exitCode = 1;
  } else {
    console.log(`${line} ✓`);
  }
}

/**
 * 时长均衡分片：Playwright 的 `--shard` 按「用例条数」均分，而 spec 之间的耗时差
 * 可达一个数量级（layout-preferences 一个文件占全量 16%），实测三片负载
 * 3406 / 4058 / 4115s —— 最慢的一片决定跑批总时长。
 *
 * 权重表（e2e/shard-weights.json，由 scripts/e2e-weights.mjs 从上次全量报告生成）
 * 存在时改为「按文件权重做 LPT 贪心装箱」，每片直接跑自己的文件列表；
 * 缺失/为空或 E2E_SHARD_MODE=count 时回落到原生 `--shard`。
 */
const WEIGHTS_FILE = fileURLToPath(
  new URL("../e2e/shard-weights.json", import.meta.url)
);
const SPEC_DIR = fileURLToPath(new URL("../e2e", import.meta.url));

function loadWeights() {
  if (process.env.E2E_SHARD_MODE === "count") return undefined;
  if (!existsSync(WEIGHTS_FILE)) return undefined;
  try {
    const files = JSON.parse(readFileSync(WEIGHTS_FILE, "utf-8"))?.files;
    return files && Object.keys(files).length ? files : undefined;
  } catch (error) {
    console.warn(
      `[e2e-parallel] 权重表解析失败，回落条数分片：${error.message}`
    );
    return undefined;
  }
}

/** 权重表按最后一次全量跑批生成，新增文件（无权重）按中位数估算，避免被当 0 跳过 */
function partitionByWeight(files, weights, shards) {
  const measured = files
    .map(file => weights[file])
    .filter(value => typeof value === "number" && value > 0)
    .sort((a, b) => a - b);
  const median = measured.length
    ? measured[Math.floor(measured.length / 2)]
    : 30;
  const items = files
    .map(file => ({
      file,
      weight: typeof weights[file] === "number" ? weights[file] : median
    }))
    .sort((a, b) => b.weight - a.weight);
  const groups = Array.from({ length: shards }, () => ({
    files: [],
    weight: 0
  }));
  for (const item of items) {
    const lightest = groups.reduce(
      (min, group) => (group.weight < min.weight ? group : min),
      groups[0]
    );
    lightest.files.push(item.file);
    lightest.weight += item.weight;
  }
  return groups;
}

const weights = loadWeights();
const specFiles = readdirSync(SPEC_DIR)
  .filter(name => name.endsWith(".e2e.ts") && !name.startsWith("_"))
  .sort();
const shardGroups = weights
  ? partitionByWeight(specFiles, weights, total)
  : undefined;
if (shardGroups) {
  console.log(
    `[e2e-parallel] 时长均衡分片（权重表 ${specFiles.length} 个文件）：` +
      shardGroups
        .map((group, i) => `#${i + 1}≈${Math.round(group.weight)}s`)
        .join(" / ")
  );
}

// 只打印分片计划（不启动服务/浏览器）：用于核对权重表与新增加的文件落在哪一片
if (process.env.E2E_PLAN_ONLY === "1") {
  shardGroups?.forEach((group, i) => {
    console.log(
      `[e2e-plan] shard ${i + 1}/${total} ≈${Math.round(group.weight)}s (${group.files.length} 文件)：${group.files.join(" ")}`
    );
  });
  if (!shardGroups) {
    console.log("[e2e-plan] 无权重表，将使用 Playwright 原生 --shard 分片");
  }
  process.exit(0);
}

const startedAt = Date.now();
const jobs = Array.from({ length: total }, (_, i) => {
  const env = {
    ...process.env,
    E2E_API_PORT: String(baseApi + i * 2),
    // 分片跑批 = 高负载档：helpers 的 HIGH_LOAD（test.slow / 放宽下载超时）据此生效。
    // 不注入时子进程读不到 E2E_PARALLEL，并行下会沿用严格上限（历史表现为随机 shard 超时失败）
    E2E_PARALLEL: String(total),
    E2E_FRONT_PORT: String(baseFront + i * 2),
    // 桩 LLM：端口按路分配，并让用例指向本路的桩（ai-action 读 E2E_STUB_LLM_URL）
    E2E_STUB_LLM_PORT: String(baseStub + i * 2),
    E2E_STUB_LLM_URL: `http://127.0.0.1:${baseStub + i * 2}/v1`,
    E2E_DB_NAME: `xadmin_e2e_shard${i}`,
    // JSON 上报：按 shard 分配独立输出目录 + 文件名（json reporter 读
    // PLAYWRIGHT_JSON_OUTPUT_DIR / PLAYWRIGHT_JSON_OUTPUT_NAME 环境变量）
    ...(jsonReport
      ? {
          PLAYWRIGHT_JSON_OUTPUT_DIR: jsonReportDir,
          PLAYWRIGHT_JSON_OUTPUT_NAME: `shard-${i}.json`
        }
      : {})
  };
  const group = shardGroups?.[i];
  const args = [
    "exec",
    "playwright",
    "test",
    // 有权重表：显式文件清单（均衡分片）；否则回落 Playwright 原生按条数分片
    ...(group
      ? group.files.map(file => `e2e/${file}`)
      : [`--shard=${i + 1}/${total}`]),
    // 每个 shard 独立产物目录：共用 ./test-results 时各 shard 启动阶段会并发清理/写入
    // 同一目录，互相踩到就整片退出（表现为随机 shard "启动即失败"，Node 安全删除 shim
    // 下更是直接抛 FSMoveObjectToTrashSync 错误）
    `--output=test-results-shard-${i}`,
    "--workers=1",
    ...(grepInvert ? ["--grep-invert", grepInvert] : []),
    ...extra
  ];
  return new Promise(resolve => {
    const shardStartedAt = Date.now();
    const child = spawn("pnpm", args, { stdio: "inherit", env });
    child.on("close", code =>
      resolve({
        code: code ?? 1,
        seconds: (Date.now() - shardStartedAt) / 1000
      })
    );
  });
});

const results = await Promise.all(jobs);
const totalSeconds = (Date.now() - startedAt) / 1000;

// run 结束后兜底清理本并行段端口：playwright 偶发不会回收 webServer（残留 daphne/vite），
// 留到下次会撞 reuseExistingServer=false 的 "already used"，故对称清理一次
if (process.env.E2E_NO_KILL !== "1") {
  for (let i = 0; i < total; i++) {
    freePort(baseApi + i * 2);
    freePort(baseFront + i * 2);
    freePort(baseStub + i * 2);
  }
}

results.forEach((result, i) =>
  console.log(
    `[e2e-parallel] shard ${i + 1}/${total} 用时 ${result.seconds.toFixed(1)}s（exit=${result.code}）`
  )
);
console.log(
  `[e2e-parallel] 总用时 ${totalSeconds.toFixed(1)}s（env=${ENV_KEY}, shards=${total}）`
);

const failed = results.filter(result => result.code !== 0);
if (failed.length > 0) {
  console.error(`[e2e-parallel] ${failed.length}/${total} 个 shard 失败`);
  process.exit(1);
}

checkDurationBudget(totalSeconds);
