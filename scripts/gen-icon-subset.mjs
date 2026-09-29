#!/usr/bin/env node
// 图标集构建期子集化：把 iconRegistry 懒加载单元从 @iconify/json 全集合
// （ep/ri/fa-solid 三包 raw ≈ 1.9MB，ri 单集合 chunk 1.07MB）替换为「引用并集」子集。
//
// 引用面（并集）：
//   1. 选择器候选：src/components/ReIcon/data.ts 的 IconJson 三个数组——选择器
//      只从这里出候选，因此子集按构造包含选择器可提供的每个图标（一致性不靠对账靠生成）；
//   2. 代码引用：src/** 的 `~icons/<set>/<name>?raw` 静态 import（offlineIcon.ts 的随包注册）；
//   3. 服务端种子：xadmin-server/loadjson/*.json 的 `icon: "<set>:<name>"`（菜单元数据，
//      跨仓缺失时跳过——与 check_doc_facts 的跨仓口径一致）。
//
// 产物：src/components/ReIcon/data/subsets/<set>.json（iconify 集合格式，剥除 info/
// lastModified 元数据），gitignore 不入库；postinstall + prebuild 自动再生成，
// vite 构建期 import 缺文件即失败（自检）。别名入选时其父图标 body 一并写入。
//
// fail-closed：候选/引用名在全集合不存在（上游改名/删除，如 ri 的 celery-* 曾
// 陈旧且可被选中后渲染空白）即退出码 1 并列出——陈旧名在构建期暴露而非线上空白。
//
// 用法：node scripts/gen-icon-subset.mjs [--report]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR = join(ROOT, "src/components/ReIcon/data/subsets");
const DATA_TS = join(ROOT, "src/components/ReIcon/data.ts");
const SETS = ["ep", "ri", "fa-solid"];
const reportOnly = process.argv.includes("--report");

/** 1. 选择器候选（IconJson） */
function pickerNames() {
  const src = readFileSync(DATA_TS, "utf-8");
  const names = {};
  for (const m of src.matchAll(/"(ep|ri|fa-solid):": \[([\s\S]*?)\]/g)) {
    names[m[1]] = new Set([...m[2].matchAll(/"([^"]+)"/g)].map(x => x[1]));
  }
  if (SETS.some(set => !names[set])) {
    console.error(
      `[icon-subset] data.ts 缺少集合数组：${SETS.join("/")}，解析口径漂移`
    );
    process.exit(1);
  }
  return names;
}

/** 2. 代码里 `~icons/<set>/<name>?raw` 引用 */
function codeNames() {
  const names = { ep: new Set(), ri: new Set(), "fa-solid": new Set() };
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "subsets") continue; // 生成物自身
        walk(full);
      } else if (/\.(ts|tsx|vue)$/.test(entry.name)) {
        const src = readFileSync(full, "utf-8");
        for (const m of src.matchAll(/~icons\/([\w-]+)\/([\w-]+)\?raw/g)) {
          (names[m[1]] ??= new Set()).add(m[2]);
        }
      }
    }
  };
  walk(join(ROOT, "src"));
  return names;
}

/** 3. 服务端种子菜单元数据（跨仓缺失跳过） */
function seedNames() {
  const names = { ep: new Set(), ri: new Set(), "fa-solid": new Set() };
  const dir = resolve(ROOT, "../xadmin-server/loadjson");
  let files = [];
  try {
    files = readdirSync(dir).filter(f => f.endsWith(".json"));
  } catch {
    console.log(
      "[icon-subset] 未找到 xadmin-server（独立检出），跳过种子图标收集"
    );
    return names;
  }
  for (const f of files) {
    const txt = readFileSync(join(dir, f), "utf-8");
    for (const m of txt.matchAll(/"icon":\s*"([\w-]+):([\w-]+)"/g)) {
      (names[m[1]] ??= new Set()).add(m[2]);
    }
  }
  return names;
}

const picker = pickerNames();
const code = codeNames();
const seeds = seedNames();
const summary = [];

for (const set of SETS) {
  let full;
  try {
    full = JSON.parse(
      readFileSync(
        join(ROOT, `node_modules/@iconify/json/json/${set}.json`),
        "utf-8"
      )
    );
  } catch {
    console.error(
      `[icon-subset] 未找到 @iconify/json 的 ${set}.json——请先 pnpm install`
    );
    process.exit(1);
  }
  const fullIcons = full.icons ?? {};
  const fullAliases = full.aliases ?? {};
  const inFull = name => name in fullIcons || name in fullAliases;

  const wanted = new Set([
    ...picker[set],
    ...(code[set] ?? []),
    ...(seeds[set] ?? [])
  ]);
  const missing = [...wanted].filter(name => !inFull(name)).sort();
  if (missing.length > 0) {
    console.error(
      `[icon-subset] ${set} 集合中不存在（上游已改名/删除，请从 data.ts/代码/种子移除）：\n  ${missing.join("\n  ")}`
    );
    process.exit(1);
  }

  // 别名链：入选别名引用的父图标 body 必须在 icons 里（alias.parent 指向实体图标）
  const bodies = {};
  const aliases = {};
  const takeBody = name => {
    if (bodies[name]) return;
    bodies[name] = fullIcons[name];
  };
  for (const name of wanted) {
    if (name in fullIcons) takeBody(name);
    else {
      aliases[name] = fullAliases[name];
      takeBody(fullAliases[name].parent);
    }
  }

  const subset = {
    ...(full.prefix ? { prefix: full.prefix } : {}),
    ...(full.width !== undefined ? { width: full.width } : {}),
    ...(full.height !== undefined ? { height: full.height } : {}),
    icons: bodies,
    ...(Object.keys(aliases).length > 0 ? { aliases } : {})
  };

  const outPath = join(OUT_DIR, `${set}.json`);
  const fullBytes = Buffer.byteLength(
    readFileSync(join(ROOT, `node_modules/@iconify/json/json/${set}.json`))
  );
  if (!reportOnly) {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(outPath, JSON.stringify(subset));
  }
  const outBytes = Buffer.byteLength(JSON.stringify(subset));
  summary.push(
    `${set}: ${wanted.size} 图标（选择器 ${picker[set].size} / 代码 ${code[set].size} / 种子 ${seeds[set].size}）` +
      ` ${(fullBytes / 1024).toFixed(0)}KB → ${(outBytes / 1024).toFixed(0)}KB`
  );
}

console.log(
  `[icon-subset] ${reportOnly ? "报告" : "已生成到 src/components/ReIcon/data/subsets/"}：`
);
for (const line of summary) console.log(`  ${line}`);
