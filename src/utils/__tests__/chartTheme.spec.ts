import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHART_ACCENT,
  CHART_FALLBACK_FONT_FAMILY,
  chartFontFamily,
  chartTextTheme,
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

  it("EP 语义色在变量缺失时回退到默认主色体系", () => {
    expect(epColor("primary")).toBe("#006be6");
    expect(epColor("success")).toBe("#57d188");
    expect(epColor("warning")).toBe("#efbd48");
    expect(epColor("danger")).toBe("#ff3860");
    expect(epColor("info")).toBe("#909399");
  });

  it("浅色档缺失时回退到默认 tint（图标底托用）", () => {
    expect(epColorLight("primary")).toBe("#e6f0fd");
    expect(epColorLight("warning")).toBe("#fdf8ed");
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
 * 图表文字字体栈：zrender 不消费 CSS，字体只能在 init 主题层注入；
 * `--font-family-base` 是 SCSS 多行值，读取后必须折叠换行/空白（ECharts 收到
 * 带换行的字体串时 canvas/SVG 解析会静默丢字体）。
 */
describe("chartFontFamily 字体栈注入", () => {
  afterEach(() => {
    document.documentElement.style.cssText = "";
  });

  it("变量缺失时回退到与应用字体栈同源的常量", () => {
    expect(chartFontFamily()).toBe(CHART_FALLBACK_FONT_FAMILY);
    expect(chartTextTheme()).toEqual({
      textStyle: { fontFamily: CHART_FALLBACK_FONT_FAMILY }
    });
  });

  it("变量存在时取实际值并折叠换行与多余空白", () => {
    document.documentElement.style.setProperty(
      "--font-family-base",
      '-apple-system,\n    "PingFang SC",\n    sans-serif'
    );
    expect(chartFontFamily()).toBe('-apple-system, "PingFang SC", sans-serif');
  });
});

/**
 * 变量值 → 字面量色值：项目 EP 桥接层把颜色写成 hsl(var(--token))，computed value
 * 展开后是 CSS Color 4 空格语法（如 `hsl(217 85% 45%)`），而 zrender 的颜色解析
 * 只认逗号语法（parse 前会整体删空格再匹配）——直接喂给图表会让渐变 colorStops
 * 落成 undefined，悬停等状态动画插值时持续抛 Cannot read properties of undefined。
 * 这里守护「经浏览器探针解析为 rgb 字面量」与「解析失败回退」两条路径。
 */
describe("chartTheme 取色的字面量解析", () => {
  afterEach(() => {
    document.documentElement.style.cssText = "";
    vi.restoreAllMocks();
  });

  /** 构造 getComputedStyle 的桩返回值（Partial 中转避免整体实现 CSSStyleDeclaration） */
  const fakeStyle = (patch: Partial<CSSStyleDeclaration>) =>
    patch as CSSStyleDeclaration;

  it("空格语法 hsl 经浏览器解析为 rgb（zrender 只认逗号语法）", () => {
    // jsdom 的 supports 语法校验偏旧，这里显式声明该值有效，聚焦探针解析路径
    vi.spyOn(CSS, "supports").mockReturnValue(true);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => {
      if (el === document.documentElement) {
        return fakeStyle({
          getPropertyValue: (name: string) =>
            name === "--el-bg-color-overlay" ? "hsl(0 0% 100%)" : ""
        });
      }
      // 探针元素：模拟浏览器把空格语法解析成 rgb 形式
      return fakeStyle({ color: "rgb(255, 255, 255)" });
    });

    expect(cssVarColor("--el-bg-color-overlay", "#ffffff")).toBe(
      "rgb(255, 255, 255)"
    );
  });

  it("解析不出颜色时回退兜底值（不把非法色值喂给图表）", () => {
    vi.spyOn(CSS, "supports").mockReturnValue(true);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => {
      if (el === document.documentElement) {
        return fakeStyle({ getPropertyValue: () => "var(--not-defined)" });
      }
      return fakeStyle({ color: "" });
    });

    expect(cssVarColor("--el-bg-color-overlay", "#ffffff")).toBe("#ffffff");
  });

  it("hex 与 rgb 字面量直连返回（不走 DOM 解析）", () => {
    document.documentElement.style.setProperty("--brand-hex", "#123456");
    document.documentElement.style.setProperty("--brand-rgb", "rgb(1, 2, 3)");

    expect(cssVarColor("--brand-hex", "#ffffff")).toBe("#123456");
    expect(cssVarColor("--brand-rgb", "#ffffff")).toBe("rgb(1, 2, 3)");
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
