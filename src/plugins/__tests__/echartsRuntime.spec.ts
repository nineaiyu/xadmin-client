import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const coreMock = vi.hoisted(() => ({
  use: vi.fn(),
  registerTheme: vi.fn()
}));

vi.mock("echarts/core", () => coreMock);
vi.mock("echarts/charts", () => ({
  LineChart: {},
  BarChart: {},
  PieChart: {}
}));
vi.mock("echarts/renderers", () => ({ SVGRenderer: {} }));
vi.mock("echarts/components", () => ({
  GridComponent: {},
  TitleComponent: {},
  TooltipComponent: {},
  DataZoomComponent: {},
  LegendComponent: {},
  PolarComponent: {}
}));

const FONT_VAR = "--font-family-base";
let plugin: typeof import("../echarts");

beforeEach(async () => {
  // 上一轮（resetModules 前）的 storage / 自定义事件监听必须先摘除，否则
  // 旧模块的监听会在本轮派发时再次注册主题，造成调用次数翻倍。
  plugin?.stopChartThemeWatch();
  vi.resetModules();
  vi.useFakeTimers();
  coreMock.use.mockReset();
  coreMock.registerTheme.mockReset();
  plugin = await import("../echarts");
});

afterEach(() => {
  plugin.stopChartThemeWatch();
  vi.useRealTimers();
  document.documentElement.style.cssText = "";
});

describe("echarts 加载与主题重注册", () => {
  it("首次加载失败不缓存 rejected promise：下次调用可重试", async () => {
    coreMock.use.mockImplementationOnce(() => {
      throw new Error("registry failed");
    });
    let failure: unknown;
    try {
      await plugin.loadEcharts();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("registry failed");

    const core = await plugin.loadEcharts();
    // mock 工厂对象经 ESM 模块命名空间包装后不是同一引用；按可观测行为断言
    expect(core.use).toBe(coreMock.use);
    expect(coreMock.use).toHaveBeenCalledTimes(2);
  });

  it("偏好变化后重新注册 light/dark 主题；字体栈未变时去重", async () => {
    await plugin.loadEcharts();
    expect(coreMock.registerTheme.mock.calls.length).toBe(2);

    const family = '"Courier New", monospace';
    document.documentElement.style.setProperty(FONT_VAR, family);
    window.dispatchEvent(new Event(plugin.CHART_THEME_PREFERENCE_EVENT));
    await vi.advanceTimersByTimeAsync(200);

    expect(coreMock.registerTheme).toHaveBeenCalledWith("light", {
      textStyle: { fontFamily: family }
    });
    expect(coreMock.registerTheme).toHaveBeenCalledWith("dark", {
      textStyle: { fontFamily: family }
    });
    const afterChange = coreMock.registerTheme.mock.calls.length;
    expect(afterChange).toBe(4);

    // 同一字体栈再次触发：不重复注册
    window.dispatchEvent(new Event(plugin.CHART_THEME_PREFERENCE_EVENT));
    await vi.advanceTimersByTimeAsync(200);
    expect(coreMock.registerTheme.mock.calls.length).toBe(afterChange);
  });

  it("跨标签 layout/configure 的 storage 写入也触发重注册；无关键忽略", async () => {
    await plugin.loadEcharts();
    const family = '"Fira Code", monospace';
    document.documentElement.style.setProperty(FONT_VAR, family);

    window.dispatchEvent(
      new StorageEvent("storage", { key: "unrelated-key", newValue: "{}" })
    );
    await vi.advanceTimersByTimeAsync(200);
    expect(coreMock.registerTheme).toHaveBeenCalledTimes(2);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "responsive-configure",
        newValue: "{}"
      })
    );
    await vi.advanceTimersByTimeAsync(200);
    expect(coreMock.registerTheme).toHaveBeenCalledWith("light", {
      textStyle: { fontFamily: family }
    });
  });
});
