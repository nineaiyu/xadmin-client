// C4 tsconfig strict 渐进开启门禁：只统计「已达标白名单目录」在 strict 下的错误。
//
// 背景：全仓 strict 存量债务约 350 处（views/layout/store 等），无法一次性开启。
// 本脚本基于 tsconfig.strict.json（strict: true）跑完整 program，但仅把
// 白名单目录（当前：src/api、src/utils）内的错误视为失败——达标模块一旦回归
// （新增隐式 any / 可空未处理）即阻断；存量目录的债务不计入，按模块推进后
// 再扩白名单（扩之前需先把该目录的 strict 错误清零）。
import { spawnSync } from "node:child_process";

const TARGET_DIRS = ["src/api/", "src/store/", "src/utils/", "src/components/", "src/layout/"];

const result = spawnSync(
  "npx vue-tsc --noEmit --skipLibCheck -p tsconfig.strict.json",
  { encoding: "utf-8", shell: true }
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const errorLines = output
  .split("\n")
  .filter(line => /^\S+\(\d+,\d+\): error TS/.test(line));
const inScope = errorLines.filter(line =>
  TARGET_DIRS.some(dir => line.startsWith(dir))
);
const outOfScopeCount = errorLines.length - inScope.length;

if (inScope.length > 0) {
  console.error(
    `[strict] 以下白名单目录存在 strict 错误（${inScope.length} 处，必须修复）：`
  );
  for (const line of inScope) console.error(`  ${line}`);
  process.exit(1);
}

console.log(
  `[strict] ${TARGET_DIRS.join("、")} 在 strict 下无错误` +
    `（白名单外存量债务 ${outOfScopeCount} 处，按模块推进，不计入门禁）`
);
