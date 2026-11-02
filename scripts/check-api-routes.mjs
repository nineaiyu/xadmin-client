#!/usr/bin/env node
// 前端 API 调用 ↔ 后端 OpenAPI 对账门禁（路径 + HTTP 方法）。
//
// 背景：手写 API 模块里的 URL 与后端路由没有静态校验——后端改了 url_path / 路由前缀
// 或删了某个方法（GET→POST），前端仍全绿，直到运行时 404/405。本脚本用已提交的
// contract/openapi.json 反查 src/api/**/*.ts 中出现的路径与请求方法：
//
// - 路径归一化：只认以 "/" 开头的字符串/模板字符串；"/system/..." 这类相对约定统一
//   补 "/api" 前缀（当前仓库 API 模块实际都写 "/api/..."，补前缀用于兼容二开代码）；
// - `${this.baseApi}` 按所在 class 的 `new XxxApi("/api/...")` 解析；
//   `${someApi.baseApi}` / `${api.baseApi}` 按文件内 `const someApi = new ...` 解析；
// - 其余 `${...}` 一律归一为 `{param}`，OpenAPI 的 `{id}` 同样按单段通配匹配；
// - 方法取自请求调用：`request("get", ...)` 的首参、`upload` → POST、
//   `autoDownload` / `download` → GET；落在调用参数之外的路径字面量（常量声明 /
//   API 基地址）只做路径存在性校验；
// - 无法静态解析的调用（`${this.baseApi}` 解析失败、非常量拼接）必须登记在
//   scripts/api-routes-unresolved-baseline.json（按文件计数，只减不增）——新增未登记
//   项直接失败，防止对账面被悄悄缩小。
//
// 白名单：scripts/api-routes-whitelist.json，只登记确认合法但不在 OpenAPI 的路径
// （外部地址、非 DRF 端点等），每条必须写 reason。
//
// 用法：
//   node scripts/check-api-routes.mjs             # 门禁
//   node scripts/check-api-routes.mjs --verbose   # 打印无法解析的明细与调用方法分布
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = path.join(ROOT, "src", "api");
const OPENAPI_FILE = path.join(ROOT, "contract", "openapi.json");
const WHITELIST_FILE = path.join(ROOT, "scripts", "api-routes-whitelist.json");
const UNRESOLVED_BASELINE_FILE = path.join(
  ROOT,
  "scripts",
  "api-routes-unresolved-baseline.json"
);

const verbose = process.argv.includes("--verbose");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") && !full.endsWith(".d.ts")) out.push(full);
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

function findMatching(code, openIndex, open = "(", close = ")") {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    if (code[i] === open) depth++;
    else if (code[i] === close) {
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
  for (const match of code.matchAll(
    /class\s*(?:(\w+)\s*)?(?:extends\s+\w+\s*)?\{/g
  )) {
    const bodyStart = match.index + match[0].length;
    const end = findMatching(code, bodyStart - 1, "{", "}");
    const body = code.slice(bodyStart, end);
    // 基地址来源一：构造函数里的 super("/api/...")
    let base = null;
    const superMatch = /super\s*\(\s*["']([^"']+)["']\s*\)/.exec(body);
    if (superMatch) base = superMatch[1];
    // 基地址来源二：匿名类表达式 new (class extends ... {})( "/api/..." )
    if (!base && /^\s*class/i.test(match[0]) && !match[1]) {
      const tail = /^\s*\)?\s*\(\s*["']([^"']+)["']\s*\)/.exec(
        code.slice(end + 1, end + 80)
      );
      if (tail) base = tail[1];
    }
    ranges.push({
      name: match[1] ?? null,
      start: bodyStart,
      end,
      base
    });
  }
  return ranges;
}

function classBaseAt(ranges, classBases, index) {
  const range = ranges.find(item => index >= item.start && index <= item.end);
  if (!range) return null;
  if (range.base) return range.base;
  if (!range.name) return null;
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

/**
 * 识别请求调用点与 HTTP 方法。
 *
 * - `request("get", ..., url)`：方法取首参字面量；
 * - `upload(...)` → post；`autoDownload(...)` / `download(...)` → get；
 * - `http.get(...)` 等直调形态同样识别。
 */
const CALL_NAMES = new Set(["request", "upload", "autoDownload", "download"]);
const DIRECT_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

/** 跳过类型参数 `<...>`（含嵌套泛型与 `{}` 对象类型），返回 `>` 之后的位置 */
function skipGenerics(code, index) {
  if (code[index] !== "<") return index;
  let depth = 0;
  for (; index < code.length; index++) {
    const char = code[index];
    if (char === "<") depth += 1;
    else if (char === ">") {
      depth -= 1;
      if (depth === 0) return index + 1;
    } else if (char === "(" || char === ";" || char === "=") {
      // 不是类型参数（比较运算符等），交回调用方判断
      return index;
    }
  }
  return index;
}

function collectCallSites(code) {
  const sites = [];
  for (const match of code.matchAll(/\b(\w+)\b/g)) {
    const name = match[1];
    if (!CALL_NAMES.has(name)) continue;
    let cursor = match.index + name.length;
    while (/\s/.test(code[cursor] ?? "")) cursor += 1;
    cursor = skipGenerics(code, cursor);
    while (/\s/.test(code[cursor] ?? "")) cursor += 1;
    if (code[cursor] !== "(") continue;
    const openParen = cursor;
    // 跳过非请求对象上的同名方法（如 store.request）无法区分，按调用名覆盖即可：
    // 仓库内 request/upload 仅出现在 API 层与 http 封装。
    let method = null;
    if (name === "request") {
      const tail = code.slice(openParen + 1, openParen + 80);
      const literal = /^\s*(["'])([a-z]+)\1/i.exec(tail);
      if (literal) method = literal[2].toLowerCase();
    } else if (name === "upload") method = "post";
    else method = "get";
    if (method && !DIRECT_METHODS.has(method)) method = null;
    sites.push({
      start: openParen,
      end: findMatching(code, openParen),
      method
    });
  }
  for (const match of code.matchAll(/\.(get|post|put|patch|delete)\s*\(/g)) {
    const openParen = match.index + match[0].length - 1;
    sites.push({
      start: openParen,
      end: findMatching(code, openParen),
      method: match[1]
    });
  }
  return sites;
}

function methodAt(sites, index) {
  const site = sites.find(item => index >= item.start && index <= item.end);
  return site ? site.method : null;
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
  const sites = collectCallSites(code);
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
    if (result.value) {
      result.method = methodAt(sites, match.index);
      found.push(result);
    } else if (result.reason) unresolved.push(result);
  }

  for (const match of code.matchAll(/(["'])(\/[^"'\n]+)\1/g)) {
    const value = normalizePath(match[2]);
    if (value) {
      found.push({
        value,
        file,
        line: lineOf(code, match.index),
        method: methodAt(sites, match.index)
      });
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
  const exact = new Map();
  const segments = [];
  for (const item of paths) {
    const methods = Object.keys(schema.paths[item] ?? {}).filter(key =>
      DIRECT_METHODS.has(key.toLowerCase())
    );
    exact.set(
      item,
      methods.map(key => key.toLowerCase())
    );
    segments.push({
      path: item,
      methods,
      segments: item.split("/").map(toSegment)
    });
  }
  const prefix = value => paths.some(item => item.startsWith(`${value}/`));

  return {
    count: paths.length,
    /**
     * 匹配口径：段数一致，且逐段相等或任一侧为参数通配（`*`）。
     * 另外接受「命名空间基地址」：UUID 不是端点但 OpenAPI 存在其子路径
     * （如 `/api/mfa` 下全是 action），前端把它当基地址是合法用法。
     * 返回 { ok, methods, namespace }。
     */
    match: value => {
      if (exact.has(value)) {
        return { ok: true, methods: exact.get(value), namespace: false };
      }
      const target = value.split("/").map(toSegment);
      const candidates = segments.filter(
        candidate =>
          candidate.segments.length === target.length &&
          candidate.segments.every(
            (segment, index) =>
              segment === "*" ||
              target[index] === "*" ||
              segment === target[index]
          )
      );
      if (candidates.length > 0) {
        const methods = [...new Set(candidates.flatMap(item => item.methods))];
        return { ok: true, methods, namespace: false };
      }
      if (prefix(value)) return { ok: true, methods: [], namespace: true };
      return { ok: false, methods: [], namespace: false };
    }
  };
}

function loadWhitelist() {
  if (!existsSync(WHITELIST_FILE)) return new Map();
  const data = JSON.parse(readFileSync(WHITELIST_FILE, "utf-8"));
  const entries = Array.isArray(data) ? data : (data.paths ?? []);
  return new Map(entries.map(item => [item.path, item.reason ?? ""]));
}

function loadUnresolvedBaseline() {
  if (!existsSync(UNRESOLVED_BASELINE_FILE)) return {};
  return (
    JSON.parse(readFileSync(UNRESOLVED_BASELINE_FILE, "utf-8")).unresolved ?? {}
  );
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
  const key = `${item.value}@${item.method ?? "*"}`;
  if (!unique.has(key)) unique.set(key, { ...item, sources: [] });
  unique.get(key).sources.push(`${item.file}:${item.line}`);
}

const missing = [];
const methodMissing = [];
const whitelisted = [];
for (const [key, item] of unique) {
  if (whitelist.has(item.value)) {
    whitelisted.push(item.value);
    continue;
  }
  const result = openapi.match(item.value);
  if (!result.ok) {
    missing.push(item);
    continue;
  }
  if (
    item.method &&
    !result.namespace &&
    result.methods.length > 0 &&
    !result.methods.includes(item.method)
  ) {
    methodMissing.push({ ...item, allowed: result.methods });
  }
}

const unresolvedByFile = {};
for (const item of unresolved) {
  if (!item.reason) continue;
  unresolvedByFile[item.file] = (unresolvedByFile[item.file] ?? 0) + 1;
}
const baseline = loadUnresolvedBaseline();
const unresolvedRegressions = [];
for (const [file, count] of Object.entries(unresolvedByFile)) {
  const allowed = baseline[file];
  if (allowed === undefined)
    unresolvedRegressions.push(`${file}: ${count} 处（未登记的文件）`);
  else if (count > allowed)
    unresolvedRegressions.push(
      `${file}: ${count} 处（基线 ${allowed}，只减不增）`
    );
}

if (verbose) {
  console.log(`[info] 无法静态解析（进入基线）${unresolved.length} 处：`);
  for (const item of unresolved.slice(0, 60)) {
    console.log(`  - ${item.file}:${item.line} ${item.reason}`);
  }
  console.log("[info] 请求方法分布：");
  const distribution = new Map();
  for (const item of calls) {
    const key = item.method ?? "未知方法";
    distribution.set(key, (distribution.get(key) ?? 0) + 1);
  }
  for (const [method, count] of distribution) {
    console.log(`  ${method}: ${count}`);
  }
  console.log(
    "[info] 未知方法的路径（未落在可识别的请求调用内，只做路径校验）："
  );
  const unknownByFile = new Map();
  for (const item of calls) {
    if (item.method) continue;
    unknownByFile.set(item.file, (unknownByFile.get(item.file) ?? 0) + 1);
  }
  for (const [file, count] of [...unknownByFile].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}  ${file}`);
  }
}

console.log(
  `[check-api-routes] OpenAPI ${openapi.count} 条；扫描 ${files.length} 个文件，` +
    `解析 ${calls.length} 处、去重 ${unique.size} 条（路径+方法）；` +
    `无法解析 ${unresolved.length} 处；白名单 ${whitelisted.length} 条；` +
    `缺失路径 ${missing.length} 条；方法缺失 ${methodMissing.length} 条。`
);

if (missing.length) {
  console.error("[fail] 前端调用了后端 OpenAPI 中不存在的路径：");
  for (const item of missing) {
    console.error(
      `  - ${item.value}${item.method ? ` (${item.method.toUpperCase()})` : ""}`
    );
    for (const source of item.sources.slice(0, 3))
      console.error(`      ${source}`);
  }
  console.error(
    "       确认是笔误就改前端；确属非 OpenAPI 端点（外部地址 / 非 DRF 路由）" +
      `请登记 ${path.relative(ROOT, WHITELIST_FILE)} 并写明 reason。`
  );
}

if (methodMissing.length) {
  console.error("[fail] 路径存在但 HTTP 方法不匹配（运行时 405）：");
  for (const item of methodMissing) {
    console.error(
      `  - ${item.value}: 前端 ${item.method.toUpperCase()} / 后端 ${item.allowed
        .map(method => method.toUpperCase())
        .join("、")}`
    );
    for (const source of item.sources.slice(0, 3))
      console.error(`      ${source}`);
  }
  console.error(
    "       后端已调整方法时改前端请求方法；如后端确应支持该方法，先更新服务端契约。"
  );
}

if (unresolvedRegressions.length) {
  console.error(
    "[fail] 无法静态解析的 API 调用出现未登记增长（对账面被缩小）："
  );
  for (const item of unresolvedRegressions) console.error(`  - ${item}`);
  console.error(
    `       新增动态拼接请改成可静态解析的常量路径；确属必要请在 ` +
      `${path.relative(ROOT, UNRESOLVED_BASELINE_FILE)} 登记并写明原因（只减不增）。`
  );
}

if (missing.length || methodMissing.length || unresolvedRegressions.length) {
  process.exit(1);
}

console.log(
  "[ok] 前端 API 路径与 HTTP 方法均存在于后端 OpenAPI（或已白名单登记），无法解析调用未增长。"
);
