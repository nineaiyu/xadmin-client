#!/usr/bin/env node
// 图标集构建期子集化：把 iconRegistry 懒加载单元从 @iconify/json 全集合
// （ep/ri/fa-solid 三包 raw ≈ 1.9MB，ri 单集合 chunk 1.07MB）替换为「引用并集」子集。
//
// 引用面（并集）：
//   1. 选择器候选：src/components/ReIcon/data.ts 的 IconJson 三个数组——选择器
//      只从这里出候选，因此子集按构造包含选择器可提供的每个图标（一致性不靠对账靠生成）；
//   2. 代码引用：src/** 的 `~icons/<set>/<name>?raw` 静态 import（offlineIcon.ts 的随包注册）；
//   3. 服务端种子：xadmin-server 平台层 `loadjson/*.json` + 各应用 `<app>/seeds/*.json`
//      的 `icon: "<set>:<name>"`（菜单元数据；跨仓缺失时跳过——与 check_doc_facts 的跨仓口径一致）。
//
// 可选「精选候选面」构建档（图标裁剪方案 B，产品决策项的落地开关）：
//   ICON_CANDIDATES_CURATED=1 时，选择器候选按 scripts/icon-candidates.curated.json
//   裁剪（键缺席 = 该集合保持全候选面；键为空数组 = 该集候选清零并从选择器页签隐藏）；
//   子集与运行时候选（picker-candidates.json）同源生成，一致性不靠对账靠生成。
//   代码 + 种子引用图标始终保底入子集（已用图标保底集，防存量菜单渲染空白）。
//
// 产物：src/components/ReIcon/data/subsets/<set>.json（iconify 集合格式，剥除 info/
// lastModified 元数据）与 src/components/ReIcon/data/picker-candidates.json（选择器
// 运行时候选面），均 gitignore 不入库；postinstall + prebuild 自动再生成，
// vite 构建期 import 缺文件即失败（自检）。别名入选时其父图标 body 一并写入。
//
// fail-closed：候选/引用名在全集合不存在（上游改名/删除，如 ri 的 celery-* 曾
// 陈旧且可被选中后渲染空白）即退出码 1 并列出——陈旧名在构建期暴露而非线上空白。
//
// 用法：node scripts/gen-icon-subset.mjs [--report]
//       ICON_CANDIDATES_CURATED=1 node scripts/gen-icon-subset.mjs   # 精选候选面档
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR = join(ROOT, "src/components/ReIcon/data/subsets");
const DATA_DIR = join(ROOT, "src/components/ReIcon/data");
const DATA_TS = join(ROOT, "src/components/ReIcon/data.ts");
const CURATED_FILE = join(ROOT, "scripts/icon-candidates.curated.json");
const SETS = ["ep", "ri", "fa-solid"];
const reportOnly = process.argv.includes("--report");
const curatedMode = ["1", "true"].includes(
  String(process.env.ICON_CANDIDATES_CURATED ?? "").toLowerCase()
);

/** 精选候选面清单（仅 curated 档读取）：键缺席 = 保持全候选面 */
function curatedManifest() {
  if (!existsSync(CURATED_FILE)) {
    console.error(
      `[icon-subset] ICON_CANDIDATES_CURATED 已开启但未找到 ${CURATED_FILE}。\n` +
        '             精选清单是产品口径的输入文件（形状 {"ri": [...], "fa-solid": [...]}，\n' +
        "             ep 全集合本就只有 293 个通常无需裁剪）；补齐后重跑。"
    );
    process.exit(1);
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(CURATED_FILE, "utf-8"));
  } catch (error) {
    console.error(`[icon-subset] 精选清单解析失败：${error.message}`);
    process.exit(1);
  }
  const unknown = Object.keys(manifest).filter(k => !SETS.includes(k));
  if (unknown.length > 0) {
    console.error(
      `[icon-subset] 精选清单含未知集合键：${unknown.join("/")}（合法键：${SETS.join("/")}）`
    );
    process.exit(1);
  }
  for (const [set, names] of Object.entries(manifest)) {
    if (!Array.isArray(names) || names.some(n => typeof n !== "string")) {
      console.error(`[icon-subset] 精选清单 ${set} 的值必须是字符串数组`);
      process.exit(1);
    }
    if (names.length === 0) {
      // 空数组 =「整套下线」：图标注册链路对每套集合都有静态懒加载
      //（iconRegistry import 缺产物文件会让 vite 构建失败），整套下线需先改造
      // 页签与注册链路，不能经空清单表达——保留至少一个图标即可隐藏大半个页签
      console.error(
        `[icon-subset] 精选清单 ${set} 为空数组：整套下线需同步改造 iconRegistry 的静态懒加载链路，` +
          "请至少保留一个候选图标（或先经产品确认后再立项改造）"
      );
      process.exit(1);
    }
  }
  return manifest;
}

/** 1. 选择器候选（IconJson；curated 档按清单裁剪） */
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

/** 3. 服务端种子菜单元数据（平台层 + 各应用 seeds/；跨仓缺失时给出可复现入口） */
function seedNames() {
  const names = { ep: new Set(), ri: new Set(), "fa-solid": new Set() };
  // 与 check_doc_facts / check-version-sync 等跨仓门禁统一口径：XADMIN_SERVER_DIR 可覆盖
  const serverRoot = resolve(
    process.env.XADMIN_SERVER_DIR ?? join(ROOT, "../xadmin-server")
  );
  if (!existsSync(serverRoot)) {
    console.warn(
      `[icon-subset] 未找到 xadmin-server（${serverRoot}），本次不收集种子图标。\n` +
        "             Docker 构建上下文只含客户端源码，这是预期行为；\n" +
        "             本地/发布前请用 `XADMIN_SERVER_DIR=/path/to/xadmin-server pnpm gen:icon-subset`\n" +
        "             核对种子图标是否已进入子集（缺失会在选择器里渲染空白）。"
    );
    return names;
  }
  // 种子按应用分层后，菜单图标分散在 loadjson/ 与 <app>/seeds/（同一模型多个文件）
  const dirs = [join(serverRoot, "loadjson")];
  for (const entry of readdirSync(serverRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const seedDir = join(serverRoot, entry.name, "seeds");
    if (existsSync(seedDir)) dirs.push(seedDir);
  }
  for (const dir of dirs) {
    let files = [];
    try {
      files = readdirSync(dir).filter(f => f.endsWith(".json"));
    } catch {
      continue;
    }
    for (const f of files) {
      const txt = readFileSync(join(dir, f), "utf-8");
      for (const m of txt.matchAll(/"icon":\s*"([\w-]+):([\w-]+)"/g)) {
        (names[m[1]] ??= new Set()).add(m[2]);
      }
    }
  }
  return names;
}

// 依赖层环境（Dockerfile-base 只进 scripts 与锁文件、无 src/）没有可子集化的
// 引用面：跳过生成，真实构建由 prebuild（有完整源码）重新生成并保持 fail-closed。
if (!existsSync(DATA_TS)) {
  console.log(
    "[icon-subset] 未找到 src/components/ReIcon/data.ts（依赖层镜像无源码），跳过子集生成"
  );
  process.exit(0);
}

const picker = pickerNames();
const manifest = curatedMode ? curatedManifest() : {};
const code = codeNames();
const seeds = seedNames();
const summary = [];

// curated 档的有效候选面：清单键缺席 = 该集合保持全候选面（ep 通常无需裁剪）；
// 空数组 = 该集候选清零（子集仍含代码/种子保底图标，选择器页签隐藏）
const effectivePicker = {};
for (const set of SETS) {
  const curated = manifest[set];
  effectivePicker[set] =
    curated === undefined
      ? picker[set]
      : new Set(curated.filter(name => picker[set].has(name)));
}
// 精选名单里不在全候选面的名字（含上游改名/删除）必须构建期暴露，不能静默丢弃
for (const [set, curated] of Object.entries(manifest)) {
  const stale = curated.filter(name => !picker[set].has(name));
  if (stale.length > 0) {
    console.error(
      `[icon-subset] 精选清单 ${set} 中的名字不在候选面（data.ts 全集合或上游已改名/删除）：\n  ${stale.join("\n  ")}`
    );
    process.exit(1);
  }
}

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
    ...effectivePicker[set],
    ...(code[set] ?? []),
    ...(seeds[set] ?? [])
  ]);
  if (wanted.size === 0) {
    console.error(
      `[icon-subset] ${set} 子集为空——引用面解析异常（data.ts / 代码引用 / 种子均未命中），` +
        "拒绝产出空子集；请检查 data.ts 的集合数组与 XADMIN_SERVER_DIR。"
    );
    process.exit(1);
  }
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
    `${set}: ${wanted.size} 图标（选择器 ${effectivePicker[set].size} / 代码 ${code[set].size} / 种子 ${seeds[set].size}）` +
      ` ${(fullBytes / 1024).toFixed(0)}KB → ${(outBytes / 1024).toFixed(0)}KB`
  );
}

// 选择器运行时候选面（与子集同源生成，键形态与 IconJson 一致带「:」）；
// 候选清零的集合不写键 → Select.vue 按 Object.keys 出页签，自动隐藏
const pickerCandidates = {};
for (const set of SETS) {
  if (effectivePicker[set].size > 0) {
    pickerCandidates[`${set}:`] = [...effectivePicker[set]];
  }
}
if (!reportOnly) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    join(DATA_DIR, "picker-candidates.json"),
    JSON.stringify(pickerCandidates)
  );
}

console.log(
  `[icon-subset] ${curatedMode ? "精选候选面档" : "默认全候选面档"}${reportOnly ? "（报告）" : ""}，已生成到 src/components/ReIcon/data/：`
);
for (const line of summary) console.log(`  ${line}`);
