#!/usr/bin/env node
// 国际化词条门禁（防「代码引用了不存在的词条」与 zh/en 漂移）。
//
// 口径：
// - 用真正的 YAML 解析器（yaml）读取 zh-CN.yaml / en.yaml，递归展开叶子键，替代逐行正则；
// - 每个静态引用的 key（`t("a.b")` / `$t("a.b")` / 静态模板字面量）必须同时存在于两侧；
// - zh 与 en 的键集合必须完全一致；同一键的值类型必须一致（字符串 / 对象 / 数组 / 数字…）；
// - 插值占位符集合必须一致（`{name}` 统一空白后比较），禁止全角 `｛｝`（插值不生效）；
// - 词条值不得含 HTML 标签形态（`<tag>` / `</tag>`），块标量（`|` / `>`）同样扫描——
//   vue-i18n 的 message-compiler 会把这类词条判定为 HTML 并在编译期抛错；
// - 值里的 `|` 是 vue-i18n 的复数分隔符（正文会被静默截断），裸 `@` 是 linked message
//   语法；两者必须写成字面量插值（`{'|'}` / `{'@'}`）；
// - 动态键：模板字面量的静态前缀必须命中至少一个词条（前缀规则），否则登记
//   scripts/i18n-dynamic-allowlist.json 的 templates；无法静态解析且不含任何键形态
//   字符串字面量的调用，按文件登记在 allowlist 的 files 并写明理由。
//
// 背景：缺失词条不会报错——vue-i18n 会把 key 原样显示在界面上（如 "buttons.confirm"），
// 只有人工走查才会发现；YAML 重复键会让语言包解析直接失败（整页白屏）。
//
// 用法：
//   node scripts/check-i18n-keys.mjs            # 门禁（CI 用）
//   node scripts/check-i18n-keys.mjs --report   # 仅报告，恒不失败
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_DIR = join(ROOT, "src");
const ZH_FILE = join(ROOT, "locales/zh-CN.yaml");
const EN_FILE = join(ROOT, "locales/en.yaml");
const ALLOWLIST_FILE = join(ROOT, "scripts/i18n-dynamic-allowlist.json");
const EXTENSIONS = new Set([".ts", ".tsx", ".vue", ".js", ".jsx"]);

/** 至少两级（`a.b`）的键形态：单段 key 无法与普通字符串区分，不参与对账 */
const KEY_SHAPE = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(extname(full))) out.push(full);
  }
  return out;
}

/** 剥离注释（HTML / 块 / 整行），避免注释里的示例调用被当成真实引用 */
function stripComments(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)([ \t]*)\/\/[^\n]*/g, "$1$2");
}

/** 读取 YAML 并递归展开叶子：键 -> { type, value }（对象/数组取类型，不下钻） */
function loadLocale(file) {
  let doc;
  try {
    doc = parseYaml(readFileSync(file, "utf-8"));
  } catch (error) {
    return { error };
  }
  const leaves = new Map();
  const visit = (node, prefix) => {
    if (Array.isArray(node)) {
      leaves.set(prefix, { type: "array", value: node });
      return;
    }
    if (node !== null && typeof node === "object") {
      for (const [key, value] of Object.entries(node))
        visit(value, prefix ? `${prefix}.${key}` : key);
      return;
    }
    leaves.set(prefix, {
      type: node === null ? "null" : typeof node,
      value: node
    });
  };
  visit(doc ?? {}, "");
  return { leaves };
}

/** vue-i18n 的 HTML 标签形态（`<pk>` / `</pk>` / `<br/>`；数学比较符 "a < b" 不命中） */
const HTML_TAG_RE = /<\/?[A-Za-z][^<>\s]*\/?>/;
/** 插值名：`{name}`；字面量插值（`{'|'}` / `{'@'}`）的单引号内容不算占位符 */
const PLACEHOLDER_RE = /\{([^{}]+)\}/g;
/** 全角花括号：vue-i18n 不当作插值，界面会显示字面量 */
const FULLWIDTH_BRACE_RE = /[\uFF5B\uFF5D]/;

/** 去掉字面量插值后的正文（`{'|'}` / `{"|"}` 等） */
const stripLiterals = text =>
  text.replace(/\{[`'"]\|[`'"]\}/g, "").replace(/\{[`'"]@[`'"]\}/g, "");

function placeholders(value) {
  const names = new Set();
  for (const match of value.matchAll(PLACEHOLDER_RE)) {
    const name = match[1].trim();
    // 字面量插值 `{'x'}` / `{"x"}` 不是变量占位符
    if (/^[`'"]/.test(name)) continue;
    names.add(name);
  }
  return names;
}

/** 从源码里收集静态 key 引用与动态调用（剥离注释后扫描） */
function collectReferences(files) {
  const staticKeys = new Map(); // key -> Set(相对路径)
  const dynamicPrefixes = new Map(); // 静态前缀 -> Set(相对路径)
  const dynamicTemplates = new Map(); // 模板体 -> Set(相对路径)
  const dynamicFiles = new Map(); // 文件 -> { count, literals: Set(key) }
  const callPattern = /(?:^|[^\w$.])(?:\$?t|composer\.t)(?:<[^>]*>)?\(\s*/g;

  const add = (map, key, file) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(file);
  };

  /** 读取一个函数调用的实参（按括号配对，字符串/模板内的括号不计数） */
  const readArgument = (text, start) => {
    let index = start;
    let depth = 1;
    let out = "";
    while (index < text.length && depth > 0) {
      const char = text[index];
      if (char === '"' || char === "'" || char === "`") {
        out += char;
        index += 1;
        while (index < text.length && text[index] !== char) {
          if (text[index] === "\\") {
            out += text[index];
            index += 1;
          }
          out += text[index];
          index += 1;
        }
        if (index < text.length) out += text[index];
        index += 1;
        continue;
      }
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
      out += char;
      index += 1;
    }
    return out;
  };

  for (const file of files) {
    const rel = relative(ROOT, file).split("\\").join("/");
    const text = stripComments(readFileSync(file, "utf-8"));
    for (const match of text.matchAll(callPattern)) {
      const argument = readArgument(text, match.index + match[0].length).trim();
      if (!argument) continue;
      if (argument.startsWith("`")) {
        const end = argument.indexOf("`", 1);
        const body = argument.slice(1, end === -1 ? argument.length : end);
        if (!body.includes("${")) {
          const candidate = body.replace(/[?#].*$/, "");
          if (KEY_SHAPE.test(candidate)) add(staticKeys, candidate, rel);
          continue;
        }
        add(dynamicTemplates, `\`${body}\``, rel);
        const literal = body.split("${")[0];
        const dot = literal.lastIndexOf(".");
        if (dot >= 0) add(dynamicPrefixes, literal.slice(0, dot + 1), rel);
        continue;
      }
      if (argument.startsWith('"') || argument.startsWith("'")) {
        const quote = argument[0];
        const end = argument.indexOf(quote, 1);
        const candidate = argument.slice(1, end === -1 ? argument.length : end);
        if (KEY_SHAPE.test(candidate)) add(staticKeys, candidate, rel);
        continue;
      }
      // 非字面量实参：先取其中的键形态字符串字面量（三元/`??` 兜底等）
      const literals = [...argument.matchAll(/(["'])([^"'\n]+)\1/g)].map(
        item => item[2]
      );
      const keyish = literals.filter(item => KEY_SHAPE.test(item));
      const entry = dynamicFiles.get(rel) ?? { count: 0, literals: new Set() };
      entry.count += 1;
      for (const key of keyish) entry.literals.add(key);
      dynamicFiles.set(rel, entry);
    }
  }
  return { staticKeys, dynamicPrefixes, dynamicTemplates, dynamicFiles };
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_FILE)) {
    return { templates: new Map(), files: new Map() };
  }
  const data = JSON.parse(readFileSync(ALLOWLIST_FILE, "utf-8"));
  return {
    templates: new Map(
      (data.templates ?? []).map(item => [item.pattern, item.reason ?? ""])
    ),
    files: new Map(
      Object.entries(data.files ?? {}).map(([key, reason]) => [
        key,
        String(reason ?? "")
      ])
    )
  };
}

const zh = loadLocale(ZH_FILE);
const en = loadLocale(EN_FILE);
if (zh.error || en.error) {
  const [file, error] = zh.error ? [ZH_FILE, zh.error] : [EN_FILE, en.error];
  console.error(
    `[fail] YAML 解析失败（${relative(ROOT, file)}）：${String(error.message ?? error).split("\n")[0]}`
  );
  process.exit(1);
}

const zhLeaves = zh.leaves;
const enLeaves = en.leaves;
const references = collectReferences(walk(SRC_DIR));
const allowlist = loadAllowlist();

const missingZh = [];
const missingEn = [];
for (const [key, files] of references.staticKeys) {
  if (!zhLeaves.has(key)) missingZh.push([key, [...files].join(", ")]);
  if (!enLeaves.has(key)) missingEn.push([key, [...files].join(", ")]);
}

const onlyZh = [...zhLeaves.keys()].filter(key => !enLeaves.has(key));
const onlyEn = [...enLeaves.keys()].filter(key => !zhLeaves.has(key));

/** 同键的值类型 / 占位符 / 语法检查 */
const valueViolations = [];
for (const [key, zhLeaf] of zhLeaves) {
  const enLeaf = enLeaves.get(key);
  if (!enLeaf) continue;
  if (zhLeaf.type !== enLeaf.type) {
    valueViolations.push(
      `值类型不一致: ${key}（zh ${zhLeaf.type} / en ${enLeaf.type}）`
    );
    continue;
  }
  if (zhLeaf.type !== "string") continue;
  const zhValue = zhLeaf.value;
  const enValue = enLeaf.value;
  if (FULLWIDTH_BRACE_RE.test(zhValue) || FULLWIDTH_BRACE_RE.test(enValue)) {
    valueViolations.push(
      `全角花括号: ${key}（{ } 必须用半角，否则插值不生效）`
    );
  }
  const zhNames = placeholders(zhValue);
  const enNames = placeholders(enValue);
  const mismatch = [...zhNames].some(name => !enNames.has(name))
    ? [...zhNames].filter(name => !enNames.has(name))
    : [...enNames].filter(name => !zhNames.has(name));
  if (mismatch.length > 0) {
    valueViolations.push(
      `占位符不一致: ${key}（zh [${[...zhNames].join(", ")}] / en [${[...enNames].join(", ")}]）`
    );
  }
  for (const [lang, value] of [
    ["zh", zhValue],
    ["en", enValue]
  ]) {
    if (HTML_TAG_RE.test(value))
      valueViolations.push(`词条含 HTML 标签: ${key}（${lang}）`);
    const body = stripLiterals(value);
    if (/\|/.test(body))
      valueViolations.push(
        `词条含裸竖线: ${key}（${lang}；vue-i18n 当复数分隔符会截断正文，改用 {'|'}）`
      );
    if (/@/.test(body))
      valueViolations.push(
        `词条含裸 @: ${key}（${lang}；vue-i18n 当 linked message 语法，改用 {'@'}）`
      );
  }
}

/** 动态键：前缀族必须存在；无法静态解析的按 allowlist 登记 */
const dynamicViolations = [];
for (const [prefix, files] of references.dynamicPrefixes) {
  const hit = [...zhLeaves.keys()].some(key => key.startsWith(prefix));
  if (!hit && !allowlist.templates.has(`prefix:${prefix}`)) {
    dynamicViolations.push(
      `动态键前缀无命中: ${prefix}* <- ${[...files].join(", ")}（词条族不存在时界面会显示原始 key；新增族请先补词条）`
    );
  }
}
for (const [template, files] of references.dynamicTemplates) {
  const literal = template.slice(1, -1).split("${")[0];
  if (literal.lastIndexOf(".") >= 0) continue; // 已有前缀规则覆盖
  const reason = allowlist.templates.get(template);
  if (!reason) {
    dynamicViolations.push(
      `无静态前缀的动态模板未登记: ${template} <- ${[...files].join(", ")}（登记 scripts/i18n-dynamic-allowlist.json 的 templates 并写明理由）`
    );
  } else if (!reason.trim()) {
    dynamicViolations.push(`动态模板登记理由为空: ${template}`);
  }
}
for (const [rel, entry] of references.dynamicFiles) {
  for (const key of entry.literals) {
    if (!zhLeaves.has(key)) missingZh.push([key, rel]);
    if (!enLeaves.has(key)) missingEn.push([key, rel]);
  }
  if (entry.literals.size > 0) continue;
  const reason = allowlist.files.get(rel);
  if (reason === undefined) {
    dynamicViolations.push(
      `无法静态解析的 t() 调用未登记: ${rel}（${entry.count} 处；在 scripts/i18n-dynamic-allowlist.json 的 files 登记理由）`
    );
  } else if (!reason.trim()) {
    dynamicViolations.push(`文件登记理由为空: ${rel}`);
  }
}

/** 登记表腐烂检测（只提示，不失败） */
const staleTemplates = [...allowlist.templates.keys()].filter(
  pattern =>
    !pattern.startsWith("prefix:") && !references.dynamicTemplates.has(pattern)
);
const staleFiles = [...allowlist.files.keys()].filter(
  rel => !references.dynamicFiles.has(rel)
);

console.log(
  `国际化词条门禁：静态引用 ${references.staticKeys.size} 个 key；` +
    `zh ${zhLeaves.size} 条 / en ${enLeaves.size} 条；` +
    `动态前缀 ${references.dynamicPrefixes.size} 个、动态模板 ${references.dynamicTemplates.size} 个、` +
    `动态调用文件 ${references.dynamicFiles.size} 个。`
);

if (process.argv.includes("--report")) {
  console.log(
    `  缺 zh ${missingZh.length} / 缺 en ${missingEn.length} / 仅 zh ${onlyZh.length} / ` +
      `仅 en ${onlyEn.length} / 值级问题 ${valueViolations.length} / 动态键问题 ${dynamicViolations.length}`
  );
  process.exit(0);
}

const violations = [...dynamicViolations, ...valueViolations];
for (const [key, files] of missingZh.sort()) {
  violations.push(`缺少 zh 词条: ${key}  <- ${files}`);
}
for (const [key, files] of missingEn.sort()) {
  violations.push(`缺少 en 词条: ${key}  <- ${files}`);
}
for (const key of onlyZh.sort()) violations.push(`仅 zh 存在: ${key}`);
for (const key of onlyEn.sort()) violations.push(`仅 en 存在: ${key}`);

if (staleTemplates.length > 0 || staleFiles.length > 0) {
  console.log("提示（不失败，可清理登记表）：");
  for (const pattern of staleTemplates)
    console.log(`  - templates 已无使用: ${pattern}`);
  for (const rel of staleFiles) console.log(`  - files 已无动态调用: ${rel}`);
}

if (violations.length > 0) {
  console.error(
    "\n国际化词条门禁失败（缺词条会以 key 原文显示在界面上；zh/en 键集合与占位符必须对称；" +
      "词条含 HTML 标签、裸 | / @ 会让 vue-i18n 编译或渲染异常）："
  );
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}

console.log(
  "国际化词条门禁通过（引用全部命中，zh/en 键集合、类型与占位符对称，语法检查通过，动态键已登记）。"
);
