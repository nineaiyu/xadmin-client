import { describe, expect, it } from "vitest";

import { escapeCsvCell } from "../csv";

describe("escapeCsvCell（CSV 公式注入中和 + 转义）", () => {
  it("字符串值以 = + - @ 开头时前置单引号中和公式注入", () => {
    expect(escapeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvCell("+1|cmd")).toBe("'+1|cmd");
    expect(escapeCsvCell("@x")).toBe("'@x");
    expect(escapeCsvCell("-notanumber")).toBe("'-notanumber");
  });

  it("数字（含负数）与布尔不前置，避免数值变形", () => {
    expect(escapeCsvCell(-5)).toBe("-5");
    expect(escapeCsvCell(3.14)).toBe("3.14");
    expect(escapeCsvCell(true)).toBe("true");
  });

  it("普通文本与日期不变形（ISO 时间转本地可读格式、非危险开头不加引号）", () => {
    expect(escapeCsvCell("普通文本")).toBe("普通文本");
    expect(escapeCsvCell("2026-01-02T03:04:05Z")).toMatch(
      /^2026-01-02 \d{2}:\d{2}:\d{2}$/
    );
  });

  it("含引号/逗号/换行的文本双引号包裹且内部引号双写", () => {
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
    // 危险前缀 + 需包裹：先中和再包裹
    expect(escapeCsvCell('=cmd,"x"')).toBe('"\'=cmd,""x"""');
  });

  it("空值渲染为空串、对象序列化为 JSON（含逗号引号按规则包裹）", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
});
