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
 *   1. src 中出现的 el-* 用法 ⊆ 已注册组件（急加载 + 异步两档合并计）
 *   2. 已注册组件 ⊆ 样式清单（否则组件能跑但没样式）
 *   3. 样式清单 ⊆ 已注册组件（否则白付体积）
 *
 * 注册分两档：`components`（应用外壳，静态 import）与 `lazyComponents`（业务页面，
 * 全局注册为异步组件、不进入首屏闭包）。两档的模板解析行为一致，故一致性校验
 * 必须合并计算，避免异步档被误判为「未注册」。
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
    // 类名判定字符串（classList.contains("el-overlay") 等）按类名消费、不是组件用法：
    // 先剔除，避免把 EP 弹层的 BEM 类名误判为未登记组件（弹层宿主判定循环曾误报）
    const content = readFileSync(file, "utf-8").replace(
      /classList\.[a-zA-Z]+\(\s*["'`][^"'`]*["'`]/g,
      ""
    );
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

/**
 * 登记的组件（急加载 `components` 数组 + 异步 `lazyComponents` 映射键），
 * 统一转连字符便于与模板用法比对。
 */
function registeredComponents(source: string): Set<string> {
  const eager = source.match(/const components = \[([\s\S]*?)\];/);
  if (!eager)
    throw new Error("未找到 components 数组，elementPlus.ts 结构已变更");
  // 说明：声明处带类型标注（含 `=>`），故用非贪婪的“任意字符 + 首个 `= {`”匹配
  const lazy = source.match(/const lazyComponents[\s\S]*?= \{([\s\S]*?)\n\};/);
  if (!lazy)
    throw new Error("未找到 lazyComponents 映射，elementPlus.ts 结构已变更");
  const names = [
    ...[...eager[1].matchAll(/\bEl[A-Z][A-Za-z0-9]*\b/g)].map(m => m[0]),
    // 映射键为 `ElXxx:`（带缩进与冒号），取捕获组而非整段匹配
    ...[...lazy[1].matchAll(/^\s*(El[A-Z][A-Za-z0-9]*):/gm)].map(m => m[1])
  ];
  return new Set(names.map(kebab));
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

  it("被父组件按类型名收集的子组件必须走同步档（el-descriptions-item）", () => {
    // `el-descriptions` 在渲染期用 flattedChildren 扫描默认插槽，按
    // `type.name === "ElDescriptionsItem"` 收集子项。全局注册为异步组件时插槽里是
    // AsyncComponentWrapper，子项全部匹配不到 → 描述列表渲染成空表（真实回归：
    // 成员详情 / 提交详情 / 审批详情等抽屉的资料区全空，仅 E2E 能拦住）。
    // 新增同类父子（父组件扫描插槽 vnode 判定子组件类型）时，父子必须登记在本数组。
    const eager = source.match(/const components = \[([\s\S]*?)\];/)?.[1] ?? "";
    expect(
      /\bElDescriptionsItem\b/.test(eager),
      "ElDescriptionsItem 必须登记在 components（急加载 / 同步档），不能走 lazyComponents"
    ).toBe(true);
  });
});
