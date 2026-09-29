// 契约生成物消费守护：src/api/types/*.d.ts 每份都必须有 import 方。
//
// 背景：类型“生成了”不等于“接上了”。历史上 search-columns / search-fields /
// ws-frame 三份生成物长期零引用——生成链路看似完成，载荷类型仍在手写，服务端
// 协议变更不会在前端类型检查里暴露（“生成即完成”假象）。
//
// 规则：每份生成契约（src/api/types/*.d.ts）至少被 src/ 下一处 import
// （派生 / 对账 / 直接消费均可）。新增 schema 若暂无消费方，请先接入再生成，
// 否则本门禁失败。
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const TYPES_DIR = path.resolve("src", "api", "types");
const SRC_DIR = path.resolve("src");
const SOURCE_EXT = [".ts", ".tsx", ".vue", ".mts"];

/** 生成契约清单：types 目录下的 .d.ts（手写契约文件是 .ts，不在守护面内） */
const generated = readdirSync(TYPES_DIR)
  .filter(name => name.endsWith(".d.ts"))
  .map(name => name.replace(/\.d\.ts$/, ""))
  .sort();

/** 收集 src 下全部源码文件（跳过 types 目录自身：生成物不互相引用） */
function collect(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (path.resolve(full) === TYPES_DIR) continue;
      collect(full, files);
    } else if (SOURCE_EXT.some(ext => entry.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

const files = collect(SRC_DIR);

function referencedBy(name) {
  // import/export ... from ".../types/<name>"，或动态 import(".../types/<name>")
  const fromPattern = new RegExp(`from\\s+["'][^"']*\\/types\\/${name}["']`);
  const dynamicPattern = new RegExp(
    `import\\(\\s*["'][^"']*\\/types\\/${name}["']`
  );
  return files.some(file => {
    const text = readFileSync(file, "utf-8");
    return fromPattern.test(text) || dynamicPattern.test(text);
  });
}

const unused = generated.filter(name => !referencedBy(name));

if (unused.length) {
  console.error("[fail] 以下生成契约零消费（生成即完成假象）：");
  unused.forEach(name => console.error(`  - src/api/types/${name}.d.ts`));
  console.error(
    "       请在消费方 import 该契约（派生/对账均可）后再提交；" +
      "新增 schema 暂无消费方时不要先生成。"
  );
  process.exit(1);
}
console.log(
  `[ok] 契约生成物均有消费方（${generated.length}/${generated.length}）：${generated.join(", ")}`
);
