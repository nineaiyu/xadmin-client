#!/usr/bin/env node
// 组件文档对账门禁：xadmin-docs/components 示例代码块里绑定的组件属性，
// 必须真实存在于 xadmin-client 对应组件的 props 声明面。
//
// 口径（散文式文档的机械化对账）：
// - 只校验 ```vue 围栏内的组件标签（<ReXxx ...> / <AiXxx ...> / <ChatXxx ...> 等
//   能在 src/components/<Name>/ 解析到实现的组件；el-* 原生 Element Plus 跳过）；
// - 提取静态属性（attr="..."）与绑定属性（:attr="..." / v-bind），kebab-case
//   归一为 camelCase 后与 defineProps（对象式键 + 类型式字段）比对；
// - v-model 归一为 modelValue，v-model:xxx 归一为 xxx；
// - 指令 / 透传类（v-if/v-for/ref/class/key/style/slot/data-* / aria-*）跳过。
// - 单仓检出（缺 xadmin-docs 兄弟仓）时跳过。
//
// 用法：node scripts/check-docs-components.mjs
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOCS_DIR = join(ROOT, "..", "xadmin-docs", "components");
const COMPONENTS_DIR = join(ROOT, "src", "components");

if (!existsSync(DOCS_DIR)) {
  console.log("[skip] 单仓检出（缺 xadmin-docs/components），跳过组件文档对账");
  process.exit(0);
}

const SKIP_ATTRS = new Set([
  "v-if",
  "v-else-if",
  "v-else",
  "v-for",
  "v-show",
  "v-html",
  "v-text",
  "ref",
  "class",
  "key",
  "style",
  "slot",
  "name"
]);

// 内层 Element Plus 组件经 $attrs 透传的常见事件（未在 defineEmits 声明也可用）
const FALLTHROUGH_EVENTS = new Set([
  "change",
  "input",
  "blur",
  "focus",
  "clear",
  "visible-change",
  "remove-tag",
  "select"
]);

const camelize = attr =>
  attr.includes("-") ? attr.replace(/-(\w)/g, (_, c) => c.toUpperCase()) : attr;

function walkFiles(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walkFiles(full, exts, out);
    } else if (exts.some(ext => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/** 命名接口的字段面（types.ts 里 `export interface XxxProps { ... }`） */
function interfaceFields(text, interfaceName, names) {
  const re = new RegExp(
    `interface\\s+${interfaceName}\\s*(?:extends\\s+[^{]+)?\\{`
  );
  for (const block of extractBlocks(text, re)) {
    collectTypeFields(block, names);
  }
}

/** 组件 props 面：对象式键 + 内联/命名类型字段 + emits（@ 事件对账用） */
function propNamesOf(componentDir) {
  const names = new Set(["modelValue"]);
  const emits = new Set();
  const files = walkFiles(componentDir, [".vue", ".tsx", ".ts"]);
  const texts = files.map(file => [file, readFileSync(file, "utf-8")]);
  for (const [, text] of texts) {
    // 对象式：defineProps({ key: ... })
    for (const block of extractBlocks(text, /defineProps\(\s*\{/)) {
      collectKeys(block, names);
    }
    // 类型式（内联）：defineProps<{ key?: ...; }>
    for (const block of extractBlocks(text, /defineProps\s*<\s*\{/)) {
      collectTypeFields(block, names);
    }
    // 命名类型：defineProps<TypeName> —— 在本组件目录内解析同名 interface 字段
    for (const m of text.matchAll(/defineProps<([A-Z]\w*)>\s*\(/g)) {
      for (const [file, t] of texts) {
        interfaceFields(t, m[1], names);
        // defaults 对象的键同样是合法 props 面
        const idx = t.indexOf(`withDefaults(defineProps<${m[1]}>`);
        if (idx >= 0) {
          for (const block of extractBlocks(
            t.slice(idx),
            /withDefaults\(\s*defineProps<[A-Z]\w+>\s*\(\s*\)\s*,/
          )) {
            collectKeys(block, names);
          }
        }
        void file;
      }
    }
    // TSX：defineComponent({ props: { key: { type, default } } }) 顶层键
    for (const block of extractBlocks(
      text,
      /defineComponent\(\s*\{[\s\S]*?props\s*:\s*\{/
    )) {
      collectKeys(block, names);
    }
    // emits：defineEmits<{ name: [...] }>() / defineEmits([...])
    // / TSX defineComponent({ emits: [...] })
    for (const block of extractBlocks(text, /defineEmits\s*<\s*\{/)) {
      collectTypeFields(block, emits);
    }
    for (const m of text.matchAll(
      /(?:defineEmits\(\[|emits:\s*\[)([^\]]*)\]/g
    )) {
      for (const q of m[1].matchAll(/["']([\w-]+)["']/g)) {
        emits.add(q[1]);
        emits.add(camelize(q[1]));
      }
    }
  }
  return { props: names, emits };
}

/** 从 anchor 正则首次命中处做花括号配平，取出整块 */
function extractBlocks(text, anchorRe) {
  const blocks = [];
  let searchFrom = 0;
  while (true) {
    const anchor = anchorRe.exec(text.slice(searchFrom));
    if (!anchor) break;
    const start = searchFrom + anchor.index + anchor[0].length - 1;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          blocks.push(text.slice(start + 1, i));
          searchFrom = i + 1;
          break;
        }
      }
    }
    if (depth !== 0) break;
  }
  return blocks;
}

/** 去注释（块注释整体行 / 行注释尾）：JSDoc 独立成行时字段正则才能命中 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

function collectKeys(block, names) {
  for (const m of stripComments(block).matchAll(
    /^\s{2,}([a-zA-Z_]\w*)\s*:/gm
  )) {
    names.add(m[1]);
  }
}

function collectTypeFields(block, names) {
  for (const m of stripComments(block).matchAll(
    /^\s*([a-zA-Z_]\w*|"[\w-]+")\s*\??\s*:/gm
  )) {
    names.add(m[1].replace(/^"|"$/g, ""));
  }
}

const propCache = new Map();
function declOfTag(tag) {
  if (propCache.has(tag)) return propCache.get(tag);
  const dir = join(COMPONENTS_DIR, tag);
  const decl = existsSync(dir) ? propNamesOf(dir) : null;
  propCache.set(tag, decl);
  return decl;
}

/** vue 围栏内的组件标签 → 绑定属性清单 */
function* docTagBinds(mdFile) {
  const text = readFileSync(mdFile, "utf-8");
  for (const fence of text.matchAll(/```vue\n([\s\S]*?)```/g)) {
    const body = fence[1];
    for (const tagMatch of body.matchAll(
      /<([A-Z][\w]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g
    )) {
      const tag = tagMatch[1];
      const attrsText = tagMatch[2];
      const binds = [];
      for (const attr of attrsText.matchAll(
        /(?:^|\s)((?:v-bind:)?[:@]?[a-zA-Z][\w-]*)(?:\.[\w.]+)?\s*=/g
      )) {
        binds.push(attr[1]);
      }
      yield { tag, binds };
    }
  }
}

function normalizeBind(raw) {
  const isEvent = raw.startsWith("@");
  let attr = raw.replace(/^v-bind:/, "").replace(/^[:@]/, "");
  if (attr.startsWith("v-model")) {
    const named = attr.match(/^v-model:([\w-]+)/);
    return { kind: "prop", name: named ? camelize(named[1]) : "modelValue" };
  }
  if (isEvent) return { kind: "event", name: attr };
  if (attr.startsWith("v-") || attr.startsWith("on")) return null;
  return { kind: "prop", name: camelize(attr) };
}

const violations = [];
let checkedBinds = 0;
for (const md of readdirSync(DOCS_DIR).filter(f => f.endsWith(".md"))) {
  for (const { tag, binds } of docTagBinds(join(DOCS_DIR, md))) {
    const decl = declOfTag(tag);
    if (decl === null) continue; // 非本仓组件（el-* 小写开头已天然不匹配 <A-Z 模式）
    for (const raw of binds) {
      const attr = normalizeBind(raw);
      if (!attr) continue;
      const plain = raw.replace(/^v-bind:/, "").replace(/^[:@]/, "");
      if (SKIP_ATTRS.has(raw) || SKIP_ATTRS.has(plain)) continue;
      if (plain.startsWith("data-") || plain.startsWith("aria-")) continue;
      checkedBinds++;
      if (attr.kind === "prop" && !decl.props.has(attr.name)) {
        violations.push(
          `${md}: <${tag}> 绑定 \`${raw}\` 不在组件 props 声明面`
        );
      }
      if (
        attr.kind === "event" &&
        !decl.emits.has(attr.name) &&
        !decl.emits.has(camelize(attr.name)) &&
        !FALLTHROUGH_EVENTS.has(attr.name)
      ) {
        violations.push(
          `${md}: <${tag}> 事件 \`${raw}\` 不在组件 emits 声明面`
        );
      }
    }
  }
}

console.log(
  `组件文档对账：校验 ${checkedBinds} 个属性绑定（docs 示例 ↔ 组件 props 面）。`
);
if (violations.length) {
  console.error("\n[fail] 文档示例绑定了不存在的组件属性：");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("组件文档对账通过。");
