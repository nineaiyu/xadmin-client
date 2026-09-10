// 校验客户端镜像 schema 与服务端契约源（xadmin-server/docs/schema）是否一致。
//
// 背景：服务端是契约唯一真源，客户端 contract/schema 为其镜像。
// 此前两侧没有任何一致性校验——服务端改了 schema 而镜像未同步时，
// 客户端 CI 依然全绿，生成的 TS 类型会与线上协议静默漂移。
//
// 服务端目录默认取 ../xadmin-server（两个仓库在同一工作区时的约定），
// 可用 XADMIN_SERVER_DIR 覆盖；找不到服务端时跳过（单仓检出/CI 场景），并打印提示。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const SCHEMA_NAMES = ["search-columns", "search-fields"];
const mirrorDir = path.resolve("contract", "schema");
const serverDir = path.resolve(
  process.env.XADMIN_SERVER_DIR ?? "../xadmin-server"
);
const sourceDir = path.join(serverDir, "docs", "schema");

if (!existsSync(sourceDir)) {
  console.log(
    `[skip] 未找到服务端契约源：${sourceDir}\n` +
      "       如需校验请设置 XADMIN_SERVER_DIR，或在双仓同工作区环境下运行。"
  );
  process.exit(0);
}

/** 规范化 JSON 文本：忽略缩进/键序差异，只比对语义 */
const normalize = filePath =>
  JSON.stringify(JSON.parse(readFileSync(filePath, "utf-8")));

const drifted = [];
for (const name of SCHEMA_NAMES) {
  const mirror = path.join(mirrorDir, `${name}.schema.json`);
  const source = path.join(sourceDir, `${name}.schema.json`);
  if (!existsSync(mirror)) {
    drifted.push(`${name}: 镜像文件缺失（contract/schema）`);
  } else if (!existsSync(source)) {
    drifted.push(`${name}: 服务端契约源缺失（docs/schema）`);
  } else if (normalize(mirror) !== normalize(source)) {
    drifted.push(`${name}: 镜像与服务端契约源不一致`);
  }
}

if (drifted.length) {
  console.error("[fail] 契约镜像已漂移：");
  drifted.forEach(item => console.error(`  - ${item}`));
  console.error(
    "       请同步 contract/schema 后重跑 `pnpm gen:metadata-types`。"
  );
  process.exit(1);
}
console.log("[ok] 契约镜像与服务端 docs/schema 一致");
