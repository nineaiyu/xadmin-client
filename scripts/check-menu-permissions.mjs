// 前端消费点 ↔ menu.json 种子权限点双向对账门禁。
//
// 背景：权限点"入库了"不等于"前端用了"。历史上 GlobalSearch 弹窗无 hasAuth 判断、
// 导入模板端点直打接口无权限位——无权用户点进入口要到请求 403 才发现；反向的
// 前端 hasAuth 拼错码则永远拿不到授权。单向 grep 拦不住另一侧的漂移，故做双向对账。
//
// 消费证据（三层，命中任一即视为有消费）：
//  1. 权限码证据：字面量权限码（hasAuth("list:X") / 路由表 auth: "list:X" 等），
//     或 usePageAuth 权限表推导（显式组件名 / hook 向上解析页面名 / extraKeys）；
//  2. 端点证据：种子行的 URL 在前端 api 层被调用——base 前缀（api/<app>/<资源>）
//     与动作尾段（reset-mfa / recycle/restore 等实际路由尾段）在 src 内均可 grep 到
//     （前端 URL 多为 `${baseApi}/动作` 拼装，两侧片段同源可对上）；
//  3. 白名单：确属预期偏差的（文档外链类等），登记到本脚本 WHITELIST_A / WHITELIST_B
//     （逐条注明理由），并在 xadmin-server/docs/guide/menu-maintenance.md §5 同步登记。
//
// 方向 B（前端 → 种子）只用显式证据（字面量码 + extraKeys）：权限表默认按钮位
// 是"可用位"而非"必用位"，页面不渲染某按钮时种子无对应权限点是正常形态，
// 不按漂移处理。
//
// 服务端目录解析同 check-contract-sync.mjs：默认 ../xadmin-server，
// 可用 XADMIN_SERVER_DIR 覆盖；未检出时跳过（单仓场景）。
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const SRC_DIR = path.resolve("src");
const SOURCE_EXT = [".ts", ".tsx", ".vue", ".mts"];
const AUTH_HELPER = path.resolve("src", "router", "utils", "auth.ts");

// getDefaultAuths 的默认按钮位清单直接从实现文件提取（实现加位门禁自动跟随），
// 提取失败时退回登记日的快照并给出提示
const FALLBACK_DEFAULT_ACTIONS = [
  "list",
  "create",
  "update",
  "upload",
  "destroy",
  "retrieve",
  "exportData",
  "importData",
  "batchDestroy",
  "partialUpdate",
  "recycleList"
];

/** 权限码形态：动作标识符 + PascalCase 组件名（与种子 625 点全量核对过的形态一致） */
const CODE_PATTERN = /["']([a-zA-Z_]\w*:[A-Z][A-Za-z0-9_]*)["']/g;

/** 必须存在码级校验（hasAuth / usePageAuth）的权限点：端点证据对它们不算数。
 * GlobalSearch 弹窗与导入模板管理曾"端点有人调、权限没人查"（无权用户点进入口
 * 到 403 才发现），后补的前端校验靠本清单防回潮——删掉 hasAuth 即门禁红。 */
const MUST_CODE_EVIDENCE = [
  "retrieve:SystemGlobalSearch",
  "list:SystemImportTemplate"
];

const serverDir = path.resolve(
  process.env.XADMIN_SERVER_DIR ?? "../xadmin-server"
);
const menuJsonPath = path.join(serverDir, "loadjson", "menu.json");

if (!existsSync(menuJsonPath)) {
  console.log(
    `[skip] 未找到菜单种子：${menuJsonPath}\n` +
      "       如需对账请设置 XADMIN_SERVER_DIR，或在双仓同工作区环境下运行。"
  );
  process.exit(0);
}

// ---------- 种子侧 ----------

const menuRows = JSON.parse(readFileSync(menuJsonPath, "utf-8"))
  .filter(row => row.model === "system.menu")
  .map(row => row.fields);

const seedCodes = menuRows.filter(f => f.menu_type === 2).map(f => f.name);

// demo 模块的菜单/权限点由 seed_demo_book 运行期注入（不入 loadjson 种子，
// 见该文件 PERMISSION_PLAN 与后端守护测试），对账时解析为第二种子源，
// 使前端 demo 页签的权限检查（push:DemoBook 等）不按"种子无码"误报。
const demoSeedPath = path.join(
  serverDir,
  "demo_seed",
  "management",
  "commands",
  "seed_demo_book.py"
);
let demoSeedCodes = [];
if (existsSync(demoSeedPath)) {
  const demoText = readFileSync(demoSeedPath, "utf-8");
  const menuName = demoText.match(/^MENU_NAME = "(\w+)"$/m)?.[1];
  const planBlock = demoText.match(/^PERMISSION_PLAN = \[([\s\S]*?)^\]/m)?.[1];
  if (menuName && planBlock) {
    demoSeedCodes = [
      ...planBlock.matchAll(/\("(\w+)",\s*"(?:GET|POST|PUT|PATCH|DELETE)",/g)
    ].map(match => `${match[1]}:${menuName}`);
  }
}
const knownCodes = new Set([...seedCodes, ...demoSeedCodes]);

/** 种子 path（路由正则）→ 归一化段列：去锚点、参数捕获组（任意括号组）换 *。 */
function seedSegments(pathStr) {
  return pathStr
    .replace(/[\^$]/g, "")
    .replace(/\([^()]*\)/g, "*")
    .split("/")
    .filter(Boolean);
}

// ---------- 对账白名单（机器事实源；与 menu-maintenance.md §3/§5 同步登记） ----------
//
// 白名单放在脚本内而非解析文档：本门禁在两侧 CI 独立运行（客户端检出服务端 dev，
// 服务端检出客户端 dev），解析对侧未合并的文档会在跨仓引导期互相打红；
// 登记新条目时需同步更新脚本与本档两处。

/** 页面 URL≠组件目录例外：key = `${path 去前导 /}=${component}`（menu-maintenance.md §3） */
const URL_EXCEPTIONS = new Set([
  "user/info/index=account/index", // UserInfo：历史口径，个人中心 URL 与组件目录独立演化
  "analysis/dashboard/index=dashboard/index", // DataDashboard：历史口径（§2 决策，保留不修齐）
  "analysis/dataset/index=dashboard/dataset/index", // DataDataset：同上（§2 决策）
  "form-collection/designer/index=form/designer/index", // FormDesigner：表单域 URL 前缀历史口径
  "form-collection/my/index=form/my/index", // FormMySubmission：同上
  "form-collection/data/index=form/data/index", // FormData：同上
  "integration/ai/mcp=integration/ai/mcp/index" // AiMcpServers：URL 不带 /index 后缀
]);

/** 方向 A 白名单：种子有权限点、前端无消费证据，属预期（menu-maintenance.md §5） */
const WHITELIST_A = new Set([
  "retrieve:Spectacular", // 文档外链类：API 文档页由菜单链接直达，无前端校验位属预期
  "retrieve:SpectacularSwaggerView", // 文档外链类：同上（Swagger UI）
  "retrieve:SpectacularRedocView", // 文档外链类：同上（Redoc）
  "retrieve:SystemFlower", // 文档外链类：Celery Flower 监控页外链打开
  "create:SystemFlower", // 文档外链类：同上（仅配对方法位存在，无前端交互）
  "enable:SystemTask", // 前端启停走 batch-enable / partialUpdate，单任务端点无前端交互
  "syncRepoStatus:AiKnowledge" // 前端只调 sync-repo 触发同步，状态经列表刷新获得
]);

/** 方向 B 白名单：前端有权限检查、种子无对应码，属预期（menu-maintenance.md §5） */
const WHITELIST_B = new Set([
  // 编辑兼容口径：前端 OR 检查 update/partialUpdate（编辑保存走 partialUpdate，但
  // 权限授予习惯不同，只认其一会让另一类角色看不到编辑入口），种子只授 partialUpdate
  "update:SystemApprovalFlow",
  "update:SystemApprovalRule"
]);

// ---------- 前端源码收集 ----------

function collect(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, files);
    } else if (
      SOURCE_EXT.some(ext => entry.endsWith(ext)) &&
      !entry.includes(".spec.")
    ) {
      files.push(full);
    }
  }
  return files;
}

const files = collect(SRC_DIR).filter(full => full !== AUTH_HELPER);
const fileText = new Map(
  files.map(full => [full, readFileSync(full, "utf-8")])
);

// ---------- 权限码消费证据（字面量 + usePageAuth 推导） ----------

/** 从 .vue 提取页面组件名（name 字段，PascalCase 才算；模板里的小写 name 属性天然排除） */
function vueComponentName(full) {
  const match = fileText
    .get(full)
    .match(/\bname:\s*["']([A-Z][A-Za-z0-9_]*)["']/);
  return match ? match[1] : null;
}

const vueNames = new Map(
  files
    .filter(full => full.endsWith(".vue"))
    .map(full => [full, vueComponentName(full)])
    .filter(([, name]) => name)
);

/** 提取调用括号内实参（配平括号，兼容数组跨行） */
function extractCallArgs(text, start) {
  const open = text.indexOf("(", start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return "";
}

function stringsIn(segment) {
  return [...segment.matchAll(/["']([^"']+)["']/g)].map(match => match[1]);
}

const authSites = [];
for (const full of files) {
  for (const match of fileText.get(full).matchAll(/usePageAuth\s*\(/g)) {
    const args = extractCallArgs(fileText.get(full), match.index);
    if (!args.trim()) {
      authSites.push({
        file: full,
        explicit: null,
        wildcard: false,
        extras: []
      });
      continue;
    }
    const head = args.split(",")[0].trim();
    const rest = args.slice(args.indexOf(head) + head.length);
    if (head.startsWith('"') || head.startsWith("'")) {
      authSites.push({
        file: full,
        explicit: head.slice(1, -1),
        wildcard: false,
        extras: stringsIn(rest)
      });
    } else if (head.startsWith("[")) {
      // 首参即 extraKeys 数组（后缀由运行时组件实例推导）
      authSites.push({
        file: full,
        explicit: null,
        wildcard: false,
        extras: stringsIn(args)
      });
    } else {
      // 首参为变量（页签装配等）：无法静态定名，按通配处理并输出供人工复核
      authSites.push({
        file: full,
        explicit: null,
        wildcard: true,
        extras: stringsIn(args)
      });
    }
  }
}

/** 谁 import 了这个文件（相对路径引用，补齐省略的扩展名 / index） */
const importersOf = new Map();
for (const full of files) {
  for (const match of fileText
    .get(full)
    .matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    let target = path.resolve(path.dirname(full), match[1]);
    for (const ext of SOURCE_EXT) {
      if (files.includes(target + ext)) {
        target += ext;
        break;
      }
      if (files.includes(path.join(target, `index${ext}`))) {
        target = path.join(target, `index${ext}`);
        break;
      }
    }
    if (!importersOf.has(target)) importersOf.set(target, []);
    importersOf.get(target).push(full);
  }
}

/** 隐式后缀解析：沿 import 链向上找最近的具名 .vue 页面（可能被多页签复用，全数登记） */
function implicitNames(full, seen = new Set()) {
  if (seen.has(full)) return [];
  seen.add(full);
  const names = [];
  for (const importer of importersOf.get(full) ?? []) {
    if (vueNames.has(importer)) {
      names.push(vueNames.get(importer));
    } else {
      names.push(...implicitNames(importer, seen));
    }
  }
  return names;
}

const defaultActions = (() => {
  const authText = readFileSync(AUTH_HELPER, "utf-8");
  const block = authText.match(/const actions = \[([^\]]+)\]/s);
  const actions = block
    ? [...block[1].matchAll(/"([^"]+)"/g)].map(m => m[1])
    : [];
  return actions.length ? actions : FALLBACK_DEFAULT_ACTIONS;
})();

const allText = [...fileText.values()].join("\n");
const literalCodes = new Set();
for (const text of fileText.values()) {
  for (const match of text.matchAll(CODE_PATTERN)) literalCodes.add(match[1]);
}
const tableConsumers = new Set(); // 装配了权限表的组件名（默认位 + extras 均可判权）
const extraCodes = new Set(); // extraKeys 显式消费（方向 B 用）
const wildcardActions = new Set();
const unresolvedImplicit = [];
for (const site of authSites) {
  if (site.wildcard) {
    [...new Set([...defaultActions, ...site.extras])].forEach(action =>
      wildcardActions.add(action)
    );
    continue;
  }
  const names = site.explicit ? [site.explicit] : implicitNames(site.file);
  if (!site.explicit && !names.length) {
    unresolvedImplicit.push(site.file);
    continue;
  }
  site.extras.forEach(extra =>
    names.forEach(name => extraCodes.add(`${extra}:${name}`))
  );
  names.forEach(name => tableConsumers.add(name));
}

// ---------- 端点消费证据（种子 URL ↔ 前端 api 调用片段） ----------

/** 端点证据：种子路由段列找一个切分点 k——"api/<前 k 段>"在某处出现（baseApi 定义处），
 * 其余字面段连成的尾路径以 "/<tail>" 形态出现在 src 内（`${baseApi}/动作` 拼装处）。
 * 切分点动态尝试，覆盖 baseApi 与动作路径分属两处（基类通用方法 / 子类配置）的拼装形态；
 * 尾段必须带前导斜杠整体匹配，避免普通单词（如类名 / 注释里的词）误当端点证据。 */
function endpointConsumed(pathStr) {
  const segments = seedSegments(pathStr);
  if (segments[0] !== "api") return false;
  for (let k = 1; k < segments.length; k++) {
    const anchor = `api/${segments.slice(1, k + 1).join("/")}`;
    if (!allText.includes(anchor)) continue;
    const tails = segments.slice(k + 1).filter(segment => segment !== "*");
    if (!tails.length || allText.includes(`/${tails.join("/")}`)) return true;
  }
  return false;
}

// ---------- 三向对账 ----------

const consumedByCode = code => {
  if (literalCodes.has(code) || extraCodes.has(code)) return true;
  const [action] = code.split(":");
  if (wildcardActions.has(action)) return true;
  return (
    defaultActions.includes(action) && tableConsumers.has(code.split(":")[1])
  );
};

const seedRows = menuRows.filter(f => f.menu_type === 2);
const missingConsumption = seedRows
  .filter(row => !consumedByCode(row.name) && !WHITELIST_A.has(row.name))
  .filter(row => !endpointConsumed(row.path));

// 方向 B：显式写出的权限码必须在种子中（字面量 + extraKeys；权限表默认位不参与）
const explicitCodes = new Set([...literalCodes, ...extraCodes]);
const unknownCodes = [...explicitCodes].filter(
  code => !knownCodes.has(code) && !WHITELIST_B.has(code)
);

// 防回潮：清单内权限点必须仍有码级校验证据
const missingCodeEvidence = MUST_CODE_EVIDENCE.filter(
  code => !literalCodes.has(code) && !extraCodes.has(code)
);

const seedPages = menuRows
  .filter(
    f => f.menu_type === 1 && f.component && f.path && f.path.startsWith("/")
  )
  .map(f => ({ name: f.name, path: f.path, component: f.component }));
const urlDrift = seedPages.filter(page => {
  const key = `${page.path.replace(/^\//, "")}=${page.component}`;
  return (
    !URL_EXCEPTIONS.has(key) && page.path.replace(/^\//, "") !== page.component
  );
});

let failed = false;
if (missingConsumption.length) {
  failed = true;
  console.error("[fail] 以下种子权限点无前端消费证据（入库 ≠ 可用）：");
  missingConsumption.forEach(row =>
    console.error(`  - ${row.name}（${row.method} ${row.path}）`)
  );
  console.error(
    "       请补前端消费（hasAuth / usePageAuth / api 调用）；确属预期无消费" +
      "（如文档外链类），登记到脚本 WHITELIST_A 并在 menu-maintenance.md §5 同步登记。"
  );
}
if (unknownCodes.length) {
  failed = true;
  console.error(
    "[fail] 以下前端消费的权限码不在菜单种子中（拼错码永远无授权）："
  );
  unknownCodes.forEach(code => console.error(`  - ${code}`));
  console.error(
    "       请核对权限码拼写，或确认 menu.json 已登记对应权限点；确属兼容口径，登记到脚本 WHITELIST_B。"
  );
}
if (missingCodeEvidence.length) {
  failed = true;
  console.error(
    "[fail] 以下权限点必须保留码级校验（hasAuth / usePageAuth），当前缺失："
  );
  missingCodeEvidence.forEach(code => console.error(`  - ${code}`));
  console.error(
    '       这些入口曾有"端点有人调、权限没人查"的缺陷（无权用户到 403 才发现），' +
      "补上的校验不得回退删除；确需调整请先改脚本 MUST_CODE_EVIDENCE 清单并说明。"
  );
}
if (urlDrift.length) {
  failed = true;
  console.error(
    "[fail] 以下页面 URL≠组件目录且未登记例外（脚本 URL_EXCEPTIONS / menu-maintenance.md §3）："
  );
  urlDrift.forEach(page =>
    console.error(`  - ${page.name}: ${page.path} ↔ ${page.component}`)
  );
  console.error(
    "       URL 与组件目录默认相等；历史显式映射请先登记例外再改种子。"
  );
}
if (unresolvedImplicit.length) {
  console.warn(
    `[warn] ${unresolvedImplicit.length} 处 usePageAuth() 隐式调用未解析到具名页面` +
      `（未计入消费证据，如为真实消费请改显式写法）：`
  );
  unresolvedImplicit.forEach(full =>
    console.warn(`  - ${path.relative(SRC_DIR, full)}`)
  );
}
if (wildcardActions.size) {
  console.warn(
    `[warn] ${wildcardActions.size} 个动作来自无法静态定名的 usePageAuth 调用` +
      `（按通配消费处理，新增权限点若恰在其中请改显式写法）：` +
      [...wildcardActions].join(", ")
  );
}

if (failed) process.exit(1);
console.log(
  `[ok] 权限点双向对账一致：种子 ${seedCodes.length} 点 + demo 注入 ${demoSeedCodes.length} 点` +
    `（字面量/推导证据 ${literalCodes.size + extraCodes.size} + 端点证据覆盖余量）；` +
    `页面 URL=目录 ${seedPages.length} 页（例外 ${URL_EXCEPTIONS.size} 项已登记）`
);
