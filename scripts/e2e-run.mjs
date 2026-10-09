#!/usr/bin/env node
/**
 * E2E 统一入口：把 package.json 的 test:e2e* 脚本收敛到一处，集中处理
 *   1) 端口/环境注入（与既有脚本行为一致：E2E_API_PORT=18896、smoke/visual/perf/csp 档等）；
 *   2) 隔离清单（e2e/quarantine.json）→ 主线跑批自动追加 `--grep-invert`，把已知抖动
 *      用例挡在主线外，避免其失败把真回归淹没；
 *   3) 单跑隔离用例（mode=quarantine）→ 用 `--grep` 只跑清单内用例，供夜间复核。
 *
 * 用法：
 *   node scripts/e2e-run.mjs <mode> [-- playwright 透传参数...]
 *   node scripts/e2e-run.mjs --dry-run <mode>     # 只打印解析后的命令/环境，不执行
 *   node scripts/e2e-run.mjs quarantine           # 只跑清单内用例
 *
 * mode 见下方 MODES 表；首个非选项参数即 mode，缺省为 run。
 * 透传参数（含 e2e/xxx.e2e.ts 位置参数、--project=chromium 等）原样转发给 playwright。
 * 清单路径可用 E2E_QUARANTINE_FILE 覆盖（默认 e2e/quarantine.json）。
 */
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const QUARANTINE_FILE = "e2e/quarantine.json";

/** 与既有 package.json 脚本逐一对齐的运行档（保持行为兼容）。 */
const MODES = {
  run: { env: { E2E_API_PORT: "18896" } },
  smoke: { env: { E2E_API_PORT: "18896", E2E_SMOKE: "1" } },
  fresh: { kill: [18896, 18897, 8848], env: { E2E_API_PORT: "18896" } },
  "smoke:fresh": {
    kill: [18896, 18897, 8848],
    env: { E2E_API_PORT: "18896", E2E_SMOKE: "1" }
  },
  visual: {
    env: { E2E_VISUAL: "1", E2E_API_PORT: "18896" },
    files: ["e2e/visual.e2e.ts"]
  },
  "visual:update": {
    env: { E2E_VISUAL: "1", E2E_API_PORT: "18896" },
    files: ["e2e/visual.e2e.ts"],
    args: ["--update-snapshots"]
  },
  perf: {
    env: { E2E_PERF: "1", E2E_API_PORT: "18896" },
    files: ["e2e/perf.e2e.ts"],
    args: ["--project=chromium"]
  },
  "perf:update": {
    env: { E2E_PERF: "1", E2E_PERF_UPDATE: "1", E2E_API_PORT: "18896" },
    files: ["e2e/perf.e2e.ts"],
    args: ["--project=chromium"]
  },
  csp: {
    build: true,
    kill: [18899],
    env: { E2E_CSP: "1", E2E_CSP_TLS: "1", E2E_API_PORT: "18896" },
    files: ["e2e/csp-page.e2e.ts"]
  },
  quarantine: { grep: "include", env: { E2E_API_PORT: "18896" } },
  parallel: { parallel: true }
};

/** 读取隔离清单；容忍「数组」与「{ tests: [...] }」两种顶层形态与损坏文件。 */
function readQuarantine(file = QUARANTINE_FILE) {
  const path = resolve(file);
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    const entries = Array.isArray(data) ? data : data?.tests;
    if (!Array.isArray(entries)) return [];
    return entries.filter(
      e => e && typeof e.title === "string" && e.title.trim()
    );
  } catch (error) {
    console.warn(`[e2e-run] 隔离清单解析失败，按空清单处理：${error.message}`);
    return [];
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildGrep(entries) {
  return entries.map(e => escapeRegExp(e.title.trim())).join("|");
}

function freePort(port) {
  try {
    execSync(`lsof -ti :${port} | xargs kill 2>/dev/null || true`, {
      stdio: "ignore"
    });
  } catch {
    // lsof 缺失 / 端口空闲均忽略
  }
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { mode: "run", passthrough: [], dryRun: false };
  // 显式解析：首个非选项且命中 MODES 的参数作为 mode，其余透传
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (opts.mode === "run" && !arg.startsWith("-") && arg in MODES)
      opts.mode = arg;
    else opts.passthrough.push(arg);
  }

  const mode = MODES[opts.mode];
  if (!mode) {
    console.error(
      `[e2e-run] 未知 mode：${opts.mode}（可用：${Object.keys(MODES).join(", ")}）`
    );
    process.exit(2);
  }

  const entries = readQuarantine(process.env.E2E_QUARANTINE_FILE);
  const grep = buildGrep(entries);
  const explicitGrep = opts.passthrough.some(
    a =>
      a === "--grep" || a.startsWith("--grep=") || a.startsWith("--grep-invert")
  );

  // ---- 隔离单跑：清单为空则静默退出（不启动任何服务） ----
  if (mode.grep === "include") {
    if (!grep) {
      console.log("[e2e-run] 隔离清单为空，无需单跑。");
      return process.exit(0);
    }
    return spawnPlaywright({
      mode,
      files: [],
      args: ["--grep", grep],
      env: mode.env,
      passthrough: opts.passthrough,
      dryRun: opts.dryRun
    });
  }

  // ---- 并行分片：隔离排除经环境变量下发给 e2e-parallel ----
  if (mode.parallel) {
    const env = { ...process.env };
    if (grep && !explicitGrep) env.E2E_GREP_INVERT = grep;
    const args = ["scripts/e2e-parallel.mjs", ...opts.passthrough];
    if (opts.dryRun) {
      console.log(`[e2e-run] (dry-run) node ${args.join(" ")}`);
      if (env.E2E_GREP_INVERT)
        console.log(
          `[e2e-run] (dry-run) E2E_GREP_INVERT=${env.E2E_GREP_INVERT}`
        );
      return;
    }
    const child = spawn("node", args, { stdio: "inherit", env });
    return child.on("close", code => process.exit(code ?? 1));
  }

  // ---- 常规跑批：主线追加 --grep-invert 排除隔离用例 ----
  const args = [];
  if (grep && !explicitGrep) args.push("--grep-invert", grep);
  return spawnPlaywright({
    mode,
    files: mode.files ?? [],
    args,
    env: mode.env,
    passthrough: opts.passthrough,
    dryRun: opts.dryRun
  });
}

function spawnPlaywright({ mode, files, args, env, passthrough, dryRun }) {
  if (mode.build && !dryRun) {
    console.log("[e2e-run] 构建前端产物（CSP 隔离验证前置）…");
    execSync("pnpm build", { stdio: "inherit" });
  }
  for (const port of mode.kill ?? []) if (!dryRun) freePort(port);
  if ((mode.kill ?? []).length) {
    // 等杀掉的进程释放端口（与 e2e-parallel 同口径）
    try {
      execSync("sleep 0.5", { stdio: "ignore" });
    } catch {
      // 忽略
    }
  }

  const finalArgs = [
    "exec",
    "playwright",
    "test",
    ...files,
    ...(mode.args ?? []),
    ...args,
    ...passthrough
  ];
  if (dryRun) {
    const shownEnv = Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    console.log(`[e2e-run] (dry-run) ${shownEnv} pnpm ${finalArgs.join(" ")}`);
    return;
  }
  const child = spawn("pnpm", finalArgs, {
    stdio: "inherit",
    env: { ...process.env, ...env }
  });
  child.on("close", code => process.exit(code ?? 1));
}

main();
