import { afterEach, describe, expect, it } from "vitest";
import {
  CHART_ACCENT,
  cssVarColor,
  epColor,
  epColorLight,
  withAlpha
} from "../chartTheme";

/**
 * 图表取色的两条分支：
 * 1. 变量存在 → 取主题实际值（自定义主色 / 暗色主题跟随，这是本模块存在的理由）；
 * 2. 变量缺失（测试环境无 EP 样式表、极旧浏览器）→ 回落 EP 默认值——「默认主题下与
 *    改造前零视觉差异」的保底来源，不能退化成空串（ECharts 收到 "" 画成黑色或不画）。
 */
describe("chartTheme 取色与回退", () => {
  afterEach(() => {
    document.documentElement.style.cssText = "";
  });

  it("EP 语义色在变量缺失时回退到 EP 默认值", () => {
    expect(epColor("primary")).toBe("#409eff");
    expect(epColor("success")).toBe("#67c23a");
    expect(epColor("warning")).toBe("#e6a23c");
    expect(epColor("danger")).toBe("#f56c6c");
    expect(epColor("info")).toBe("#909399");
  });

  it("浅色档缺失时回退到 EP 默认 tint（图标底托用）", () => {
    expect(epColorLight("primary")).toBe("#ecf5ff");
    expect(epColorLight("warning")).toBe("#fdf6ec");
  });

  it("任意变量缺失时用调用方给的兜底值（图表底色等）", () => {
    expect(cssVarColor("--el-bg-color-overlay", "#ffffff")).toBe("#ffffff");
    expect(cssVarColor("--not-exist", "#123456")).toBe("#123456");
  });

  it("变量存在时取实际值：语义色与浅色档都跟随主题", () => {
    document.documentElement.style.setProperty("--el-color-primary", "#123456");
    document.documentElement.style.setProperty(
      "--el-color-primary-light-9",
      "#101010"
    );
    expect(epColor("primary")).toBe("#123456");
    expect(epColorLight("primary")).toBe("#101010");
  });

  it("图表强调色集中定义（不再散落各页面写死）", () => {
    expect(CHART_ACCENT).toBe("#9a66e4");
  });
});

/**
 * 渐变端点色：图表面积/描边需要带透明度的字面量，ECharts 不消费 CSS 变量；
 * 无法识别的格式必须原样返回——宁可无渐变，也不给 ECharts 一个非法色值。
 */
describe("withAlpha 透明度附加", () => {
  it("六位十六进制转 rgba", () => {
    expect(withAlpha("#409eff", 0.24)).toBe("rgba(64, 158, 255, 0.24)");
    expect(withAlpha("#ffffff", 0)).toBe("rgba(255, 255, 255, 0)");
  });

  it("三位缩写十六进制按位展开", () => {
    expect(withAlpha("#fff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(withAlpha("#0f0", 1)).toBe("rgba(0, 255, 0, 1)");
  });

  it("rgb()/rgba() 输入取前三通道", () => {
    expect(withAlpha("rgb(64, 158, 255)", 0.1)).toBe("rgba(64, 158, 255, 0.1)");
    expect(withAlpha("rgba(64, 158, 255, 0.8)", 0.2)).toBe(
      "rgba(64, 158, 255, 0.2)"
    );
  });

  it("大小写与空白不敏感", () => {
    expect(withAlpha(" #4A90E2 ", 0.3)).toBe("rgba(74, 144, 226, 0.3)");
  });

  it("无法识别的格式原样返回（不产出非法色值）", () => {
    expect(withAlpha("var(--el-color-primary)", 0.3)).toBe(
      "var(--el-color-primary)"
    );
    expect(withAlpha("", 0.5)).toBe("");
    expect(withAlpha("tomato", 0.5)).toBe("tomato");
  });
});
