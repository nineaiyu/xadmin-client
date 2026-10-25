import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  CATEGORY_LABELS,
  PLAYGROUND_ENTRIES,
  type PlaygroundCategory
} from "../registry";

/** 组件根目录（src/components）——README 与注册表共同的事实源 */
const componentsDir = resolve(__dirname, "../../../components");

/** README 分组表登记的组件（**按表格行首名字解析**，维护口径见 README:182） */
const readmeNames = (() => {
  const readme = readFileSync(resolve(componentsDir, "README.md"), "utf-8");
  return [...readme.matchAll(/^\| \[?(Re[A-Za-z]+)\]?/gm)].map(
    match => match[1]
  );
})();

describe("playground registry", () => {
  it("注册表名字全部唯一", () => {
    const names = PLAYGROUND_ENTRIES.map(entry => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("分组键全部合法", () => {
    const valid = Object.keys(CATEGORY_LABELS) as PlaygroundCategory[];
    for (const entry of PLAYGROUND_ENTRIES) {
      expect(valid).toContain(entry.category);
    }
  });

  it("注册表覆盖 README 分组表的全部组件（消化登记漂移）", () => {
    const registered = new Set(PLAYGROUND_ENTRIES.map(entry => entry.name));
    const missing = readmeNames.filter(name => !registered.has(name));
    expect(missing).toEqual([]);
  });

  it("README 不再引用已删除的组件（历史漂移回归位）", () => {
    const readme = readFileSync(resolve(componentsDir, "README.md"), "utf-8");
    expect(readme).not.toContain("ReAuth");
  });

  it("有样例的组件 demo 路由必须是已定义的三个 demo 页之一", () => {
    const routes = new Set([
      "/playground/display",
      "/playground/layout",
      "/playground/input"
    ]);
    for (const entry of PLAYGROUND_ENTRIES) {
      if (entry.demo) expect(routes.has(entry.demo)).toBe(true);
    }
  });

  it("每个注册的组件目录真实存在", () => {
    for (const entry of PLAYGROUND_ENTRIES) {
      expect(existsSync(resolve(componentsDir, entry.name))).toBe(true);
    }
  });

  it("demo 页面引用的组件全部已注册", () => {
    const registered = new Set(PLAYGROUND_ENTRIES.map(entry => entry.name));
    const demoDir = resolve(__dirname, "../");
    const demoFiles = ["display.vue", "layout.vue", "input.vue"];
    for (const file of demoFiles) {
      const source = readFileSync(resolve(demoDir, file), "utf-8");
      const imported = [
        ...source.matchAll(/@\/components\/(Re[A-Za-z]+)/g)
      ].map(match => match[1]);
      for (const name of imported) {
        expect(registered.has(name)).toBe(true);
      }
    }
  });
});
