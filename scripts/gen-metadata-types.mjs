// 生成元数据接口契约 TS 类型（T2.3）。
// 输入：contract/schema/*.schema.json（镜像自 xadmin-server/docs/schema，
//       服务端为契约源：其 CI 契约测试持续校验真实响应 ↔ Schema 一致；
//       服务端 Schema 变更需同步镜像本目录并重跑本脚本）
// 输出：src/api/types/search-columns.d.ts / search-fields.d.ts
// CI 在 lint 阶段重新生成并 diff，手改会被拒绝；Schema 变更需与后端一同评审。
import { compileFromFile } from "json-schema-to-typescript";
import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BANNER = `// 元数据接口契约类型：由 contract/schema/*.schema.json 生成（T2.3）。
// 该目录镜像自 xadmin-server/docs/schema（服务端为契约源）；禁止手改。
// 重新生成：pnpm gen:metadata-types；Schema 变更属破坏性契约变更，需与后端一同评审。
`;

const schemaDir = path.resolve("contract", "schema");
const outDir = path.resolve("src", "api", "types");

await mkdir(outDir, { recursive: true });

for (const name of ["search-columns", "search-fields"]) {
  const options = {
    bannerComment: BANNER,
    style: { semi: true, singleQuote: false }
  };
  const ts = await compileFromFile(
    path.join(schemaDir, `${name}.schema.json`),
    options
  );
  const outPath = path.join(outDir, `${name}.d.ts`);
  await writeFile(outPath, ts);
  console.log(`generated: ${outPath}`);
}

// 与仓库 prettier 配置对齐，保证 regen-check diff 幂等
execSync(`prettier --write "${path.join(outDir, "search-*.d.ts")}"`, {
  stdio: "inherit"
});
