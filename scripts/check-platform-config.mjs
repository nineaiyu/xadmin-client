#!/usr/bin/env node
// 项目参数（public/platform-config.json）生效门禁。
//
// 背景：项目参数的三处清单（platform-config.json ↔ injectResponsiveStorage ↔
// siteConfig 的 saveSiteConfig / getSiteConfig）历史上不同步，导致「参数改了不生效」
// （例：Title 不在 PATCH 清单，后端同步与设置面板都改不动品牌标题）。本门禁钉住两条：
//
//   1. 死参数：每个配置键必须有真实消费点（config.X / $config.X / configure.camelX）；
//   2. 断链：经 injectResponsiveStorage 注入偏好存储的键，必须同步登记在
//      siteConfig 的整包 PATCH 清单里（否则设置面板改动无法回写后端）。
//
// 白名单新增必须给出理由（CONSUME_EXEMPT / SYNC_EXEMPT）。
//
// 用法：node scripts/check-platform-config.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONFIG_PATH = join(ROOT, "public/platform-config.json");
const RESPONSIVE_PATH = join(ROOT, "src/utils/responsive.ts");
const SITE_CONFIG_PATH = join(ROOT, "src/store/modules/siteConfigFields.ts");

/** 无运行时消费的键 → 原因（新增必须给出理由） */
const CONSUME_EXEMPT = new Map([
  ["Version", "发布元信息：与 package.json 的 version 重复，代码不读取"],
  ["ResponsiveStorageNameSpace", "存储命名空间前缀：由 config 模块内部消费"]
]);

/** 注入偏好存储但不回写后端的键 → 原因（新增必须给出理由） */
const SYNC_EXEMPT = new Map([
  ["ResponsiveStorageNameSpace", "同上：非用户偏好，不入站点配置"]
]);

const camel = key => key[0].toLowerCase() + key.slice(1);

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      rows.push(...walk(full));
    } else if (/\.(ts|tsx|vue)$/.test(full) && !full.includes(".spec.")) {
      rows.push(full);
    }
  }
  return rows;
}

const sources = walk(join(ROOT, "src"))
  .map(file => readFileSync(file, "utf-8"))
  .join("\n");
const respSrc = readFileSync(RESPONSIVE_PATH, "utf-8");
const siteSrc = readFileSync(SITE_CONFIG_PATH, "utf-8");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
const keys = Object.keys(config);

/** 1. 死参数：每个键必须有消费点 */
const dead = [];
for (const key of keys) {
  const c = camel(key);
  const patterns = [
    // getConfig()?.X / getConfig().X
    new RegExp(`getConfig\\(\\)\\??\\.${key}\\b`),
    // config.X（模块内直接引用）
    new RegExp(`\\bconfig\\.${key}\\b`),
    // $config.X（组件内全局属性）
    new RegExp(`\\$config\\.${key}\\b`),
    // configure.camelX（偏好存储消费）
    new RegExp(`configure\\??\\.${c}\\b`)
  ];
  if (!patterns.some(p => p.test(sources)) && !CONSUME_EXEMPT.has(key)) {
    dead.push(key);
  }
}

/** 2. 断链：注入偏好的键必须在 siteConfig 的 PATCH 清单里 */
const injected = new Set(
  [...respSrc.matchAll(/config\.([A-Z]\w+)/g)].map(m => m[1])
);
const patched = new Set(
  // 偏好注册表行格式：[服务端键, 本地 key, 缺省值]
  [...siteSrc.matchAll(/\[\s*"[A-Z]\w+",\s*"(\w+)",/g)].map(m => camel(m[1]))
);
const notSynced = [...injected].filter(
  key => !patched.has(camel(key)) && !SYNC_EXEMPT.has(key)
);

console.log(
  `项目参数门禁：${keys.length} 个键 | 注入偏好 ${injected.size} 个 | 后端同步清单 ${patched.size} 个`
);

let failed = false;
if (dead.length > 0) {
  failed = true;
  console.error("\n以下配置键没有消费点（配置了但不生效）：");
  for (const key of dead)
    console.error(`  ⚠ ${key} = ${JSON.stringify(config[key])}`);
  console.error(
    "处理：补消费点，或从 platform-config.json 移除并登记 CONSUME_EXEMPT。"
  );
}
if (notSynced.length > 0) {
  failed = true;
  console.error(
    "\n以下配置键注入了偏好存储，但不在站点配置 PATCH 清单（改动无法回写后端）："
  );
  for (const key of notSynced) console.error(`  ⚠ ${key}`);
  console.error(
    "处理：登记到 siteConfig.saveSiteConfig 的 configObj，或加 SYNC_EXEMPT。"
  );
}
if (failed) process.exit(1);
console.log("项目参数门禁通过（无死参数、偏好键全部可同步）。");
