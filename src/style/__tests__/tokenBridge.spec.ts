import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tailwind 令牌桥接守护（tailwind.css 的「设计尺度令牌 → Tailwind 命名空间」映射）：
 * - 每条映射的值只允许 `var(--令牌)` 形态——不得内联具体数值（防第二套尺度回潮）；
 * - 引用的令牌必须在 tokens 层（primitives/semantic/ep-bridge/presets）真实定义，
 *   令牌改名/删除而映射未同步即失败；
 * - 映射清单与预期逐项一致（防误删导致工具类悄悄退回 Tailwind 默认尺度）。
 * 另守护「差异档保留 Tailwind 默认」的口径：text-sm / text-base / 阴影三档不得被覆盖。
 */
describe("Tailwind 令牌桥接（@theme inline 映射）", () => {
  const read = (path: string) =>
    readFileSync(resolve(process.cwd(), path), "utf-8");

  const tailwind = read("src/style/tailwind.css");
  const tokenSources = ["primitives", "semantic", "ep-bridge", "presets"]
    .map(fileName => read(`src/style/tokens/${fileName}.scss`))
    .join("\n");

  /** 定位「设计尺度令牌」映射块（尾随注释段落之后的 @theme inline 块） */
  const marker = "设计尺度令牌 → Tailwind 命名空间";
  const markerIndex = tailwind.indexOf(marker);
  const blockStart = tailwind.indexOf("@theme inline {", markerIndex);
  const blockEnd = tailwind.indexOf("\n}", blockStart);
  const block = tailwind.slice(blockStart, blockEnd);
  const mappings = [
    ...block.matchAll(/(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\);/g)
  ].map(match => ({ property: match[1], token: match[2] }));

  /** 预期映射清单（token 桥接的完整面，逐项核对） */
  const EXPECTED_PROPERTIES = [
    "--radius-xs",
    "--radius-sm",
    "--radius-md",
    "--radius-lg",
    "--radius-xl",
    "--radius-full",
    "--spacing",
    "--text-2xs",
    "--text-xs",
    "--text-md",
    "--text-lg",
    "--text-xl",
    "--text-2xl",
    "--shadow-float",
    "--ease-standard",
    "--ease-emphasized",
    "--duration-instant",
    "--duration-fast",
    "--duration-base",
    "--duration-slow",
    "--duration-slower"
  ];

  it("映射块可定位且非空", () => {
    expect(markerIndex, "缺少「设计尺度令牌」注释段").toBeGreaterThan(-1);
    expect(mappings.length).toBeGreaterThan(0);
  });

  it("映射清单与预期逐项一致（防误删/误增）", () => {
    const actual = mappings.map(item => item.property).sort();
    expect(actual).toEqual([...EXPECTED_PROPERTIES].sort());
  });

  it("每条映射的值都指向真实存在的令牌定义", () => {
    for (const { property, token } of mappings) {
      expect(
        new RegExp(`${token}:`).test(tokenSources),
        `${property} 引用的 ${token} 未在 tokens 层定义`
      ).toBe(true);
    }
  });

  it("映射值不得内联具体数值（防第二套尺度）", () => {
    // 逐条扫块内声明：等号右侧必须为 var(...)，不允许 px/rem/calc 等裸值
    const declarations = [...block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(
      match => ({ property: match[1], value: match[2].trim() })
    );
    expect(declarations.length).toBe(mappings.length);
    for (const { property, value } of declarations) {
      expect(
        value.startsWith("var("),
        `${property} 值应为 var()：${value}`
      ).toBe(true);
    }
  });

  it("差异档保留 Tailwind 默认（text-sm/text-base 与阴影三档不被覆盖）", () => {
    const properties = new Set(mappings.map(item => item.property));
    for (const kept of [
      "--text-sm",
      "--text-base",
      "--shadow-sm",
      "--shadow-md",
      "--shadow-lg"
    ]) {
      expect(properties.has(kept), `${kept} 不应出现在映射块中`).toBe(false);
    }
  });
});
