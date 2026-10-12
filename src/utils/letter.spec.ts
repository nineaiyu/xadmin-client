import { describe, expect, it } from "vitest";

import { kebabToCamelCase } from "./letter";

describe("kebabToCamelCase", () => {
  it("转换短横线命名为小驼峰", () => {
    expect(kebabToCamelCase("foo-bar")).toBe("fooBar");
    expect(kebabToCamelCase("foo-bar-baz")).toBe("fooBarBaz");
  });

  it("已是驼峰 / 单词原样返回", () => {
    expect(kebabToCamelCase("title")).toBe("title");
    expect(kebabToCamelCase("fooBar")).toBe("fooBar");
  });

  it("忽略多余分隔符与首尾短横线", () => {
    expect(kebabToCamelCase("-foo--bar-")).toBe("fooBar");
  });

  it("空串返回空串", () => {
    expect(kebabToCamelCase("")).toBe("");
  });
});
