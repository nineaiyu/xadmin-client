import { describe, expect, it } from "vitest";

import { Md5 } from "./md5";

describe("Md5.hashStr 已知向量", () => {
  it("空串", () => {
    expect(Md5.hashStr("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  it("abc", () => {
    expect(Md5.hashStr("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("The quick brown fox jumps over the lazy dog", () => {
    expect(Md5.hashStr("The quick brown fox jumps over the lazy dog")).toBe(
      "9e107d9d372bb6826bd81d3542a419d6"
    );
  });

  it("UTF-8 中文", () => {
    expect(Md5.hashStr("中文")).toBe("a7bac2239fcdcb3a067903d8077c4a07");
  });
});

describe("Md5 增量计算与一次性计算一致", () => {
  it("appendStr 分段追加与 hashStr 结果一致", () => {
    const hasher = new Md5().start().appendStr("Hello ").appendStr("World");
    expect(hasher.end()).toBe(Md5.hashStr("Hello World"));
  });
});
