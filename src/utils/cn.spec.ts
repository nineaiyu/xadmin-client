import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn 类名合并", () => {
  it("拼接多个字符串", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("过滤假值", () => {
    expect(cn("a", false, null, undefined, "", 0, "b")).toBe("a b");
  });

  it("支持对象与数组形态", () => {
    expect(cn({ a: true, b: false }, ["c", "d"])).toBe("a c d");
  });

  it("消解冲突的 Tailwind 工具类（后者胜）", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-xs", undefined, "text-lg")).toBe("text-lg");
  });

  it("非冲突类名原样保留", () => {
    expect(cn("flex", "p-2")).toBe("flex p-2");
  });
});
