import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/**
 * 递归拍平语言包为 "a.b.c" 形式的叶子 key 集合。
 *
 * 数组与标量都视为叶子（数组元素不拆分为下标 key），与 vue-i18n 的取值路径一致。
 */
function flattenKeys(
  value: unknown,
  prefix = "",
  result: string[] = []
): string[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const next = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === "object" && !Array.isArray(child)) {
        flattenKeys(child, next, result);
      } else {
        result.push(next);
      }
    });
  }
  return result;
}

/** 直接读原始 YAML 文本解析：绕开 Vite i18n 插件对 locales 的编译（编译产物非原始结构） */
function loadLocaleKeys(relativePath: string): string[] {
  const filePath = new URL(relativePath, import.meta.url);
  return flattenKeys(parse(readFileSync(filePath, "utf-8")));
}

describe("i18n 语言包 key 一致性", () => {
  const enKeys = loadLocaleKeys("../../locales/en.yaml");
  const zhKeys = loadLocaleKeys("../../locales/zh-CN.yaml");

  it("zh-CN 未缺失 en 的 key", () => {
    const missing = enKeys.filter(key => !zhKeys.includes(key)).sort();
    expect(missing).toEqual([]);
  });

  it("en 未缺失 zh-CN 的 key", () => {
    const missing = zhKeys.filter(key => !enKeys.includes(key)).sort();
    expect(missing).toEqual([]);
  });
});
