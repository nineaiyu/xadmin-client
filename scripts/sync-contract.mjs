// 契约一键同步：服务端 docs/schema（唯一真源）→ 本仓 contract/schema 镜像 → 重新生成 TS 类型。
//
// 用法：pnpm sync:contract
// 服务端目录默认取 ../xadmin-server（两仓同工作区约定），可用 XADMIN_SERVER_DIR 覆盖。
// 与 check:contract 的分工：
//   - 本脚本负责"写"：拷镜像 + pnpm gen:metadata-types；
//   - check:contract 负责"读"：CI 校验镜像与服务端一致（防止绕过本脚本手改镜像）。
// 找不到服务端契约源时直接失败（同步是显式动作，静默跳过会给出"已同步"的假象）。
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const SCHEMA_NAMES = [
  "search-columns",
  "search-fields",
  "api-response",
  "routes-payload",
  "ws-frame"
];

const mirrorDir = path.resolve("contract", "schema");
const serverDir = path.resolve(
  process.env.XADMIN_SERVER_DIR ?? "../xadmin-server"
);
const sourceDir = path.join(serverDir, "docs", "schema");

if (!existsSync(sourceDir)) {
  console.error(
    `[fail] 未找到服务端契约源：${sourceDir}\n` +
      "       契约唯一真源在 xadmin-server 的 docs/schema；\n" +
      "       请把两个仓库放在同一工作区，或设置 XADMIN_SERVER_DIR 指向 xadmin-server 目录。"
  );
  process.exit(1);
}

/** 规范化 JSON 文本：忽略缩进/键序差异，只比对语义（与 check-contract-sync.mjs 同口径） */
const normalize = filePath =>
  JSON.stringify(JSON.parse(readFileSync(filePath, "utf-8")));

mkdirSync(mirrorDir, { recursive: true });

const copied = [];
const unchanged = [];
for (const name of SCHEMA_NAMES) {
  const source = path.join(sourceDir, `${name}.schema.json`);
  const mirror = path.join(mirrorDir, `${name}.schema.json`);
  if (!existsSync(source)) {
    console.error(`[fail] 服务端缺少契约文件：${source}`);
    process.exit(1);
  }
  const changed =
    !existsSync(mirror) || normalize(mirror) !== normalize(source);
  copyFileSync(source, mirror);
  (changed ? copied : unchanged).push(name);
}

for (const name of copied) {
  console.log(`[更新] contract/schema/${name}.schema.json（内容有变化）`);
}
for (const name of unchanged) {
  console.log(`[同步] contract/schema/${name}.schema.json（内容一致）`);
}

// 镜像更新后重生成类型（CI 的 regen-diff 门禁要求生成物与镜像同步提交）
console.log("[生成] pnpm gen:metadata-types");
execSync("pnpm gen:metadata-types", { stdio: "inherit" });

console.log(
  copied.length
    ? `[ok] 契约已同步（${copied.length} 个文件有变化）；请连同 src/api/types/*.d.ts 一起提交。`
    : "[ok] 契约已同步（镜像本就一致）；类型文件如有差异请一并提交。"
);
