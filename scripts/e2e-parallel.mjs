#!/usr/bin/env node
/**
 * 并行跑全量 E2E：把测试按文件 shard 切成 E2E_PARALLEL 份，每份由独立进程执行，
 * 并为每个 shard 分配独立后端端口 + 独立前端端口 + 独立 sqlite 库
 * （E2E_DB_FILENAME），彻底隔离共享状态，避免并发时用例互相抢数据产生 flaky。
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
 *   E2E_NO_KILL=1     跳过启动前清理端口（CI 全新无残留，或自行管理端口）
 */
import { spawn, execSync } from "node:child_process";

const total = Number(process.env.E2E_PARALLEL ?? "4");
if (!Number.isInteger(total) || total < 1) {
  console.error(
    `[e2e-parallel] E2E_PARALLEL 非法: ${process.env.E2E_PARALLEL}`
  );
  process.exit(2);
}

const baseApi = Number(process.env.E2E_API_PORT ?? "18896");
const baseFront = Number(process.env.E2E_FRONT_PORT ?? "8848");
const extra = process.argv.slice(2);

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
  }
  await new Promise(r => setTimeout(r, 500)); // 等杀掉的进程释放端口
}

const jobs = Array.from({ length: total }, (_, i) => {
  const env = {
    ...process.env,
    E2E_API_PORT: String(baseApi + i * 2),
    E2E_FRONT_PORT: String(baseFront + i * 2),
    E2E_DB_FILENAME: `e2e-shard-${i}.sqlite3`
  };
  const args = [
    "exec",
    "playwright",
    "test",
    `--shard=${i + 1}/${total}`,
    // 每个 shard 独立产物目录：共用 ./test-results 时各 shard 启动阶段会并发清理/写入
    // 同一目录，互相踩到就整片退出（表现为随机 shard "启动即失败"，Node 安全删除 shim
    // 下更是直接抛 FSMoveObjectToTrashSync 错误）
    `--output=test-results-shard-${i}`,
    "--workers=1",
    ...extra
  ];
  return new Promise(resolve => {
    const child = spawn("pnpm", args, { stdio: "inherit", env });
    child.on("close", code => resolve(code ?? 1));
  });
});

const codes = await Promise.all(jobs);

// run 结束后兜底清理本并行段端口：playwright 偶发不会回收 webServer（残留 daphne/vite），
// 留到下次会撞 reuseExistingServer=false 的 "already used"，故对称清理一次
if (process.env.E2E_NO_KILL !== "1") {
  for (let i = 0; i < total; i++) {
    freePort(baseApi + i * 2);
    freePort(baseFront + i * 2);
  }
}

const failed = codes.filter(c => c !== 0);
if (failed.length > 0) {
  console.error(`[e2e-parallel] ${failed.length}/${total} 个 shard 失败`);
  process.exit(1);
}
