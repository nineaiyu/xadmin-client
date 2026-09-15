// 首屏闭包体积快照门禁（KPI 从「绝对 -10%」改为「增长预算制」后的执行器）。
//
// 口径与 metrics.md 的「首屏 JS 静态依赖闭包」一致：
//   dist/index.html 的 module 入口 + 全部 <link rel="modulepreload"> 目标，
//   逐个按 gzip level 9 压缩后求和（gzip9 口径）。
//
// 用法：
//   node scripts/check-bundle-size.mjs            # 与基线比对，超预算即失败
//   node scripts/check-bundle-size.mjs --update   # 刷新基线快照（需在 PR 说明理由）
//   node scripts/check-bundle-size.mjs --format md # 输出 Markdown 报告（用于回填指标）
//
// 预算：每窗口闭包增长 ≤ BUNDLE_GROWTH_BUDGET_KB（默认 15 KB）。超预算需在 PR 说明，
// 批准后以 --update 刷新基线；主 chunk 单独登记用于定位增长来源（不作独立门禁）。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distDir = join(root, "dist");
const baselinePath = join(__dirname, "bundle-size-baseline.json");
const BUDGET_KB = 15;

const args = process.argv.slice(2);
const shouldUpdate = args.includes("--update");
const format = args.includes("--format")
  ? args[args.indexOf("--format") + 1]
  : "text";

const indexHtmlPath = join(distDir, "index.html");
if (!existsSync(indexHtmlPath)) {
  console.error("[bundle-size] 未找到 dist/index.html，请先执行 pnpm build");
  process.exit(1);
}

const html = readFileSync(indexHtmlPath, "utf-8");
const staticRefs = [
  ...html.matchAll(/<script[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g),
  ...html.matchAll(/<link[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g)
].map(m => m[1]);

if (staticRefs.length === 0) {
  console.error(
    "[bundle-size] index.html 中未解析到入口/modulepreload，产物异常"
  );
  process.exit(1);
}

/** gzip level 9 压缩后体积（KB，保留 1 位小数） */
function gzip9Kb(absPath) {
  if (!existsSync(absPath)) {
    console.error(`[bundle-size] 闭包引用文件不存在：${absPath}`);
    process.exit(1);
  }
  return gzipSync(readFileSync(absPath), { level: 9 }).length / 1024;
}

/** 去掉 hash 后的块名：index-DYrS947D.js -> index.js */
function chunkName(file) {
  return file.replace(/-[A-Za-z0-9_-]{8,}\.js$/, ".js");
}

const chunks = staticRefs.map(ref => {
  const rel = ref.replace(/^\//, "");
  const abs = join(distDir, rel);
  const kb = gzip9Kb(abs);
  return {
    file: rel.split("/").pop(),
    name: chunkName(rel.split("/").pop()),
    kb
  };
});

// 入口脚本固定为第一个（收集时 script 标签先于 modulepreload）
const closureKb = chunks.reduce((sum, c) => sum + c.kb, 0);
const mainChunk = chunks[0];
const round1 = n => Math.round(n * 10) / 10;

const snapshot = {
  updated: new Date().toISOString().slice(0, 10),
  budget_kb: BUDGET_KB,
  closure_gzip9_kb: round1(closureKb),
  main_chunk_gzip9_kb: mainChunk ? round1(mainChunk.kb) : null,
  chunks: chunks.map(c => ({ name: c.name, file: c.file, kb: round1(c.kb) }))
};

function renderMarkdown(baseline, delta) {
  const lines = [
    "| 指标 | 数值 |",
    "|------|------|",
    `| 首屏 JS 静态闭包（gzip9） | ${snapshot.closure_gzip9_kb} KB（${chunks.length} chunks） |`,
    `| 主 chunk \`${mainChunk?.file ?? "-"}\` | ${snapshot.main_chunk_gzip9_kb ?? "-"} KB |`,
    "",
    "闭包构成：",
    "",
    "| chunk | gzip9 KB |",
    "|-------|----------|",
    ...chunks
      .slice()
      .sort((a, b) => b.kb - a.kb)
      .map(c => `| ${c.file} | ${round1(c.kb)} |`)
  ];
  if (baseline) {
    lines.push(
      "",
      `对比基线（${baseline.updated}）：${delta >= 0 ? "+" : ""}${round1(delta)} KB / 预算 ${BUDGET_KB} KB`
    );
  }
  return lines.join("\n");
}

if (shouldUpdate) {
  writeFileSync(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`[bundle-size] 基线已刷新：${baselinePath}`);
  console.log(renderMarkdown());
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(
    `[bundle-size] 基线不存在：${baselinePath}，首次登记请执行 pnpm check:bundle-size -- --update`
  );
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
const delta = round1(snapshot.closure_gzip9_kb - baseline.closure_gzip9_kb);

if (format === "md") {
  console.log(renderMarkdown(baseline, delta));
  process.exit(0);
}

console.log(
  `[bundle-size] 首屏闭包 ${snapshot.closure_gzip9_kb} KB / 基线 ${baseline.closure_gzip9_kb} KB` +
    `（${delta >= 0 ? "+" : ""}${delta} KB，预算 ${BUDGET_KB} KB）`
);
console.log(
  `[bundle-size] 主 chunk ${snapshot.main_chunk_gzip9_kb} KB（基线 ${baseline.main_chunk_gzip9_kb} KB）`
);

if (delta > BUDGET_KB) {
  console.error(
    `[bundle-size] 闭包增长 ${delta} KB 超出预算 ${BUDGET_KB} KB。\n` +
      "  处理方式（择一）：\n" +
      "  1) 排查增长来源并优化（推荐先看 pnpm report 的模块图）；\n" +
      "  2) 若确属必要功能增量，在 PR 说明理由后执行 pnpm check:bundle-size -- --update 刷新基线。"
  );
  process.exit(1);
}

console.log("[bundle-size] 在预算内，通过。");
