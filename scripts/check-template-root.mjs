#!/usr/bin/env node
// 模板单根门禁：禁止 SFC 的 `<template>` 第一个节点是注释。
//
// 背景（已发生的真实故障，排查成本极高）：dev（vite）下模板注释会被保留，
// 根级注释会让组件的渲染结果变成「多根」—— dev 下根退化为带 DEV_ROOT_FRAGMENT
// 标记的 Fragment。布局用 `<Transition mode="out-in">` 包裹页面组件，而 Vue 的
// setTransitionHooks 递归对 Fragment 根无效（unmount 时 remove() 对 Fragment
// 提前 return，不处理 transition），于是：
//   离开该页面 → leave 永不完成 → BaseTransition 的 state.isLeaving 永不复位
//   → 之后每次渲染都返回空占位（`<!---->`）→ 内容区永久空白，
//   且此后切任何页面都白屏，只有刷新才能恢复。
//
// 约定：注释写在根元素内部即可（注释只给人看，不需要占据根级节点位置）。
//
// 用法：
//   node scripts/check-template-root.mjs            # 门禁（CI 用）
//   node scripts/check-template-root.mjs --report   # 仅报告，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const EXCLUDE_DIRS = new Set(["node_modules", "__tests__", "tests"]);

/** 匹配「<template> 换行之后、第一个非空节点是注释」 */
const ROOT_COMMENT = /<template>\s*\n[ \t]*<!--/;

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      rows.push(...walk(full));
    } else if (entry.endsWith(".vue")) {
      rows.push(full);
    }
  }
  return rows;
}

const violations = [];
for (const file of walk(join(ROOT, SCAN_DIR))) {
  const text = readFileSync(file, "utf-8");
  const match = ROOT_COMMENT.exec(text);
  if (!match) continue;
  // 行号 = 命中位置之前的换行数 + 1（指向注释所在行）
  const line = text.slice(0, match.index).split("\n").length;
  violations.push({
    rel: relative(ROOT, file).split("\\").join("/"),
    line: line + 1
  });
}

console.log(
  `模板根级注释门禁：扫描 ${SCAN_DIR}，命中 ${violations.length} 个文件。`
);

if (process.argv.includes("--report")) {
  for (const { rel, line } of violations) console.log(`  ${rel}:${line}`);
  process.exit(0);
}

if (violations.length > 0) {
  console.error(
    "\n模板根级注释门禁失败（根级注释在 dev 下会让组件变多根，" +
      '与布局的 <Transition mode="out-in"> 组合会导致离开该页面后整页白屏）：'
  );
  for (const { rel, line } of violations) {
    console.error(`  ${rel}:${line} — 把注释移入根元素内部`);
  }
  process.exit(1);
}
console.log("模板根级注释门禁通过。");
