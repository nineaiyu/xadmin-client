// 首屏/全量产物体积分析（拆包决策依据）。
//
// 运行：pnpm analyze:bundle            # 构建并分析（约 1 分钟）
//       pnpm analyze:bundle -- --reuse # 复用上次 bundle-analysis.json
//       KEEP_ANALYSIS_DIR=1 pnpm analyze:bundle  # 保留分析产物
//
// 原理：以 build/analysis.config.ts 追加 rollup-plugin-visualizer 的 raw-data 输出，
// 解析 nodeParts（每个模块在产物中的 renderedLength/gzipLength）与 nodeMetas（模块 id），
// 默认只统计「首屏闭包」chunk（与 scripts/bundle-size-baseline.json 的块名一致），
// 按 npm 包 / src 目录聚合，用于回答「拆包动作是否有数据支撑」。
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = join(root, "dist-analysis");
const reuse = process.argv.includes("--reuse");
const existingStats = join(root, "bundle-analysis.json");

if (!(reuse && existsSync(existingStats))) {
  const build = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "vite",
      "build",
      "--config",
      "build/analysis.config.ts",
      "--outDir",
      "dist-analysis"
    ],
    {
      cwd: root,
      encoding: "utf-8",
      stdio: "inherit",
      shell: process.platform === "win32"
    }
  );
  if (build.status !== 0) process.exit(build.status ?? 1);
}

// visualizer 的 filename 按 cwd 解析（与 outDir 无关），两个位置都探测
const statsPath = [
  join(root, "bundle-analysis.json"),
  join(outDir, "bundle-analysis.json")
].find(p => existsSync(p));
if (!statsPath) {
  console.error(
    "[analyze] 未生成 bundle-analysis.json（检查 visualizer 是否被条件跳过）"
  );
  process.exit(1);
}

const stats = JSON.parse(readFileSync(statsPath, "utf-8"));
const { nodeParts = {}, nodeMetas = {} } = stats;

/** 去掉 hash 的块名：static/js/index-DYrS947D.js -> index.js；非 static 原样返回 */
function normalizeChunk(chunkFile) {
  const base = chunkFile.split("/").pop();
  return base.replace(/-[A-Za-z0-9_-]{6,}\.js$/, ".js");
}

// 首屏闭包块名（与体积门禁基线同源）
const baselinePath = join(__dirname, "bundle-size-baseline.json");
const closureNames = existsSync(baselinePath)
  ? new Set(
      JSON.parse(readFileSync(baselinePath, "utf-8")).chunks.map(c => c.name)
    )
  : null;

/** 从模块 id 归一化出聚合键：npm 包名 / src 一级目录 / 其他 */
function groupKey(id) {
  if (id.includes("node_modules")) {
    const normalized = id.replace(/\\/g, "/");
    const segs = normalized.split("node_modules/");
    const tail = segs[segs.length - 1];
    const parts = tail.split("/");
    return parts[0].startsWith(".") ? parts[1] : parts[0];
  }
  const m = id.match(/\/src\/([^/]+)\//);
  if (m) return `src/${m[1]}`;
  return id.replace(/\\/g, "/").split("/").slice(-2).join("/");
}

// 逐模块逐块展开体积
const rows = [];
for (const meta of Object.values(nodeMetas)) {
  for (const [chunkFile, partUid] of Object.entries(meta.moduleParts ?? {})) {
    const part = nodeParts[partUid];
    if (!part?.renderedLength) continue;
    rows.push({
      id: meta.id,
      chunk: normalizeChunk(chunkFile),
      rendered: part.renderedLength,
      gzip: part.gzipLength ?? 0
    });
  }
}

const closureRows = closureNames
  ? rows.filter(r => closureNames.has(r.chunk))
  : rows;
const kb = n => `${(n / 1024).toFixed(1)} KB`;
const sum = (list, key) => list.reduce((acc, r) => acc + r[key], 0);

console.log(
  `\n========== 块级汇总（${closureNames ? "首屏闭包" : "全量"}） ==========`
);
const byChunk = new Map();
for (const r of closureRows) {
  const cur = byChunk.get(r.chunk) ?? { rendered: 0, gzip: 0 };
  cur.rendered += r.rendered;
  cur.gzip += r.gzip;
  byChunk.set(r.chunk, cur);
}
for (const [chunk, v] of [...byChunk.entries()].sort(
  (a, b) => b[1].rendered - a[1].rendered
)) {
  console.log(
    `${chunk.padEnd(24)} rendered ${kb(v.rendered).padStart(10)}  gzip≈ ${kb(v.gzip)}`
  );
}
console.log(
  `合计 rendered ${kb(sum(closureRows, "rendered"))} / gzip≈ ${kb(sum(closureRows, "gzip"))}`
);

const groups = new Map();
for (const r of closureRows) {
  const key = groupKey(r.id);
  const cur = groups.get(key) ?? { rendered: 0, gzip: 0, files: 0 };
  cur.rendered += r.rendered;
  cur.gzip += r.gzip;
  cur.files += 1;
  groups.set(key, cur);
}
const sorted = [...groups.entries()].sort(
  (a, b) => b[1].rendered - a[1].rendered
);

console.log("\n========== 分组汇总 Top 30（按 renderedLength） ==========");
console.log("| 分组 | rendered | gzip≈ | 模块数 |");
console.log("|------|----------|-------|--------|");
for (const [key, v] of sorted.slice(0, 30)) {
  console.log(`| ${key} | ${kb(v.rendered)} | ${kb(v.gzip)} | ${v.files} |`);
}

console.log("\n========== 单文件 Top 40 ==========");
for (const r of [...closureRows]
  .sort((a, b) => b.rendered - a.rendered)
  .slice(0, 40)) {
  console.log(`${kb(r.rendered).padStart(10)}  ${r.id}  [${r.chunk}]`);
}

if (process.env.KEEP_ANALYSIS_DIR !== "1") {
  rmSync(outDir, { recursive: true, force: true });
  rmSync(join(root, "bundle-analysis.json"), { force: true });
  console.log("\n[analyze] 已清理分析产物（KEEP_ANALYSIS_DIR=1 可保留）");
}
