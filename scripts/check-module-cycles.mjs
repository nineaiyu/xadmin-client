#!/usr/bin/env node
/**
 * 模块循环导入检测（前端源码图）。
 *
 * 目的：静态导入图出现环时，环内模块的顶层求值顺序取决于加载入口，
 * 类继承（extends）等「基类必须先完成初始化」的引用会在特定入口序下求值失败。
 * 本脚本把 `src/` 下的静态导入图建出来，找出强连通分量（SCC）并报警。
 *
 * 规则：
 * - 只取顶层静态导入/再导出（`import ... from`、`export ... from`、副作用 `import "x"`）；
 * - 跳过纯类型导入（`import type`、`export type`，以及 `import { type A, type B }` 全类型形态）；
 *   类型导入在编译期擦除，不产生运行期依赖；
 * - 跳过动态 `import("...")`（运行期按需加载，不参与顶层求值顺序）；
 * - `@/` 解析为 `src/`，相对路径按文件目录解析；裸包名（第三方依赖）不计入；
 * - `.vue` 只解析 `<script>` 块，模板不参与。
 *
 * 输出（两部分）：
 * 1) 结构性策略校验：见 FORBIDDEN_EDGES（本次修复的核心不变量）；
 * 2) 全部初等环清单（含豁免标记）；
 * 任一部分不通过即以非零退出码退出。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(repoRoot, "src");

const SCAN_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue"
]);
const RESOLVE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue"];
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git"]);

/* ------------------------------------------------------------------ *
 * 结构性策略：这些静态边一旦出现即视为回归（优先级高于环清单豁免）。
 * `from 属于前缀 → to 属于前缀` 且目标传递依赖 `toReaches` 中任一节点时命中。
 * 目标若是纯叶子 api 模块（如 api/types.ts，无任何依赖），不构成环，放行。
 * ------------------------------------------------------------------ */
const FORBIDDEN_EDGES = [
  {
    from: "src/store/",
    to: "src/api/",
    toReaches: ["src/api/base.ts", "src/utils/http/index.ts"],
    reason:
      "store 层顶层静态引用「依赖 http 链路」的 api 模块会形成 api/base → utils/http → utils/auth → store → api/auth → api/base 类环；store 调用这类 api 一律在动作内动态 import()。"
  }
];

/* ------------------------------------------------------------------ *
 * 环清单豁免（仅用于已知、且不在本次可改文件范围内的存量环）。
 *
 * 每条豁免是一个对象：{ path | members, batch, reason, since }
 * - kind=prefix：环内【任一】节点命中 path 前缀即豁免（组件内部环）；
 * - kind=node  ：环内【任一】节点命中 path 精确路径即豁免（跨层反向边枢纽）；
 * - kind=cycle ：成员相对路径排序后与 members 完全一致即豁免（精确存量环）。
 *
 * batch 为语义批次标签（非台账编号），reason 说明为何暂不改动，since 登记日期。
 * 为向后兼容也接受字符串条目：等价于 { path }（batch 记为 unlabeled）。
 * 注意：命中豁免的环不再计入退出码；FORBIDDEN_EDGES 仍独立生效，
 * 因此核心环回归不会被下面的豁免掩盖。
 * ------------------------------------------------------------------ */
const EXEMPT_PREFIX = [
  {
    path: "src/components/",
    batch: "components-internal",
    reason:
      "组件目录内部 index.ts ↔ index.vue / 工具互引，属组件封装自洽，不在跨层收敛范围。",
    since: "2026-10-09"
  }
];
const EXEMPT_NODES = [];
const ALLOWED_CYCLES = [];

/** 兼容字符串写法：{ path } / { members } 归一 */
function normalizeExempt(entry) {
  if (typeof entry === "string") {
    return { path: entry, batch: "unlabeled", reason: "", since: "" };
  }
  return entry;
}

/** 归一后的查找结构（前缀表 / 节点 map / 精确环签名 map） */
const exemptPrefixList = EXEMPT_PREFIX.map(normalizeExempt);
const exemptNodeByPath = new Map(
  EXEMPT_NODES.map(entry => {
    const normalized = normalizeExempt(entry);
    return [normalized.path, normalized];
  })
);
const allowedCycleByKey = new Map(
  ALLOWED_CYCLES.map(entry =>
    Array.isArray(entry)
      ? [entry.join("|"), { members: entry, batch: "unlabeled", reason: "" }]
      : [entry.members.join("|"), entry]
  )
);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (SCAN_EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** 去掉块注释与整行注释，避免注释里的 import 被误判 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)([ \t]*)\/\/[^\n]*/g, "$1$2");
}

/** 提取待分析的脚本内容：.vue 只取 <script> 块，其余取全文 */
function extractScript(file, raw) {
  if (!file.endsWith(".vue")) return raw;
  const blocks = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(raw)) !== null) blocks.push(m[1]);
  return blocks.join("\n");
}

/** 判断 import/export 子句是否纯类型（编译期擦除） */
function isTypeOnlyClause(clause) {
  const c = clause.trim();
  if (/^type\b/.test(c)) return true;
  const braces = c.match(/\{([\s\S]*)\}/);
  if (!braces) return false;
  const parts = braces[1]
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every(p => /^type\b/.test(p));
}

const STATEMENT_RE =
  /(?:^|\n)[ \t]*(import|export)\s+([A-Za-z0-9_$*{},\s]*?)\s*from\s*["']([^"']+)["']/g;
const SIDE_EFFECT_RE = /(?:^|\n)[ \t]*import\s*["']([^"']+)["']/g;

/** 提取一个文件的静态导入目标（未解析的原始说明符 + 是否运行期依赖） */
function collectSpecifiers(file, raw) {
  const code = stripComments(extractScript(file, raw));
  const specs = [];
  let m;
  STATEMENT_RE.lastIndex = 0;
  while ((m = STATEMENT_RE.exec(code)) !== null) {
    if (isTypeOnlyClause(m[2])) continue;
    specs.push(m[3]);
  }
  SIDE_EFFECT_RE.lastIndex = 0;
  while ((m = SIDE_EFFECT_RE.exec(code)) !== null) {
    specs.push(m[1]);
  }
  return specs;
}

const resolveCache = new Map();

/** 把导入说明符解析为仓库内文件路径；第三方/无法解析返回 null */
function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) {
    base = path.join(srcRoot, spec.slice(2));
  } else if (spec.startsWith("./") || spec.startsWith("../")) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else {
    return null;
  }
  const key = base;
  if (resolveCache.has(key)) return resolveCache.get(key);
  let resolved = null;
  if (fs.existsSync(base) && fs.statSync(base).isFile()) {
    resolved = base;
  } else {
    for (const ext of RESOLVE_EXTS) {
      if (fs.existsSync(base + ext)) {
        resolved = base + ext;
        break;
      }
    }
    if (!resolved) {
      for (const ext of RESOLVE_EXTS) {
        const idx = path.join(base, "index" + ext);
        if (fs.existsSync(idx)) {
          resolved = idx;
          break;
        }
      }
    }
  }
  resolveCache.set(key, resolved);
  return resolved;
}

function buildGraph() {
  const files = walk(srcRoot);
  const rel = new Map();
  for (const f of files) rel.set(f, path.relative(repoRoot, f));
  const adj = new Map();
  for (const f of files) adj.set(f, []);
  for (const f of files) {
    const raw = fs.readFileSync(f, "utf8");
    for (const spec of collectSpecifiers(f, raw)) {
      const target = resolveSpecifier(spec, f);
      // 只保留落在扫描集内的边（相对路径可能解析到 src 之外）
      if (target && target !== f && adj.has(target)) adj.get(f).push(target);
    }
  }
  return { files, rel, adj };
}

/** 单次枚举上限，防止超大环簇下指数级展开 */
const MAX_CYCLES = 500;
const MAX_STEPS = 4_000_000;

/**
 * 枚举初等环（边不重复、节点不重复的简单环）。
 *
 * 以「最小节点索引」为每个环的起点做 DFS：只允许访问索引 ≥ 起点的节点，
 * 回到起点即记录。这样每个初等环恰好被记录一次（起点即环内最小索引节点）。
 */
function findElementaryCycles(nodes, adj) {
  const index = new Map(nodes.map((n, i) => [n, i]));
  const cycles = [];
  let steps = 0;
  let truncated = false;

  for (let s = 0; s < nodes.length; s++) {
    if (truncated) break;
    const start = nodes[s];
    const path = [start];
    const onPath = new Set([start]);

    const dfs = node => {
      for (const next of adj.get(node) ?? []) {
        if (++steps > MAX_STEPS) {
          truncated = true;
          return;
        }
        if (next === start) {
          if (path.length > 1) {
            cycles.push([...path, start]);
            if (cycles.length >= MAX_CYCLES) {
              truncated = true;
              return;
            }
          }
          continue;
        }
        // 只走索引 ≥ 起点的节点：保证起点是环内最小索引，避免同一环重复计数
        if (index.get(next) < s) continue;
        if (onPath.has(next)) continue;
        onPath.add(next);
        path.push(next);
        dfs(next);
        path.pop();
        onPath.delete(next);
        if (truncated) return;
      }
    };

    dfs(start);
  }

  return { cycles, truncated, steps };
}

/** 环的规范化签名（去掉首尾重复的起点，排序成员） */
function cycleSignature(members) {
  return [...members].sort().join("|");
}

/** 反向可达集：所有（传递）指向 refs 的节点（含 refs 自身） */
function collectAncestors(nodes, adj, refs) {
  const radj = new Map();
  for (const n of nodes) radj.set(n, []);
  for (const n of nodes) {
    for (const t of adj.get(n) ?? []) radj.get(t)?.push(n);
  }
  const seen = new Set(refs.filter(r => radj.has(r)));
  const queue = [...seen];
  while (queue.length) {
    const n = queue.shift();
    for (const p of radj.get(n) ?? []) {
      if (!seen.has(p)) {
        seen.add(p);
        queue.push(p);
      }
    }
  }
  return seen;
}

/** 结构性策略校验：命中的静态边（返回违规描述数组） */
function checkForbiddenEdges(nodes, adj, rel) {
  const violations = [];
  const ancestorCache = new Map();
  const ancestorsFor = refs => {
    const key = refs.join("|");
    if (!ancestorCache.has(key)) {
      ancestorCache.set(key, collectAncestors(nodes, adj, refs));
    }
    return ancestorCache.get(key);
  };
  // FORBIDDEN_EDGES 里登记的是仓库相对路径，而图节点是绝对路径，
  // 必须先归一化再查反向可达集，否则规则恒不命中（形同装饰）。
  const refToAbs = p => path.join(repoRoot, p);
  for (const [from, targets] of adj) {
    const fromRel = rel.get(from);
    for (const rule of FORBIDDEN_EDGES) {
      if (!fromRel.startsWith(rule.from)) continue;
      const ancestors = rule.toReaches?.length
        ? ancestorsFor(rule.toReaches.map(refToAbs))
        : null;
      for (const t of targets) {
        const toRel = rel.get(t);
        if (!toRel || !toRel.startsWith(rule.to)) continue;
        if (ancestors && !ancestors.has(t)) continue;
        violations.push(`${fromRel} → ${toRel}\n    原因：${rule.reason}`);
      }
    }
  }
  return violations;
}

/**
 * 判定一条环的豁免归属。
 * 命中顺序：精确环签名 → 节点前缀 → 精确节点。返回命中的豁免条目（未命中返回 null）。
 */
function exemptionFor(members, sig) {
  const cycleEntry = allowedCycleByKey.get(sig);
  if (cycleEntry) return { ...cycleEntry, kind: "cycle" };
  for (const m of members) {
    const pref = exemptPrefixList.find(e => m.startsWith(e.path));
    if (pref) return { ...pref, kind: "prefix", matched: m };
    const node = exemptNodeByPath.get(m);
    if (node) return { ...node, kind: "node", matched: m };
  }
  return null;
}

const REPORT = process.argv.includes("--report");
const JSON_OUT = process.argv.includes("--json");

function main() {
  const { files, rel, adj } = buildGraph();
  const { cycles, truncated, steps } = findElementaryCycles(files, adj);

  // 1) 结构性策略
  const edgeViolations = checkForbiddenEdges(files, adj, rel);

  // 2) 初等环清单（豁免项仅作展示，不计入退出码）
  const seen = new Set();
  const results = [];
  const batchCounts = new Map();
  let offending = 0;
  let exemptCount = 0;

  for (const cycle of cycles) {
    const members = cycle.slice(0, -1).map(n => rel.get(n));
    const sig = cycleSignature(members);
    if (seen.has(sig)) continue;
    seen.add(sig);
    const exemption = exemptionFor(members, sig);
    const ignored = exemption !== null;
    if (ignored) {
      exemptCount++;
      const batch = exemption.batch;
      batchCounts.set(batch, (batchCounts.get(batch) ?? 0) + 1);
    } else {
      offending++;
    }
    results.push({
      members: cycle.map(n => rel.get(n)),
      exempt: ignored,
      exemptBy: exemption
        ? {
            kind: exemption.kind,
            batch: exemption.batch,
            path: exemption.path,
            members: exemption.members,
            matched: exemption.matched
          }
        : null
    });
  }

  const summary = {
    scannedFiles: files.length,
    cycles: seen.size,
    offending,
    exempted: exemptCount,
    truncated,
    steps,
    batches: Object.fromEntries(
      [...batchCounts.entries()].sort((a, b) => b[1] - a[1])
    ),
    edgeViolations
  };

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          summary,
          forbiddenEdgeViolations: edgeViolations,
          cycles: results
        },
        null,
        2
      )
    );
    if (edgeViolations.length > 0 || offending > 0) process.exit(1);
    return;
  }

  console.log("== 结构性策略校验（禁止的静态边）==");
  if (edgeViolations.length === 0) {
    console.log("通过：未发现禁止的顶层静态边。");
  } else {
    for (const v of edgeViolations) console.log(`  违规：${v}`);
  }

  console.log(
    `\n== 初等环清单 ==\n扫描 ${files.length} 个源码文件，发现 ${cycles.length} 个初等环` +
      `${truncated ? `（已达上限，仅展开 ${steps} 步）` : ""}。`
  );

  for (const item of results) {
    if (!REPORT && item.exempt) continue;
    const cycle = item.members;
    console.log(
      `\n[${item.exempt ? "已豁免" : "环"}] ${cycle.length - 1} 个模块：`
    );
    console.log(`  ${cycle[0]}`);
    for (let i = 1; i < cycle.length; i++) {
      console.log(`  → ${cycle[i]}`);
    }
    if (item.exempt && item.exemptBy) {
      const by = item.exemptBy;
      const who =
        by.kind === "cycle"
          ? `精确环（${(by.members ?? []).join(", ")}）`
          : `${by.kind === "prefix" ? "前缀" : "节点"} ${by.matched}`;
      console.log(`  ← 豁免归属：${who} · 批次 ${by.batch}`);
    }
  }

  console.log(
    `\n合计：${seen.size} 个初等环（未豁免 ${offending} 个，已豁免 ${exemptCount} 个）。`
  );
  console.log("批次豁免分布：");
  if (batchCounts.size === 0) {
    console.log("  （无）");
  } else {
    for (const [batch, count] of [...batchCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`  ${batch}: ${count}`);
    }
  }

  if (truncated) {
    console.error(
      "注意：枚举达到上限（环数量过多），输出可能不完整——请优先破除已列出的环。"
    );
  }

  if (edgeViolations.length > 0 || offending > 0) {
    console.error(
      "\n检测未通过：请破除上述环 / 静态边，或在脚本顶部登记豁免（附原因）。"
    );
    process.exit(1);
  }
  console.log("\n检测通过：结构性策略与环清单均无未豁免项。");
}

main();
