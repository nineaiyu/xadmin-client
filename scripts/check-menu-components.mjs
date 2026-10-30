#!/usr/bin/env node
// 菜单组件路径守护门禁（防「种子引用的页面组件在前端不存在」的静默断路由）。
//
// 口径：
// - 扫描后端菜单种子（各应用 seeds/menu.json 与 loadjson/ 的 Django fixture，
//   model=system.menu 且 fields.component 非空的条目）；
// - 每个组件片段按 src/router/utils/resolve-component.ts 的**同一候选链**解析：
//   裸片段 → `.vue` / `.tsx` → `/index.vue` / `/index.tsx`，extensions/views 前缀
//   互换再试一次（候选链若有调整须同步本脚本与 resolve-component.ts）；
// - 候选全部落空即失败（报告种子文件 / 菜单 name / component / 试过的候选）；
//   页面文件改名或移动而种子未同步、或手写种子拼错路径，都会在此被拦截——
//   这类断链平时无任何报错，用户点菜单直接 404；
// - 特殊形态（外链等）登记 WHITELIST 并注明理由。
//
// 服务端目录解析同 check-menu-permissions.mjs：默认 ../xadmin-server，
// 可用 XADMIN_SERVER_DIR 覆盖；未检出时跳过（单仓场景，恒通过）。
//
// 用法：
//   node scripts/check-menu-components.mjs            # 门禁（CI 用）
//   node scripts/check-menu-components.mjs --report   # 仅报告，恒不失败
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_DIR = path.resolve(ROOT, "src");
const VIEWS_DIR = join(SRC_DIR, "views");
const EXTENSIONS_DIR = join(SRC_DIR, "extensions");

// 特殊形态白名单：component 值 -> 理由（当前为空，出现外链/占位形态时登记）
const WHITELIST = {};

function toPosix(p) {
  return p.split(sep).join("/");
}

/** 与 resolve-component.ts 的候选链保持一致（改动须双侧同步） */
function candidatesOf(component) {
  const normalized = component.replace(/^@\//, "").replace(/^\/+/, "");
  const base = component.startsWith("/src/")
    ? component
    : normalized.startsWith("extensions/")
      ? `/src/${normalized}`
      : `/src/views/${normalized}`;
  const list = [
    base,
    `${base}.vue`,
    `${base}.tsx`,
    `${base}/index.vue`,
    `${base}/index.tsx`
  ];
  const alternative = normalized.startsWith("extensions/")
    ? `/src/views/${normalized.slice("extensions/".length)}`
    : `/src/extensions/${normalized}`;
  for (const candidate of [
    alternative,
    `${alternative}.vue`,
    `${alternative}.tsx`
  ]) {
    if (!list.includes(candidate)) list.push(candidate);
  }
  return list;
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else if (/\.(vue|tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

function collectSeedFiles(serverDir, out = []) {
  if (!existsSync(serverDir)) return out;
  for (const name of readdirSync(serverDir)) {
    const appDir = join(serverDir, name);
    if (!statSync(appDir).isDirectory()) continue;
    const seeds = join(appDir, "seeds");
    if (existsSync(join(seeds, "menu.json")))
      out.push(join(seeds, "menu.json"));
  }
  // 可选安装的插件包（examples/plugins/<pkg>/<app>/seeds/）：装不装由宿主决定，
  // 但其种子引用的前端页面必须存在（插件前端示例页随宿主前端仓分发）
  const plugins = join(serverDir, "examples", "plugins");
  if (existsSync(plugins)) {
    for (const pkg of readdirSync(plugins)) {
      const pkgDir = join(plugins, pkg);
      if (!statSync(pkgDir).isDirectory()) continue;
      for (const entry of readdirSync(pkgDir)) {
        const seeds = join(pkgDir, entry, "seeds");
        if (existsSync(join(seeds, "menu.json")))
          out.push(join(seeds, "menu.json"));
      }
    }
  }
  const loadjson = join(serverDir, "loadjson");
  if (existsSync(loadjson)) {
    for (const name of readdirSync(loadjson)) {
      if (name.endsWith(".json")) out.push(join(loadjson, name));
    }
  }
  return out;
}

const reportOnly = process.argv.includes("--report");
const serverDir =
  process.env.XADMIN_SERVER_DIR || path.resolve(ROOT, "..", "xadmin-server");

const viewFiles = new Set(
  [...walkFiles(VIEWS_DIR), ...walkFiles(EXTENSIONS_DIR)].map(f =>
    toPosix(`/${relative(ROOT, f)}`)
  )
);

const seedFiles = collectSeedFiles(serverDir);
if (seedFiles.length === 0) {
  console.log(
    `菜单组件路径门禁：未找到菜单种子（server 目录 ${serverDir}），跳过。`
  );
  process.exit(0);
}

const problems = [];
let checked = 0;
for (const seedFile of seedFiles) {
  let fixtures;
  try {
    fixtures = JSON.parse(readFileSync(seedFile, "utf8"));
  } catch {
    problems.push(`${relative(serverDir, seedFile)}: JSON 解析失败`);
    continue;
  }
  if (!Array.isArray(fixtures)) continue;
  for (const fixture of fixtures) {
    const fields = fixture?.fields;
    const component = fields?.component;
    if (!component || typeof component !== "string") continue;
    if (WHITELIST[component]) continue;
    checked += 1;
    const candidates = candidatesOf(component);
    if (!candidates.some(candidate => viewFiles.has(candidate))) {
      problems.push(
        `${relative(serverDir, seedFile)}: 菜单「${fields.name ?? fixture.pk}」component="${component}" 未命中任何页面文件` +
          `（候选：${candidates.map(c => c.replace(/^\/src\//, "")).join(" / ")}）`
      );
    }
  }
}

if (problems.length > 0) {
  console.error(
    `菜单组件路径门禁失败：${problems.length} 处种子引用的组件不存在（检查 ${checked} 条）`
  );
  for (const line of problems) console.error(`  - ${line}`);
  if (!reportOnly) process.exit(1);
} else {
  console.log(
    `菜单组件路径门禁通过：${checked} 条组件引用全部命中页面文件（种子 ${seedFiles.length} 个）。`
  );
}
