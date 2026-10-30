#!/usr/bin/env node
// 前端 API 路径 ↔ 后端 OpenAPI 对账门禁。
//
// 背景：手写 API 模块里的 URL 与后端路由没有静态校验——后端改了 url_path / 路由前缀，
// 前端仍全绿，直到运行时 404。本脚本用已提交的 contract/openapi.json 反查
// src/api/**/*.ts 中出现的路径，报告「前端调用、后端不存在」的条目。
//
// 归一化口径：
// - 只认以 "/" 开头的字符串/模板字符串；"/system/..." 这类相对约定统一补 "/api"
//   前缀（当前仓库 API 模块实际都写 "/api/..."，补前缀用于兼容二开代码）；
// - `${this.baseApi}` 按所在 class 的 `new XxxApi("/api/...")` 解析；
//   `${someApi.baseApi}` / `${api.baseApi}` 按文件内 `const someApi = new ...` 解析；
// - 其余 `${...}` 一律归一为 `{param}`，OpenAPI 的 `{id}` 同样按单段通配匹配；
// - 无法静态解析的拼接跳过并计数（不失败），明细用 --verbose 查看。
//
// 白名单：scripts/api-routes-whitelist.json，只登记确认合法但不在 OpenAPI 的路径
// （外部地址、非 DRF 端点等），每条必须写 reason。
//
// 用法：
//   node scripts/check-api-routes.mjs             # 门禁
//   node scripts/check-api-routes.mjs --verbose   # 打印无法解析的明细
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = path.join(ROOT, "src", "api");
const OPENAPI_FILE = path.join(ROOT, "contract", "openapi.json");
const WHITELIST_FILE = path.join(ROOT, "scripts", "api-routes-whitelist.json");

const verbose = process.argv.includes("--verbose");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** 去掉块注释与整行行注释：避免扫描到文档示例里的 URL */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "<!-- -->")
    .replace(/^[ \t]*\/\/[^\n]*/gm, "");
}

function lineOf(code, index) {
  return code.slice(0, index).split("\n").length;
}

function findMatchingBrace(code, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return code.length;
}

function collectClassBases(code) {
  const classBases = new Map();
  for (const match of code.matchAll(
    /new\s+(\w+)\s*\(\s*["']([^"']+)["']\s*\)/g
  )) {
    const [, className, base] = match;
    if (!className.endsWith("Api") || !base.startsWith("/")) continue;
    if (!classBases.has(className)) classBases.set(className, new Set());
    classBases.get(className).add(base);
  }
  return classBases;
}

function collectVarBases(code) {
  const varBases = [];
  for (const match of code.matchAll(
    /(?:const|let|var)\s+(\w+)\s*=\s*new\s+\w+\s*\(\s*["']([^"']+)["']\s*\)/g
  )) {
    varBases.push({
      name: match[1],
      base: match[2],
      index: match.index
    });
  }
  return varBases;
}

/** 取模板位置之前最近的一次同名变量赋值（避免函数内重复声明互相覆盖） */
function varBaseAt(varBases, name, index) {
  const candidates = varBases.filter(
    item => item.name === name && item.index < index
  );
  return candidates.length ? candidates[candidates.length - 1].base : null;
}

function collectClassRanges(code) {
  const ranges = [];
  for (const match of code.matchAll(/class\s+(\w+)[^{]*\{/g)) {
    const bodyStart = match.index + match[0].length;
    ranges.push({
      name: match[1],
      start: bodyStart,
      end: findMatchingBrace(code, bodyStart - 1)
    });
  }
  return ranges;
}

function classBaseAt(ranges, classBases, index) {
  const range = ranges.find(item => index >= item.start && index <= item.end);
  if (!range) return null;
  const bases = classBases.get(range.name);
  if (!bases || bases.size !== 1) return null;
  return [...bases][0];
}

function toSegment(segment) {
  return /^\{[^}]+\}$/.test(segment) ? "*" : segment;
}

function normalizePath(raw) {
  let value = raw.trim().split(/[?#]/)[0];
  if (!value.startsWith("/")) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return null;
  if (value !== "/api" && !value.startsWith("/api/")) value = `/api${value}`;
  value = value.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return value || "/";
}

function resolveTemplate(template, index, file, classBases, varBases, ranges) {
  let text = template;
  const unresolved = reason => ({
    file,
    line: lineOf(file.code, index),
    reason
  });

  if (text.includes("${this.baseApi}")) {
    const base = classBaseAt(ranges, classBases, index);
    if (!base) return unresolved("`${this.baseApi}` 无法解析到唯一基地址");
    text = text.replaceAll("${this.baseApi}", base);
  }

  let summary;
  while ((summary = /\$\{(\w+)\.baseApi\}/.exec(text))) {
    const base = varBaseAt(varBases, summary[1], index);
    if (!base)
      return unresolved(`\`\${${summary[1]}.baseApi}\` 无法解析基地址`);
    text = text.replaceAll(summary[0], base);
  }

  if (/\$\{/.test(text)) {
    text = text.replace(/\$\{[^}]*\}/g, "{param}");
  }
  return { value: normalizePath(text), file, line: lineOf(file.code, index) };
}

function collectPaths(file) {
  const code = stripComments(file.text);
  const classBases = collectClassBases(code);
  const varBases = collectVarBases(code);
  const ranges = collectClassRanges(code);
  const found = [];
  const unresolved = [];

  for (const match of code.matchAll(/`([^`]*)`/g)) {
    const body = match[1];
    if (!body.includes("/")) continue;
    const result = resolveTemplate(
      body,
      match.index,
      { ...file, code },
      classBases,
      varBases,
      ranges
    );
    if (result.value) found.push(result);
    else if (result.reason) unresolved.push(result);
  }

  for (const match of code.matchAll(/(["'])(\/[^"'\n]+)\1/g)) {
    const value = normalizePath(match[2]);
    if (value) {
      found.push({ value, file, line: lineOf(code, match.index) });
    }
  }
  return { found, unresolved };
}

function loadOpenApi() {
  if (!existsSync(OPENAPI_FILE)) {
    console.error(`[fail] 缺少 ${path.relative(ROOT, OPENAPI_FILE)}`);
    process.exit(1);
  }
  const schema = JSON.parse(readFileSync(OPENAPI_FILE, "utf-8"));
  const paths = Object.keys(schema.paths || {});
  const exact = new Set(paths);
  const segments = paths.map(item => item.split("/").map(toSegment));
  const prefix = value => paths.some(item => item.startsWith(`${value}/`));

  return {
    count: paths.length,
    /**
     * 匹配口径：段数一致，且逐段相等或任一侧为参数通配（`*`）。
     * 另外接受「命名空间基地址」：UUID 不是端点但 OpenAPI 存在其子路径
     * （如 `/api/mfa` 下全是 action），前端把它当基地址是合法用法。
     */
    has: value => {
      if (exact.has(value)) return true;
      const target = value.split("/").map(toSegment);
      if (
        segments.some(
          candidate =>
            candidate.length === target.length &&
            candidate.every(
              (segment, index) =>
                segment === "*" ||
                target[index] === "*" ||
                segment === target[index]
            )
        )
      ) {
        return true;
      }
      return prefix(value);
    }
  };
}

function loadWhitelist() {
  if (!existsSync(WHITELIST_FILE)) return new Map();
  const data = JSON.parse(readFileSync(WHITELIST_FILE, "utf-8"));
  const entries = Array.isArray(data) ? data : (data.paths ?? []);
  return new Map(entries.map(item => [item.path, item.reason ?? ""]));
}

const openapi = loadOpenApi();
const whitelist = loadWhitelist();
const files = walk(API_DIR);
const calls = [];
const unresolved = [];

for (const file of files) {
  const relative = path.relative(ROOT, file);
  const text = readFileSync(file, "utf-8");
  const result = collectPaths({ text });
  for (const item of result.found) {
    calls.push({ ...item, file: relative });
  }
  for (const item of result.unresolved) {
    unresolved.push({ ...item, file: relative });
  }
}

const unique = new Map();
for (const item of calls) {
  if (!unique.has(item.value)) unique.set(item.value, []);
  unique.get(item.value).push(`${item.file}:${item.line}`);
}

const missing = [];
const whitelisted = [];
for (const [value, sources] of unique) {
  if (openapi.has(value)) continue;
  if (whitelist.has(value)) whitelisted.push(value);
  else missing.push({ path: value, sources });
}

if (unresolved.length && verbose) {
  console.log(`[info] 无法静态解析（跳过）${unresolved.length} 处：`);
  for (const item of unresolved.slice(0, 50)) {
    console.log(`  - ${item.file}:${item.line} ${item.reason}`);
  }
}

console.log(
  `[check-api-routes] OpenAPI ${openapi.count} 条；扫描 ${files.length} 个文件，` +
    `解析 ${calls.length} 处、去重 ${unique.size} 条路径；` +
    `无法解析 ${unresolved.length} 处；白名单 ${whitelisted.length} 条；缺失 ${missing.length} 条。`
);

if (missing.length) {
  console.error("[fail] 前端调用了后端 OpenAPI 中不存在的路径：");
  for (const item of missing) {
    console.error(`  - ${item.path}`);
    for (const source of item.sources.slice(0, 3))
      console.error(`      ${source}`);
  }
  console.error(
    "       确认是笔误就改前端；确属非 OpenAPI 端点（外部地址 / 非 DRF 路由）" +
      `请登记 ${path.relative(ROOT, WHITELIST_FILE)} 并写明 reason。`
  );
  process.exit(1);
}

console.log("[ok] 前端 API 路径均存在于后端 OpenAPI（或已白名单登记）");
