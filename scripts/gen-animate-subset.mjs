#!/usr/bin/env node
// animate.css 按需子集生成（构建期）：页面级自定义过渡（菜单元数据 transition_enter/leave）
// 与菜单动画选择器（ReAnimateSelector 的 animates 清单）是 animate__* 的唯一消费面，
// 清单即完整取值范围。本脚本从 animate.css 主文件（带 animate__ 前缀的构建版）按清单
// 提取所需规则，替代全量引入（源 ≈95KB），剔除清单外动画与全站未使用的修饰符
// （repeat-N / delay-Ns / slow 等）——deliberate 的「按需」只省这些。
//
// 提取规则：
//   - :root 的 --animate-* 变量，.animate__animated / .animate__infinite 基础类；
//     .animate__animated.animate__flip 是 flip 的动画定义（联合选择器书写），
//     仅当清单含 flip 时保留；
//   - 清单中每个动画的 .animate__<name> 类规则 + @keyframes / @-webkit-keyframes；
//   - @media print / prefers-reduced-motion 块（整块保留）。
//
// fail-closed：清单名在主文件缺失类规则或关键帧（上游改名 / 清单笔误）即退出码 1，
// 在构建期暴露而不是线上「类存在但不播动画」。
//
// 产物：src/style/animate-subset.css（gitignore 不入库）；postinstall + prebuild
// 自动再生成，vite 构建期 import 缺文件即失败（自检）。
// 守护测试：src/style/__tests__/animateSubset.spec.ts。
//
// 用法：node scripts/gen-animate-subset.mjs [--report]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = join(ROOT, "node_modules/animate.css/animate.css");
const ANIMATES_TS = join(
  ROOT,
  "src/components/ReAnimateSelector/src/animate.ts"
);
const OUT = join(ROOT, "src/style/animate-subset.css");
const reportOnly = process.argv.includes("--report");

// 依赖层镜像（Dockerfile-base）只带 scripts 与依赖清单、无 src 源码：源文件缺失
// 时跳过生成（与 gen-icon-subset 同口径），真实构建由 prebuild（有完整源码）
// 重新生成并保持 fail-closed（清单动画缺失仍退出码 1）。
if (!existsSync(ANIMATES_TS)) {
  console.log(
    "[animate-subset] 未找到 ReAnimateSelector/src/animate.ts（依赖层镜像无源码），跳过子集生成"
  );
  process.exit(0);
}

/** 清单：选择器可选项 = 页面级过渡的完整取值范围 */
const names = [
  ...readFileSync(ANIMATES_TS, "utf8").matchAll(/"([A-Za-z0-9]+)"/g)
].map(match => match[1]);

/** 无条件保留的基础规则 */
const BASE_SELECTORS = new Set([
  ".animate__animated",
  ".animate__animated.animate__infinite"
]);
/** flip 的动画定义用联合选择器书写（backface-visibility 须与 animated 同行生效） */
const FLIP_SELECTOR = ".animate__animated.animate__flip";

const source = postcss.parse(readFileSync(SOURCE, "utf8"));
const subset = postcss.root();
const classHit = new Set();
const frameHit = new Set();
let keptAnimations = 0;

source.each(node => {
  if (node.type === "comment") {
    subset.append(node.clone());
    return;
  }
  if (node.type === "rule") {
    const selector = node.selector.trim();
    if (selector === ":root" || BASE_SELECTORS.has(selector)) {
      subset.append(node.clone());
      return;
    }
    if (selector === FLIP_SELECTOR) {
      if (names.includes("flip")) {
        classHit.add("flip");
        subset.append(node.clone());
      }
      return;
    }
    const match = selector.match(/^\.animate__([A-Za-z0-9]+)$/);
    if (match && names.includes(match[1])) {
      classHit.add(match[1]);
      keptAnimations += 1;
      subset.append(node.clone());
    }
    return;
  }
  if (node.type === "atrule") {
    if (node.name === "media") {
      subset.append(node.clone());
      return;
    }
    const isKeyframes =
      node.name === "keyframes" || node.name === "-webkit-keyframes";
    if (isKeyframes && names.includes(node.params.trim())) {
      frameHit.add(node.params.trim());
      subset.append(node.clone());
    }
  }
});

const missingClasses = names.filter(name => !classHit.has(name));
const missingFrames = names.filter(name => !frameHit.has(name));
if (missingClasses.length || missingFrames.length) {
  console.error(
    `[animate-subset] 清单动画在 animate.css 主文件缺失：` +
      `类规则 [${missingClasses.join(", ")}] 关键帧 [${missingFrames.join(", ")}]`
  );
  process.exit(1);
}

const header = [
  "/* animate.css 按需子集（构建期生成，勿手工编辑）：",
  "   引入面与 ReAnimateSelector 的 animates 清单逐项一致。",
  "   生成脚本 scripts/gen-animate-subset.mjs；",
  "   守护测试 src/style/__tests__/animateSubset.spec.ts。 */",
  ""
].join("\n");
const output = `${header}${subset.toString()}\n`;

if (reportOnly) {
  console.log(
    `[animate-subset] 动画 ${keptAnimations} 个；源 ${source.toString().length} 字节` +
      ` → 子集 ${output.length} 字节`
  );
} else {
  writeFileSync(OUT, output);
  console.log(
    `[animate-subset] 已生成 ${OUT.replace(`${ROOT}/`, "")}：` +
      `动画 ${keptAnimations} 个 / ${output.length} 字节`
  );
}
