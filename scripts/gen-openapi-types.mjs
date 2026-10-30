// 生成全量 OpenAPI 接口类型。
// 输入：contract/openapi.json（镜像自 xadmin-server/docs/schema/openapi.json，
//       服务端经 `python manage.py dump_openapi` 稳定化导出；契约真源在服务端）。
// 输出：src/api/types/openapi.d.ts（paths / operations / components 全量生成）。
//
// 用法：
//   pnpm gen:openapi-types     # 写盘
//   pnpm check:openapi-types   # 只校验生成物与镜像一致（CI regen-diff）
//
// 边界：既有手写 API 模块与五份元数据契约类型保持现状；本文件用于新增接口的
// 请求/响应类型与前后端契约对账，禁止手改。
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import openapiTS, { astToString } from "openapi-typescript";

const BANNER = `// 全量接口契约类型：由 contract/openapi.json 生成。
// 该文件镜像自 xadmin-server/docs/schema/openapi.json（服务端为契约真源）；
// 禁止手改。重新生成：pnpm gen:openapi-types（服务端先跑 python manage.py dump_openapi）。
`;

const source = path.resolve("contract", "openapi.json");
const outPath = path.resolve("src", "api", "types", "openapi.d.ts");

const schema = JSON.parse(await readFile(source, "utf-8"));
const ast = await openapiTS(schema);
const contents = `${BANNER}${astToString(ast)}`;

if (process.argv.includes("--check")) {
  let existing = "";
  try {
    existing = await readFile(outPath, "utf-8");
  } catch {
    console.error(
      `[fail] 生成物缺失：${outPath}\n       请运行 pnpm gen:openapi-types。`
    );
    process.exit(1);
  }
  if (existing !== contents) {
    console.error(
      `[fail] OpenAPI 生成类型与镜像不一致：${outPath}\n` +
        "       请运行 pnpm gen:openapi-types 并提交生成物（禁止手改）。"
    );
    process.exit(1);
  }
  console.log("[ok] OpenAPI 生成类型与 contract/openapi.json 一致");
} else {
  await writeFile(outPath, contents, "utf-8");
  console.log(`generated: ${outPath}`);
}
