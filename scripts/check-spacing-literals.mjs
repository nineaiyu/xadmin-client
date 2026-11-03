#!/usr/bin/env node
// 设计尺度字面量门禁（只减不增）：禁止在消费端新增「刻度外间距 px、裸字重、
// 档位外行高、裸 box-shadow、阶梯外 z-index」。
//
// 口径：尺度单一来源为 tokens/primitives.scss——
//   间距刻度（margin/padding/gap/inset/top/right/bottom/left）：
//     0 1 2 4 6 8 10 12 14 16 20 24 32 40（1-2px 属描边/微调宽限）；
//     刻度内也应优先 var(--space-*) 或 Tailwind 数值类（由 --spacing 派生）。
//   字重：只许 var(--font-weight-*)（400/500/600/700 裸数字一律拦）。
//   行高：无单位字面量只许 0/1 与五档（1.25/1.375/1.5/1.625/1.75），
//     px 行高属「定高行」技巧不拦。
//   box-shadow：只许 var(--shadow-*) / none；currentcolor 点阵等特效登记基线。
//   z-index：>100 的层级只许 var(--z-index-*)（0~10 为组件内部私有叠放）。
//   模板任意值类：[Npx] 中 N 不在刻度内即拦（含 width/height 类）。
//
// 豁免：tokens/**（定义处）、assets/iconfont/**（三方生成物）、src/tests/、
//       *.spec.*，以及下方 BASELINE 登记的存量（按文件计数，只减不增）。
//
// 用法：
//   node scripts/check-spacing-literals.mjs            # 门禁（CI 用）
//   node scripts/check-spacing-literals.mjs --report   # 仅报告分布，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const EXCLUDE_DIRS = new Set(["node_modules", "__tests__"]);
const EXCLUDE_PATHS = [
  "src/style/tokens/",
  "src/assets/iconfont/",
  "src/tests/"
];

/** 合法间距刻度（含 1-2px 描边/微调宽限） */
const SCALE = new Set([0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40]);
/** 合法无单位行高（0 = 闭合行盒技巧；1 = 单行） */
const LINE_HEIGHTS = new Set([0, 1, 1.25, 1.375, 1.5, 1.625, 1.75]);

const GROUPS = [
  {
    name: "spacing",
    hint: "间距刻度外 px——改 var(--space-*) / Tailwind 数值类",
    pattern:
      /(?:margin|padding|inset)(?:-(?:top|right|bottom|left))?|(?:row-|column-)?gap|top|right|bottom|left/g,
    // 逐条声明提取数值：仅当声明值整体为 px 字面量（或空格分隔的 px 组）时检查
    check(line) {
      const m = line.match(
        /(?:margin|padding|inset)(?:-(?:top|right|bottom|left))?\s*:\s*([^;{}]+);|(?:row-|column-)?gap\s*:\s*([^;{}]+);|\b(?:top|right|bottom|left)\s*:\s*([^;{}]+);/
      );
      if (!m) return 0;
      const value = m[1] ?? m[2] ?? m[3] ?? "";
      if (value.includes("var(") || value.includes("calc(")) return 0;
      let n = 0;
      for (const v of value.match(/-?\d+(?:\.\d+)?px/g) ?? []) {
        const abs = Math.abs(parseFloat(v));
        if (abs >= 9999) continue; // 屏外隐藏 / 离屏测量技巧
        if (!SCALE.has(abs)) n++;
      }
      return n;
    }
  },
  {
    name: "font-weight",
    hint: "裸字重数字——改 var(--font-weight-normal|medium|semibold|bold)",
    check(line) {
      return (line.match(/font-weight:\s*\d+/g) ?? []).length;
    }
  },
  {
    name: "line-height",
    hint: "档位外行高——改 var(--line-height-none|tight|snug|normal|relaxed|loose)",
    check(line) {
      let n = 0;
      for (const m of line.matchAll(/line-height:\s*([0-9.]+)(?![\w.])/g)) {
        if (!LINE_HEIGHTS.has(parseFloat(m[1]))) n++;
      }
      return n;
    }
  },
  {
    name: "box-shadow",
    hint: "裸 box-shadow——改 var(--shadow-*) 或登记语义令牌",
    check(line) {
      const m = line.match(/box-shadow:\s*([^;]+);/);
      if (!m) return 0;
      const v = m[1];
      if (v.includes("var(") || /^\s*none(\s*!important)?\s*$/.test(v))
        return 0;
      // currentcolor 点阵加载动画等特效：值不含颜色字面量时按特效放行
      if (/currentcolor/i.test(v) && !/#|rgb\(|hsl\(/.test(v)) return 0;
      return 1;
    }
  },
  {
    name: "z-index",
    hint: "阶梯外 z-index——改 var(--z-index-*)（0~10 局部叠放不拦）",
    check(line) {
      let n = 0;
      for (const m of line.matchAll(/z-index:\s*(\d+)/g)) {
        if (parseInt(m[1], 10) > 100) n++;
      }
      return n;
    }
  },
  {
    name: "arbitrary-px",
    hint: "模板间距任意值 [Npx] 刻度外——改 Tailwind 数值类或令牌",
    check(line) {
      let n = 0;
      for (const m of line.matchAll(
        /(?:^|[\s"'`])(?:[a-z-]+:)*(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|inset|inset-x|inset-y|top|right|bottom|left)-\[(-?\d+(?:\.\d+)?)px\]/g
      )) {
        const abs = Math.abs(parseFloat(m[1]));
        if (abs >= 9999) continue;
        if (!SCALE.has(abs)) n++;
      }
      return n;
    }
  }
];

/**
 * 存量基线：相对路径 -> 条数（只减不增；清零后从本表移除），逐条注明原因。
 * 注意：新增业务代码不得进入本表。
 */
const BASELINE = {
  // 大屏自由画布内部叠放（导轨/吸附线层 900/901/999）：画布为私有层叠上下文
  "src/views/analysis/screen/components/FreeCanvasBoard.vue": 3,
  // 跳转链接（skip-link）屏外预定位：聚焦时滑入视口
  "src/layout/components/lay-content/index.vue": 1,
  // html 基准行高 1.15（排版基线，正文容器须显式选档；见 reset.scss 注释）
  "src/style/reset.scss": 1
};

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      rows.push(...walk(full));
    } else if (/\.(vue|scss|css|ts|tsx)$/.test(entry)) {
      rows.push(full);
    }
  }
  return rows;
}

/** 剥离注释：避免把文档/说明里的示例计入 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function countLiterals(file) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (rel.includes(".spec.")) return { rel, count: 0 };
  if (EXCLUDE_PATHS.some(prefix => rel.startsWith(prefix))) {
    return { rel, count: 0 };
  }
  const text = stripComments(readFileSync(file, "utf-8"));
  let count = 0;
  for (const line of text.split("\n")) {
    for (const group of GROUPS) {
      count += group.check(line);
    }
  }
  return { rel, count };
}

const rows = walk(join(ROOT, SCAN_DIR))
  .map(countLiterals)
  .filter(row => row.count > 0)
  .sort((a, b) => b.count - a.count || a.rel.localeCompare(b.rel));

const total = rows.reduce((sum, row) => sum + row.count, 0);
console.log(
  `设计尺度字面量门禁：扫描 ${SCAN_DIR}，命中 ${rows.length} 个文件 / ${total} 处（基线 ${Object.keys(BASELINE).length} 个文件）。`
);

if (process.argv.includes("--report")) {
  for (const { rel, count } of rows) {
    console.log(`  ${String(count).padStart(3)}  ${rel}`);
  }
  process.exit(0);
}

const violations = [];
for (const { rel, count } of rows) {
  const allowed = BASELINE[rel];
  if (allowed === undefined) {
    violations.push(`${rel}: ${count} 处（未登记的尺度字面量——改走设计令牌）`);
  } else if (count > allowed) {
    violations.push(`${rel}: ${count} 处（超过基线 ${allowed}，只减不增）`);
  }
}
const cleared = Object.keys(BASELINE).filter(
  rel => !rows.some(row => row.rel === rel)
);
if (cleared.length > 0) {
  console.log("以下文件已无尺度字面量，可从 BASELINE 移除：");
  for (const rel of cleared.sort()) console.log(`  ${rel}`);
}

if (violations.length > 0) {
  console.error(
    "\n设计尺度字面量门禁失败（尺度唯一来源为 tokens/primitives.scss）："
  );
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}
console.log("设计尺度字面量门禁通过（基线均未增长）。");
