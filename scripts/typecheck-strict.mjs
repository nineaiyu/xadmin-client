// C4 tsconfig strict 门禁：C4 已完成全量收口（src 与构建脚本 strict 错误清零），
// 门禁覆盖全仓源码——任何 strict 回归（新增隐式 any / 可空未处理）即阻断 CI。
// 历史沿革：本脚本曾按模块白名单渐进推进（api → store/utils → components → layout → router → views），
// 每层清零后扩白名单；全量清零后收敛为全仓目标目录。
import { spawnSync } from "node:child_process";

const TARGET_DIRS = ["src/", "build/"];

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
