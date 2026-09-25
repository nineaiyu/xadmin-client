import { afterEach, describe, expect, it } from "vitest";
import {
  CHART_ACCENT,
  cssVarColor,
  epColor,
  epColorLight
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
