import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 站点配置的读写映射分别写在 saveSiteConfig / getSiteConfig 两个对象字面量里。
 * 新增偏好键时只改一侧会出现「保存成功但刷新丢失」或「读取不到保存值」，这里静态
 * 比对两份映射的 camelCase → PascalCase 对应关系，防止单边漂移。
 */
const source = readFileSync(
  resolve(process.cwd(), "src/store/modules/siteConfig.ts"),
  "utf-8"
);

const parsePairs = (block: string, pattern: RegExp, swap: boolean) => {
  const pairs = new Map<string, string>();
  for (const match of block.matchAll(pattern)) {
    const first = match[1];
    const second = match[2];
    pairs.set(swap ? second : first, swap ? first : second);
  }
  return pairs;
};

describe("站点配置读写映射", () => {
  it("saveSiteConfig 与 getSiteConfig 的键一一对应", () => {
    const saveStart = source.indexOf("const configObj = {");
    const saveEnd = source.indexOf("};", saveStart);
    const readStart = source.indexOf("const configObj = {", saveStart + 1);
    const readEnd = source.indexOf("} as PlatformConfigs;", readStart);

    expect(saveStart).toBeGreaterThan(-1);
    expect(readStart).toBeGreaterThan(saveStart);

    const save = parsePairs(
      source.slice(saveStart, saveEnd),
      /(\w+):\s*(?:locale|layout|configure)\.(\w+)/g,
      true
    );
    const read = parsePairs(
      source.slice(readStart, readEnd),
      /(\w+):\s*config\.(\w+)/g,
      false
    );

    expect([...save.keys()].sort()).toEqual([...read.keys()].sort());
    for (const [camel, pascal] of save) {
      expect(read.get(camel), `${camel} 的读映射不一致`).toBe(pascal);
    }
  });
});
