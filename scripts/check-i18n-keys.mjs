#!/usr/bin/env node
// 国际化词条门禁（防「代码引用了不存在的词条」与 zh/en 漂移）。
//
// 口径：
// - 提取 src/ 下所有静态 `t("a.b.c")` / `$t("a.b.c")` 引用（含模板与脚本；动态拼接
//   的 key 无法静态解析，天然豁免，需在运行时兜底）；
// - 每个被引用的 key 必须同时存在于 locales/zh-CN.yaml 与 locales/en.yaml；
// - zh 与 en 的 key 集合必须完全一致（任一缺失即失败）；
// - 词条值不得含 HTML 标签形态（`<tag>` / `</tag>`）：unplugin-vue-i18n 构建期会把这类
//   词条判定为 HTML 并**直接抛错**（Detected HTML in ... message），locale 模块整块转换
//   失败；正则/代码示例里的尖括号要写成字面量插值，如 `{'<'}pk{'>'}`。
//
// 背景：缺失词条不会报错——vue-i18n 会把 key 原样显示在界面上（如 "buttons.confirm"），
// 只有在人工走查该页面时才会被发现（历史问题：ratioRangeRequired / buttons.confirm /
// userinfo.verifyPassword 三个 key 长期缺失）。
//
// 用法：
//   node scripts/check-i18n-keys.mjs            # 门禁（CI 用）
//   node scripts/check-i18n-keys.mjs --report   # 仅报告，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_DIR = join(ROOT, "src");
const ZH_FILE = join(ROOT, "locales/zh-CN.yaml");
const EN_FILE = join(ROOT, "locales/en.yaml");
const EXTENSIONS = new Set([".ts", ".tsx", ".vue", ".js", ".jsx"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

/**
 * 解析 yaml 的嵌套 key 路径（缩进栈）。
 * 仅取「key:」形态的行；数组项与多行字符串内部的行不含 `key:` 前缀，自动跳过。
 */
function parseYamlKeys(file) {
  const lines = readFileSync(file, "utf-8").split(/\r\n|\n|\r/);
  const keys = new Set();
  const stack = [];
  for (const line of lines) {
    const match = /^(\s*)([A-Za-z0-9_."]+):(\s.*)?$/.exec(line);
    if (!match) continue;
    const indent = match[1].length;
    const name = match[2].replace(/^["']|["']$/g, "");
    while (stack.length && stack[stack.length - 1].indent >= indent)
      stack.pop();
    keys.add([...stack.map(item => item.name), name].join("."));
    stack.push({ indent, name });
  }
  return keys;
}

/** yaml「key: value」行（与 parseYamlKeys 同口径，value 取第 3 组） */
const YAML_ENTRY_RE = /^(\s*)([A-Za-z0-9_."]+):(\s.*)?$/;

/** HTML 标签形态（`<pk>` / `</pk>` / `<br/>`；数学比较符 "a < b" 不会命中） */
const HTML_TAG_RE = /<\/?[A-Za-z][^<>\s]*\/?>/;

/**
 * 扫描词条值里的 HTML 标签（unplugin-vue-i18n 会因此在转换期抛错，必须提前拦截）。
 * 仅覆盖单行 `key: "value"` 形态；多行块标量（`|`/`>`）内的标签不在扫描面内。
 */
function collectHtmlMessages(file) {
  const hits = [];
  readFileSync(file, "utf-8")
    .split(/\r\n|\n|\r/)
    .forEach((line, index) => {
      const match = YAML_ENTRY_RE.exec(line);
      if (!match || !match[3]) return;
      if (HTML_TAG_RE.test(match[3])) {
        hits.push([index + 1, match[2], match[3].trim()]);
      }
    });
  return hits;
}

/** 提取源文件中静态引用的词条 key（`t("a.b")` 形态，至少两级） */
function collectUsedKeys(files) {
  const used = new Map(); // key -> Set(相对路径)
  const pattern =
    /\b(?:\$?t)\(\s*["'`]([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)["'`]/g;
  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    let match;
    while ((match = pattern.exec(text))) {
      const key = match[1];
      if (!used.has(key)) used.set(key, new Set());
      used.get(key).add(relative(ROOT, file).split("\\").join("/"));
    }
  }
  return used;
}

const zhKeys = parseYamlKeys(ZH_FILE);
const enKeys = parseYamlKeys(EN_FILE);
const used = collectUsedKeys(walk(SRC_DIR));

const missingZh = [];
const missingEn = [];
for (const [key, files] of used) {
  if (!zhKeys.has(key)) missingZh.push([key, [...files].join(", ")]);
  if (!enKeys.has(key)) missingEn.push([key, [...files].join(", ")]);
}
const onlyZh = [...zhKeys].filter(key => !enKeys.has(key));
const onlyEn = [...enKeys].filter(key => !zhKeys.has(key));
const htmlHits = [ZH_FILE, EN_FILE].flatMap(file =>
  collectHtmlMessages(file).map(item => [relative(ROOT, file), ...item])
);

console.log(
  `国际化词条门禁：静态引用 ${used.size} 个 key；zh ${zhKeys.size} 条 / en ${enKeys.size} 条。`
);

if (process.argv.includes("--report")) {
  console.log(
    `  缺 zh: ${missingZh.length}；缺 en: ${missingEn.length}；仅 zh: ${onlyZh.length}；仅 en: ${onlyEn.length}；含 HTML: ${htmlHits.length}`
  );
  process.exit(0);
}

const violations = [];
for (const [key, files] of missingZh.sort()) {
  violations.push(`缺少 zh 词条: ${key}  <- ${files}`);
}
for (const [key, files] of missingEn.sort()) {
  violations.push(`缺少 en 词条: ${key}  <- ${files}`);
}
for (const key of onlyZh.sort()) violations.push(`仅 zh 存在: ${key}`);
for (const key of onlyEn.sort()) violations.push(`仅 en 存在: ${key}`);
for (const [file, line, key, value] of htmlHits) {
  violations.push(
    `词条含 HTML 标签: ${file}:${line} ${key} -> ${value}（改用字面量插值，如 {'<'}pk{'>'}）`
  );
}

if (violations.length > 0) {
  console.error(
    "\n国际化词条门禁失败（缺词条会以 key 原文显示在界面上；zh/en 必须完全对称；词条含 HTML 标签会让 unplugin-vue-i18n 转换期直接抛错）："
  );
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}

console.log("国际化词条门禁通过（引用全部命中，zh/en 完全对称）。");
