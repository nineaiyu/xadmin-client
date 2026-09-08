import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 组件按需注册的漂移守卫（静态解析，不 import 组件本身）。
 *
 * `src/plugins/elementPlus.ts` 显式 import 并全局注册组件，打包器摇不掉——
 * 一旦模板里用了没登记的组件，构建不报错、运行时才报
 * "Failed to resolve component: el-<name>"，属于典型的「本地过了、用户炸了」。
 * 本用例把三条一致性固化为门禁：
 *   1. src 中出现的 el-* 用法 ⊆ 已注册组件
 *   2. 已注册组件 ⊆ 样式清单（否则组件能跑但没样式）
 *   3. 样式清单 ⊆ 已注册组件（否则白付体积）
 */

const PLUGINS_DIR = resolve(__dirname, "..");
const SRC_DIR = resolve(PLUGINS_DIR, "..");
const ELEMENT_PLUS_FILE = join(PLUGINS_DIR, "elementPlus.ts");

// 形如 el-... 但不是组件的选择器（BEM 修饰类、内部子元素、过渡名）
const NON_COMPONENT = new Set([
  "dropdown-link",
  "icon-close",
  "spinner",
  "spinner-inner",
  "transitioning",
  "transitioning-vertical",
  "upload-list",
  "zoom-in-top"
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    if (entry === "node_modules" || entry.startsWith(".")) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.vue$|\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** 扫描 src 中出现的 el-* 用法（模板标签与字符串形式的动态组件名） */
function scanUsedElementTags(): Set<string> {
  const used = new Set<string>();
  for (const file of walk(SRC_DIR)) {
    const content = readFileSync(file, "utf-8");
    for (const match of content.matchAll(/(?:<|["'`])el-([a-z][a-z0-9-]*)/g)) {
      const name = match[1];
      // BEM 修饰类（el-icon--upload）与元素类不是组件
      if (name.includes("--") || NON_COMPONENT.has(name)) continue;
      used.add(name);
    }
  }
  return used;
}

function kebab(name: string): string {
  return name
    .replace(/^El/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function readElementPlusFile(): string {
  return readFileSync(ELEMENT_PLUS_FILE, "utf-8");
}

/** components 数组内登记的组件（驼峰标识转连字符，便于与模板用法比对） */
function registeredComponents(source: string): Set<string> {
  const block = source.match(/const components = \[([\s\S]*?)\];/);
  if (!block)
    throw new Error("未找到 components 数组，elementPlus.ts 结构已变更");
  return new Set(
    [...block[1].matchAll(/\bEl[A-Z][A-Za-z0-9]*\b/g)].map(m => kebab(m[0]))
  );
}

/** 按需样式清单（element-plus/es/components/<name>/style/css） */
function styleImports(source: string): Set<string> {
  return new Set(
    [
      ...source.matchAll(
        /element-plus\/es\/components\/([a-z0-9-]+)\/style\/css/g
      )
    ].map(m => m[1])
  );
}

// 插件（指令/全局属性）没有同名组件目录，样式按实际引入目录登记
const PLUGIN_STYLES = new Set([
  "loading",
  "message",
  "message-box",
  "notification",
  "popper"
]);

describe("element-plus 按需注册", () => {
  const source = readElementPlusFile();
  const registered = registeredComponents(source);
  const styles = styleImports(source);

  it("已注册组件数量与预期一致（防止误删整段）", () => {
    expect(registered.size).toBeGreaterThan(50);
  });

  it("src 中出现的 el-* 用法均已注册", () => {
    const used = scanUsedElementTags();
    const missing = [...used].filter(name => !registered.has(name));
    expect(
      missing,
      `以下组件在 src 中使用但未登记到 src/plugins/elementPlus.ts：${missing.join(", ")}`
    ).toEqual([]);
  });

  it("已注册组件均有对应样式（组件能跑但没样式是最隐蔽的回归）", () => {
    const missing = [...registered].filter(
      name => !styles.has(name) && !PLUGIN_STYLES.has(name)
    );
    expect(missing, `缺少样式引入：${missing.join(", ")}`).toEqual([]);
  });

  it("样式清单不超出已注册组件（避免白付体积）", () => {
    const extra = [...styles].filter(
      name => !registered.has(name) && !PLUGIN_STYLES.has(name)
    );
    expect(extra, `多余样式引入：${extra.join(", ")}`).toEqual([]);
  });
});
