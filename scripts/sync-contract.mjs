// 契约一键同步：服务端 docs/schema（唯一真源）→ 本仓 contract/schema 镜像 → 重新生成 TS 类型。
//
// 用法：pnpm sync:contract
// 服务端目录默认取 ../xadmin-server（两仓同工作区约定），可用 XADMIN_SERVER_DIR 覆盖。
// 与 check:contract 的分工：
//   - 本脚本负责"写"：拷镜像 + pnpm gen:metadata-types；
//   - check:contract 负责"读"：CI 校验镜像与服务端一致（防止绕过本脚本手改镜像）。
// 找不到服务端契约源时直接失败（同步是显式动作，静默跳过会给出"已同步"的假象）。
//
// 原子性：先把全部契约写入临时目录并完成 JSON 校验，再整体替换镜像（旧镜像改名备份）；
// 替换后的类型生成失败时回滚镜像，避免工作区停在"半同步"状态。
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync
} from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const SCHEMA_SUFFIX = ".schema.json";
const mirrorDir = path.resolve("contract", "schema");
const openapiMirror = path.resolve("contract", "openapi.json");
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

/** 服务端 schema 清单（动态发现，避免新增契约漏同步） */
const schemaNames = readdirSync(sourceDir)
  .filter(name => name.endsWith(SCHEMA_SUFFIX))
  .map(name => name.slice(0, -SCHEMA_SUFFIX.length))
  .sort();
const openapiSource = path.join(sourceDir, "openapi.json");

if (schemaNames.length === 0) {
  console.error(
    `[fail] 服务端契约目录没有 ${SCHEMA_SUFFIX} 文件：${sourceDir}`
  );
  process.exit(1);
}
if (!existsSync(openapiSource)) {
  console.error(
    `[fail] 服务端缺少 OpenAPI 契约：${openapiSource}\n` +
      "       请在服务端运行 `python manage.py dump_openapi` 后重试。"
  );
  process.exit(1);
}

/** 规范化 JSON 文本：忽略缩进/键序差异，只比对语义（与 check-contract-sync.mjs 同口径） */
function normalize(filePath) {
  try {
    return JSON.stringify(JSON.parse(readFileSync(filePath, "utf-8")));
  } catch (error) {
    return `__parse_error__:${String(error.message ?? error).split("\n")[0]}`;
  }
}

// 1) 先校验全部源契约（任何一份不合法都不落盘）
const invalid = [];
for (const name of [...schemaNames, "openapi"]) {
  const file =
    name === "openapi"
      ? openapiSource
      : path.join(sourceDir, `${name}${SCHEMA_SUFFIX}`);
  const result = normalize(file);
  if (result.startsWith("__parse_error__"))
    invalid.push(`${path.relative(process.cwd(), file)}: ${result.slice(15)}`);
}
if (invalid.length > 0) {
  console.error(
    `[fail] 服务端契约 JSON 非法，已中止同步（镜像未改动）：\n  ${invalid.join("\n  ")}`
  );
  process.exit(1);
}

const changed = [];
const unchanged = [];
for (const name of schemaNames) {
  const source = path.join(sourceDir, `${name}${SCHEMA_SUFFIX}`);
  const mirror = path.join(mirrorDir, `${name}${SCHEMA_SUFFIX}`);
  (existsSync(mirror) && normalize(mirror) === normalize(source)
    ? unchanged
    : changed
  ).push(name);
}
const openapiChanged =
  !existsSync(openapiMirror) ||
  normalize(openapiMirror) !== normalize(openapiSource);

// 2) 写入临时目录（与 contract/ 同分区，便于原子 rename）
const staging = path.resolve("contract", `.sync-${process.pid}-${Date.now()}`);
mkdirSync(path.join(staging, "schema"), { recursive: true });
for (const name of schemaNames) {
  copyFileSync(
    path.join(sourceDir, `${name}${SCHEMA_SUFFIX}`),
    path.join(staging, "schema", `${name}${SCHEMA_SUFFIX}`)
  );
}
copyFileSync(openapiSource, path.join(staging, "openapi.json"));

const backupSchema = path.join(staging, "backup-schema");
const backupOpenapi = path.join(staging, "backup-openapi.json");
const hadSchema = existsSync(mirrorDir);
const hadOpenapi = existsSync(openapiMirror);

function restore() {
  rmSync(mirrorDir, { recursive: true, force: true });
  rmSync(openapiMirror, { force: true });
  if (hadSchema && existsSync(backupSchema))
    renameSync(backupSchema, mirrorDir);
  if (hadOpenapi && existsSync(backupOpenapi))
    renameSync(backupOpenapi, openapiMirror);
}

// 3) 整体替换镜像（旧镜像先改名备份）
try {
  if (hadSchema) renameSync(mirrorDir, backupSchema);
  if (hadOpenapi) renameSync(openapiMirror, backupOpenapi);
  renameSync(path.join(staging, "schema"), mirrorDir);
  renameSync(path.join(staging, "openapi.json"), openapiMirror);
} catch (error) {
  restore();
  rmSync(staging, { recursive: true, force: true });
  console.error(`[fail] 契约替换失败，已回滚：${error.message}`);
  process.exit(1);
}

for (const name of changed) {
  console.log(`[更新] contract/schema/${name}${SCHEMA_SUFFIX}（内容有变化）`);
}
for (const name of unchanged) {
  console.log(`[同步] contract/schema/${name}${SCHEMA_SUFFIX}（内容一致）`);
}
console.log(
  `[${openapiChanged ? "更新" : "同步"}] contract/openapi.json（${
    openapiChanged ? "内容有变化" : "内容一致"
  }）`
);

// 4) 镜像替换后重生成类型；失败则回滚镜像（CI 的 regen-diff 门禁要求生成物与镜像同步提交）
try {
  console.log("[生成] pnpm gen:metadata-types");
  execSync("pnpm gen:metadata-types", { stdio: "inherit" });
  console.log("[生成] pnpm gen:openapi-types");
  execSync("pnpm gen:openapi-types", { stdio: "inherit" });
} catch (error) {
  restore();
  rmSync(staging, { recursive: true, force: true });
  console.error(
    `[fail] 类型生成失败，契约镜像已回滚（src/api/types 可能已部分更新，请重跑 sync:contract）：\n  ${error.message}`
  );
  process.exit(1);
}

rmSync(staging, { recursive: true, force: true });

console.log(
  changed.length || openapiChanged
    ? `[ok] 契约已同步（${changed.length} 份 schema + openapi ${openapiChanged ? "有变化" : "无变化"}）；请连同 src/api/types/*.d.ts 一起提交。`
    : "[ok] 契约已同步（镜像本就一致）；类型文件如有差异请一并提交。"
);
