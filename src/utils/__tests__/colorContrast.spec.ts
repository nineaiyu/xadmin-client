import { describe, expect, it } from "vitest";
import { pickSelectedForeground, relativeLuminance } from "../colorContrast";

/** 选中态前景自适应（浅主色下白字对比度不足 → 按底色亮度选黑/白档） */
describe("relativeLuminance", () => {
  it("纯黑 / 纯白端点", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("支持 #rgb 三位缩写", () => {
    expect(relativeLuminance("#fff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000")).toBeCloseTo(0, 5);
  });

  it("默认主色（#006be6）为暗底 → 白字档", () => {
    expect(relativeLuminance("#006be6")).toBeLessThan(0.24);
  });

  it("浅主色（金色 #faad14）为亮底 → 应切深色文字", () => {
    expect(relativeLuminance("#faad14")).toBeGreaterThan(0.24);
  });

  it("不合法输入返回 null（调用方保守回落）", () => {
    expect(relativeLuminance("")).toBeNull();
    expect(relativeLuminance("not-a-color")).toBeNull();
    expect(relativeLuminance("#12")).toBeNull();
    expect(relativeLuminance("#zzzzzz")).toBeNull();
  });
});

describe("pickSelectedForeground", () => {
  const dark = "var(--el-color-white)";
  const light = "var(--el-text-color-primary)";

  it("暗底 → 浅色前景（默认主色行为与修复前一致）", () => {
    expect(pickSelectedForeground("#006be6", light, dark)).toBe(dark);
  });

  it("亮底 → 深色前景（浅主色白字对比度不足的场景）", () => {
    expect(pickSelectedForeground("#faad14", light, dark)).toBe(light);
    expect(pickSelectedForeground("#ffffff", light, dark)).toBe(light);
  });

  it("近黑底 → 浅色前景", () => {
    expect(pickSelectedForeground("#000000", light, dark)).toBe(dark);
  });

  it("底色不合法 → 保守回落暗底档（不比现状差）", () => {
    expect(pickSelectedForeground("", light, dark)).toBe(dark);
    expect(pickSelectedForeground("hsl(210 100% 50%)", light, dark)).toBe(dark);
  });
});
