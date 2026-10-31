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
// 判定口径：逐文件剥离注释与字符串字面量后再匹配属性访问——注释里提到某键、
// 或字符串里出现 `config.X` 字样都不算消费点（此前全源码拼串后子串搜索会把它们
// 误判为「有消费」）。偏好注册表按行结构解析（允许单/双引号与跨行）。
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

/**
 * 剥离注释与字符串字面量：只保留代码标识符与结构。
 *
 * 注释里的 `config.Title` 与字符串里的 `"config.Title"` 都不是消费点，
 * 剥离后属性访问的正则只会命中真实代码。
 */
function stripCode(source) {
  let out = "";
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      let closed = false;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === quote) {
          index += 1;
          closed = true;
          break;
        }
        index += 1;
      }
      out += `${quote}${quote}`;
      if (!closed) break;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (
        index < source.length &&
        !(source[index] === "*" && source[index + 1] === "/")
      )
        index += 1;
      index += 2;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

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

/** 每个源文件的「去注释去字符串」代码（逐文件判定，不拼串） */
const sources = walk(join(ROOT, "src")).map(file =>
  stripCode(readFileSync(file, "utf-8"))
);
const respSrc = stripCode(readFileSync(RESPONSIVE_PATH, "utf-8"));
// 注册表本身就是「字面量行」，必须读原文（stripCode 会把键名清空）；
// 行结构匹配只认 `["服务端键", "本地 key", 缺省值]` 形态，注释里不会出现该形态。
const siteSrc = readFileSync(SITE_CONFIG_PATH, "utf-8");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
const keys = Object.keys(config);

/** 1. 死参数：每个键必须有真实消费点（属性访问形态） */
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
    // configure?.camelX（偏好存储消费）
    new RegExp(`\\bconfigure\\??\\.${c}\\b`)
  ];
  const hasConsumer = sources.some(src => patterns.some(p => p.test(src)));
  if (!hasConsumer && !CONSUME_EXEMPT.has(key)) {
    dead.push(key);
  }
}

/** 2. 断链：注入偏好的键必须在 siteConfig 的 PATCH 清单里 */
const injected = new Set(
  [...respSrc.matchAll(/\bconfig\.([A-Z]\w+)/g)].map(m => m[1])
);
const patched = new Set(
  // 偏好注册表行格式：[服务端键, 本地 key, 缺省值]（允许单/双引号与跨行）
  [...siteSrc.matchAll(/\[\s*["']([A-Z]\w*)["']\s*,\s*["'](\w+)["']\s*,/g)].map(
    m => camel(m[1])
  )
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
    console.error(`  警告 ${key} = ${JSON.stringify(config[key])}`);
  console.error(
    "处理：补消费点，或从 platform-config.json 移除并登记 CONSUME_EXEMPT。"
  );
}
if (notSynced.length > 0) {
  failed = true;
  console.error(
    "\n以下配置键注入了偏好存储，但不在站点配置 PATCH 清单（改动无法回写后端）："
  );
  for (const key of notSynced) console.error(`  警告 ${key}`);
  console.error(
    "处理：登记到 siteConfig.saveSiteConfig 的 configObj，或加 SYNC_EXEMPT。"
  );
}
if (failed) process.exit(1);
console.log("项目参数门禁通过（无死参数、偏好键全部可同步）。");
