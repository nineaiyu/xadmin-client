import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 字典消费统一入口守护（功能模块评估 §4.2「渲染契约守护扩展」）。
 *
 * 字典/状态渲染必须走 `@/utils/dict`（进程内 TTL 缓存 + `statusTagProps` /
 * `dictTagProps` 统一 tag props 口径）；页面直连 `@/api/system/dict` 会绕过缓存
 * 与彩色 tag 口径，历史上出现过列表渲染 `[object Object]`、与字典页配色不一致。
 *
 * 例外走登记制：新增例外必须在 ALLOWED 登记并写明理由。
 */

const SRC_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

/** 允许直连字典 API 的文件（相对 src/）*/
const ALLOWED = [
  "utils/dict.ts", // 统一入口自身
  "views/system/dict/utils/hook.tsx" // 字典维护页：需要排序/移动等管理动作
];

const SCAN_EXTENSIONS = [".ts", ".tsx", ".vue"];
// 只认值导入：`import { dataDictApi } from "@/api/system/dict"`
const FORBIDDEN = /from\s+"@\/api\/system\/dict"/;

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      collectFiles(full, acc);
    } else if (
      SCAN_EXTENSIONS.some(ext => entry.name.endsWith(ext)) &&
      !entry.name.includes(".spec.")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

describe("字典消费统一入口守护", () => {
  it("扫描范围自检（防路径失效导致守护空跑）", () => {
    expect(collectFiles(SRC_ROOT).length).toBeGreaterThan(200);
  });

  it("除登记例外外，源码不得直连 @/api/system/dict", () => {
    const offenders = collectFiles(SRC_ROOT)
      .filter(file => !ALLOWED.includes(path.relative(SRC_ROOT, file)))
      .filter(file => FORBIDDEN.test(fs.readFileSync(file, "utf8")))
      .map(file => path.relative(SRC_ROOT, file));

    expect(
      offenders,
      `以下文件直连字典 API（应改走 @/utils/dict，或在 ALLOWED 登记理由）：${offenders.join(", ")}`
    ).toEqual([]);
  });
});
