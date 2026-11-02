#!/usr/bin/env node
// 单函数行数门禁（≤100 行，与工作区红线一致）。
//
// 背景：工作区 AGENTS 把「单函数 ≤ 100 行」列为编码红线，但此前只有后端有对应脚本，
// 前端工厂函数（大屏编辑器、模板、仪表盘视图等）可以无限增长。本门禁按文件登记存量：
// - 新函数超过 100 行即失败（拆分而不是登记）；
// - 已登记函数继续增长即失败（只减不增）；
// - 降到阈值内即提示从基线移除。
//
// 口径：
// - 扫描面 src / build / scripts 下的 .ts / .tsx / .vue / .js / .mjs / .cjs；
//   tests 与 `__tests__`、`.spec.` 按门禁口径排除（测试替身不要求拆分）。
// - 函数形态：`function` 声明、`const name = (...) => {}` 箭头、类 / 对象方法简写；
//   行数 = 函数起始行到闭合花括号（含签名与多行参数）。
// - 匹配前把注释与字符串内容替换为空格（保留换行），避免注释/正则里的花括号干扰，
//   同时保证报错行号与源码一致。
//
// 用法：
//   node scripts/check-function-length.mjs            # 门禁（CI 用）
//   node scripts/check-function-length.mjs --report   # 仅报告分布
//   node scripts/check-function-length.mjs --update   # 登记/收敛基线（打印差异摘要）
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIRS = ["src", "build", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".vue", ".js", ".mjs", ".cjs"]);
const EXCLUDE_DIRS = new Set(["node_modules", "dist", "tests", "__tests__"]);
const BASELINE_PATH = join(ROOT, "scripts/function-length-baseline.json");
const MAX_LINES = 100;

/** 判断 `/` 是否为正则字面量起点（前一个有效字符是运算符/分隔符/关键字） */
function isRegexStart(chars, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(chars[cursor])) cursor -= 1;
  if (cursor < 0) return true;
  const prev = chars[cursor];
  if ("(=,:;[!&|?{}<>+-*%~^".includes(prev)) return true;
  if (/[A-Za-z0-9_$]/.test(prev)) {
    let start = cursor;
    while (start >= 0 && /[A-Za-z0-9_$]/.test(chars[start])) start -= 1;
    const word = chars.slice(start + 1, cursor + 1).join("");
    return [
      "return",
      "typeof",
      "case",
      "delete",
      "void",
      "new",
      "in",
      "of",
      "instanceof",
      "yield",
      "await"
    ].includes(word);
  }
  return false;
}

/** 注释与字符串内容替换为空格（保留换行），长度与原文一致 */
function maskCode(source) {
  const chars = source.split("");
  let index = 0;
  const blank = (from, to) => {
    for (let i = from; i < to && i < chars.length; i += 1) {
      if (chars[i] !== "\n") chars[i] = " ";
    }
  };
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      let cursor = index + 1;
      while (cursor < source.length) {
        if (source[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (source[cursor] === quote) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      blank(index, cursor);
      index = cursor;
      continue;
    }
    if (
      char === "/" &&
      next !== "/" &&
      next !== "*" &&
      isRegexStart(chars, index)
    ) {
      let cursor = index + 1;
      let inClass = false;
      while (cursor < source.length) {
        const current = source[cursor];
        if (current === "\\") {
          cursor += 2;
          continue;
        }
        if (current === "[") inClass = true;
        else if (current === "]") inClass = false;
        else if (current === "/" && !inClass) {
          cursor += 1;
          break;
        } else if (current === "\n") break;
        cursor += 1;
      }
      blank(index, cursor);
      index = cursor;
      continue;
    }
    if (char === "/" && next === "/") {
      let cursor = index;
      while (cursor < source.length && source[cursor] !== "\n") cursor += 1;
      blank(index, cursor);
      index = cursor;
      continue;
    }
    if (char === "/" && next === "*") {
      let cursor = index + 2;
      while (
        cursor < source.length &&
        !(source[cursor] === "*" && source[cursor + 1] === "/")
      )
        cursor += 1;
      cursor += 2;
      blank(index, cursor);
      index = cursor;
      continue;
    }
    index += 1;
  }
  return chars.join("");
}

function walk(dir, rows = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return rows;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      walk(full, rows);
    } else if (
      EXTENSIONS.has(extname(entry)) &&
      !entry.includes(".spec.") &&
      !entry.endsWith(".d.ts")
    ) {
      rows.push(full);
    }
  }
  return rows;
}

/** 从 `{` 起按花括号配对找函数体结束位置 */
function bodyEnd(masked, braceIndex) {
  let depth = 0;
  for (let i = braceIndex; i < masked.length; i += 1) {
    if (masked[i] === "{") depth += 1;
    else if (masked[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return masked.length - 1;
}

/** 跳过函数签名的圆括号，返回闭括号之后的位置 */
function afterParens(masked, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < masked.length; i += 1) {
    if (masked[i] === "(") depth += 1;
    else if (masked[i] === ")") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return masked.length;
}

/** 从签名之后找函数体起始 `{`：只接受「紧跟 `{`」或「返回类型注解后紧跟 `{`」 */
function findBodyBrace(masked, from) {
  let index = from;
  while (index < masked.length && /\s/.test(masked[index])) index += 1;
  if (masked[index] === "{") return index;
  if (masked[index] !== ":") return -1;
  index += 1;
  let depth = 0;
  while (index < masked.length) {
    const char = masked[index];
    if (char === "<") depth += 1;
    else if (char === ">") depth -= 1;
    else if (char === "{" && depth === 0) return index;
    else if (char === ";" || char === "=") return -1;
    else if (char === ">" && masked[index + 1] === ">") return -1;
    index += 1;
  }
  return -1;
}

const NON_FUNCTION_KEYWORDS = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "with",
  "do",
  "else",
  "return",
  "typeof",
  "new",
  "delete",
  "void",
  "await",
  "yield",
  "throw",
  "case",
  "in",
  "of",
  "function"
]);

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

/** 提取一个文件里的函数（名称 -> 起始索引 / 结束索引） */
function collectFunctions(source) {
  const masked = maskCode(source);
  const found = [];
  const seen = new Set();
  const push = (name, startIndex, bodyIndex) => {
    if (bodyIndex < 0) return;
    const endIndex = bodyEnd(masked, bodyIndex);
    const rangeKey = `${endIndex}:${name}`;
    // 同一函数可能被多种形态正则命中（函数声明也会被方法简写规则匹配），按「结尾位置 + 名称」去重
    if (seen.has(rangeKey)) return;
    seen.add(rangeKey);
    const signatureLine = lineAt(source, startIndex);
    const endLine = lineAt(source, endIndex);
    found.push({
      name: name || "<anonymous>",
      start: startIndex,
      end: endIndex,
      line: signatureLine,
      lines: endLine - signatureLine + 1
    });
  };

  // function 声明（含 export / async / 生成器）
  for (const match of masked.matchAll(
    /(?:^|[^\w$.])(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)?\s*(?:<[^>]*>)?\s*\(/g
  )) {
    const openParen = match.index + match[0].length - 1;
    const body = findBodyBrace(masked, afterParens(masked, openParen));
    push(match[1] ?? "<anonymous>", match.index, body);
  }

  // const / let / var 箭头函数
  for (const match of masked.matchAll(
    /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=\n]+)?=\s*(?:async\s+)?(?:<[^>]*>\s*)?(?:\([^()]*\)|[A-Za-z0-9_$]+)\s*(?::[^=\n]+)?=>\s*\{/g
  )) {
    const brace = match.index + match[0].length - 1;
    push(match[1], match.index, brace);
  }

  // 类 / 对象方法简写：`name(...) {`（排除控制流关键字与属性调用）
  for (const match of masked.matchAll(
    /(?:^|[^\w$])(?:public\s+|private\s+|protected\s+|static\s+|async\s+|readonly\s+|\*\s*)*([A-Za-z0-9_$]+)\s*(?:<[^>]*>)?\s*\(/g
  )) {
    const name = match[1];
    if (NON_FUNCTION_KEYWORDS.has(name)) continue;
    const openParen = match.index + match[0].length - 1;
    const nameStart = match.index + match[0].indexOf(name);
    let cursor = nameStart - 1;
    while (cursor >= 0 && /\s/.test(masked[cursor])) cursor -= 1;
    // `obj.method(...)` / `code.matchAll(...)` 是属性调用，不是方法定义
    if (masked[cursor] === ".") continue;
    const body = findBodyBrace(masked, afterParens(masked, openParen));
    push(name, match.index, body);
  }

  return found;
}

const files = SCAN_DIRS.flatMap(dir => walk(join(ROOT, dir)));
const current = {};
const rows = [];
for (const file of files) {
  const rel = relative(ROOT, file).split("\\").join("/");
  const source = readFileSync(file, "utf-8");
  for (const fn of collectFunctions(source)) {
    if (fn.lines <= MAX_LINES) continue;
    const key = `${rel}::${fn.name}`;
    const previous = current[key];
    if (previous === undefined || fn.lines > previous.lines) {
      current[key] = fn.lines;
    }
    rows.push({ key, ...fn, rel });
  }
}

const total = rows.length;
console.log(
  `函数行数门禁：扫描 ${files.length} 个文件，超过 ${MAX_LINES} 行的函数 ${total} 个（基线 ${Object.keys(current).length} 个）。`
);

if (process.argv.includes("--report")) {
  for (const row of rows.sort((a, b) => b.lines - a.lines)) {
    console.log(
      `  ${String(row.lines).padStart(4)}  ${row.rel}:${row.line ?? ""} ${row.name}`
    );
  }
  process.exit(0);
}

const payload = {
  note: "单函数 ≤100 行的存量基线（键 = 文件::函数名，值 = 行数，只减不增）。超限函数应拆分；确需登记的新增必须在提交说明给出理由。",
  functions: Object.fromEntries(
    Object.entries(current).sort(([a], [b]) => (a < b ? -1 : 1))
  )
};

if (process.argv.includes("--update")) {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  const previous = existsSync(BASELINE_PATH)
    ? readFileSync(BASELINE_PATH, "utf-8")
    : null;
  if (previous === serialized) {
    console.log(
      "函数行数基线与当前一致，未写入（--update 只在内容确有变化时落盘）。"
    );
    process.exit(0);
  }
  if (previous) {
    const before = JSON.parse(previous).functions ?? {};
    const diffs = [];
    for (const [key, lines] of Object.entries(payload.functions)) {
      if (before[key] === undefined)
        diffs.push(`+ ${key}: ${lines} 行（新增登记）`);
      else if (before[key] !== lines)
        diffs.push(`~ ${key}: ${before[key]} → ${lines} 行`);
    }
    for (const key of Object.keys(before)) {
      if (payload.functions[key] === undefined)
        diffs.push(`- ${key}（已降到阈值内）`);
    }
    console.log(`差异摘要（${diffs.length} 条）：`);
    for (const item of diffs) console.log(`  ${item}`);
  }
  writeFileSync(BASELINE_PATH, serialized);
  console.log(
    `已写回基线：scripts/function-length-baseline.json（${Object.keys(payload.functions).length} 个函数）`
  );
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? (JSON.parse(readFileSync(BASELINE_PATH, "utf-8")).functions ?? {})
  : {};

const violations = [];
for (const [key, lines] of Object.entries(current)) {
  if (baseline[key] === undefined) {
    violations.push(
      `${key}: ${lines} 行（超过 ${MAX_LINES}，未登记新增——请拆分函数）`
    );
  } else if (lines > baseline[key]) {
    violations.push(
      `${key}: ${lines} 行（超过基线 ${baseline[key]}，只减不增）`
    );
  }
}
const cleared = Object.keys(baseline).filter(key => current[key] === undefined);
if (cleared.length > 0) {
  console.log("以下函数已降到阈值内，可 --update 收敛基线：");
  for (const key of cleared.sort()) console.log(`  ${key}`);
}

if (violations.length > 0) {
  console.error(
    `\n函数行数门禁失败（单函数 ≤${MAX_LINES} 行；超限请按域拆分，而不是登记新增）：`
  );
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}
console.log("函数行数门禁通过（基线均未增长）。");
