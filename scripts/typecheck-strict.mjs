// tsconfig strict 门禁：全仓源码（src / build / mock / types / e2e）在 strict 下必须零错误。
// 历史沿革：本脚本曾按目录白名单渐进推进（api → store/utils → components → layout → router → views），
// 全量清零（含 e2e 存量类型债）后收敛为全仓判定——任何 strict 回归即阻断 CI。
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx vue-tsc --noEmit --skipLibCheck -p tsconfig.strict.json",
  { encoding: "utf-8", shell: true }
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const errorLines = output
  .split("\n")
  .filter(line => /^\S+\(\d+,\d+\): error TS/.test(line));

if (errorLines.length > 0) {
  console.error(`[strict] strict 错误 ${errorLines.length} 处（必须修复）：`);
  for (const line of errorLines) console.error(`  ${line}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error("[strict] vue-tsc 非零退出但未解析到错误行，完整输出：");
  console.error(output.trim() || "(空输出)");
  process.exit(1);
}

console.log("[strict] 全仓（src / build / mock / types / e2e）strict 无错误");
