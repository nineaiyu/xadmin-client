import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChartCard from "../ChartCard.vue";
import type { DashboardCard } from "@/api/dataset/datasets";

/**
 * 仪表盘卡片（ChartCard）单测。
 *
 * 核心回归：number / metric(count) 数字卡取数走 `count_only=true`——服务端
 * 跳过全量行物化仅 count，挂屏 M 张数字卡每刷新周期不再产生 M 次全量行查询。
 */

const state = vi.hoisted(() => ({
  executeMock: vi.fn(),
  aggregateMock: vi.fn(),
  setOptionsMock: vi.fn(),
  initTheme: undefined as string | undefined,
  /** 站点明暗（测试内可改：深色站点 + 大屏浅色主题是本轮的关键组合） */
  siteDark: false
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/api/dataset/datasets", () => ({
  datasetApi: {
    execute: state.executeMock,
    aggregate: state.aggregateMock
  }
}));
// 避免拉起 echarts：数字卡路径不触达图表实例；图表路径用桩记录 theme / option
vi.mock("@pureadmin/utils", () => ({
  useDark: () => ({ isDark: { value: state.siteDark } }),
  useECharts: (_el: unknown, options?: { theme?: { value?: string } }) => {
    state.initTheme = options?.theme?.value;
    return {
      setOptions: state.setOptionsMock,
      resize: vi.fn(),
      getInstance: vi.fn()
    };
  }
}));
// jsdom 容器没有布局尺寸，跳过 waitChartSized 的 rAF 轮询
vi.mock("@/utils/chart", () => ({
  waitChartSized: vi.fn().mockResolvedValue(true)
}));

const NUMBER_CARD: DashboardCard = {
  id: "c1",
  dataset: "ds-1",
  title: "总数",
  chart_type: "number"
};

const METRIC_COUNT_CARD: DashboardCard = {
  id: "c2",
  dataset: "ds-1",
  title: "计数",
  chart_type: "metric",
  metric: "count"
};

const BAR_CARD: DashboardCard = {
  id: "c3",
  dataset: "ds-1",
  title: "分布",
  chart_type: "bar",
  group_by: "gender",
  metric: "count"
};

const PIE_CARD: DashboardCard = {
  id: "c4",
  dataset: "ds-1",
  title: "占比",
  chart_type: "pie",
  group_by: "gender",
  metric: "count"
};

const mountCard = (
  card: DashboardCard,
  extraProps: Record<string, unknown> = {}
) =>
  mount(ChartCard, {
    props: { card, ...extraProps },
    global: { stubs: { "el-button": true, ReSkeleton: true } }
  });

beforeEach(() => {
  state.executeMock.mockReset().mockResolvedValue({
    code: 1000,
    data: { columns: [], rows: [], total: 42, limit: 1000 }
  });
  state.aggregateMock.mockReset().mockResolvedValue({
    code: 1000,
    data: {
      name: "x",
      metric: "count",
      series: [{ name: "A", value: 3 }]
    }
  });
  state.setOptionsMock.mockReset();
  state.initTheme = undefined;
  state.siteDark = false;
});

describe("ChartCard 数字卡 count_only", () => {
  it("number 卡：execute 携带 count_only=true，渲染 total", async () => {
    const wrapper = mountCard(NUMBER_CARD);
    await flushPromises();

    expect(state.executeMock).toHaveBeenCalledTimes(1);
    expect(state.executeMock).toHaveBeenCalledWith("ds-1", {
      count_only: true
    });
    expect(wrapper.find(".text-3xl").text()).toBe("42");
  });

  it("metric count 卡：同样走 count_only=true", async () => {
    const wrapper = mountCard(METRIC_COUNT_CARD);
    await flushPromises();

    expect(state.executeMock).toHaveBeenCalledWith("ds-1", {
      count_only: true
    });
    expect(wrapper.find(".text-3xl").text()).toBe("42");
  });

  it("业务失败：进入错误提示态并可重试", async () => {
    state.executeMock.mockResolvedValue({ code: 1001, detail: "无权限" });
    const wrapper = mountCard(NUMBER_CARD);
    await flushPromises();

    expect(wrapper.find('[data-testid="chart-card-error"]').exists()).toBe(
      true
    );
  });

  it("refreshToken 自增：原位重拉数据，令牌不变不触发", async () => {
    const wrapper = mountCard(NUMBER_CARD, { refreshToken: 0 });
    await flushPromises();
    expect(state.executeMock).toHaveBeenCalledTimes(1);

    // 刷新信号：令牌变化即重拉（卡片实例不销毁重建）
    await wrapper.setProps({ refreshToken: 1 });
    await flushPromises();
    expect(state.executeMock).toHaveBeenCalledTimes(2);

    // 令牌不变不触发拉数
    await wrapper.setProps({ refreshToken: 1 });
    await flushPromises();
    expect(state.executeMock).toHaveBeenCalledTimes(2);
  });
});

/**
 * 恒深色大屏 / 投屏：站点可能是亮色，图表必须按 forceDark 强制深色渲染，
 * 否则深色卡片里会嵌一块白底黑字（投屏页「黑白混排」现场）。
 */
describe("ChartCard 恒深色渲染", () => {
  it("forceDark：dark 主题 + 深色坐标轴 / tooltip", async () => {
    mountCard(BAR_CARD, { forceDark: true });
    await flushPromises();

    expect(state.initTheme).toBe("dark");
    expect(state.setOptionsMock).toHaveBeenCalledTimes(1);
    const option = state.setOptionsMock.mock.calls[0][0];
    expect(option.tooltip.backgroundColor).toBe("#1d1e1f");
    expect(option.tooltip.textStyle.color).toBe("#e5eaf3");
    expect(option.tooltip.axisPointer.lineStyle.color).toBe("#cfd3dc");
    expect(option.xAxis.axisLabel.color).toBe("#cfd3dc");
    expect(option.yAxis.splitLine.lineStyle.color).toBe(
      "rgba(255, 255, 255, 0.12)"
    );
  });

  it("未指定 forceDark：站点亮色时仍走 light 主题", async () => {
    mountCard(BAR_CARD);
    await flushPromises();

    expect(state.initTheme).toBe("light");
    const option = state.setOptionsMock.mock.calls[0][0];
    expect(option.tooltip.backgroundColor).toBe("#ffffff");
    expect(option.xAxis.axisLabel.color).toBe("#606266");
  });

  it("forceDark：饼图标签与引导线同步走深色（默认文本色在深底上不可读）", async () => {
    mountCard(PIE_CARD, { forceDark: true });
    await flushPromises();

    const option = state.setOptionsMock.mock.calls[0][0];
    expect(option.series[0].label.color).toBe("#cfd3dc");
    expect(option.series[0].labelLine.lineStyle.color).toBe("#4c4d4f");
    expect(option.legend.textStyle.color).toBe("#cfd3dc");
  });
});

/**
 * 大屏浅色主题：站点可能是暗色，EP 变量取到的是深底浅字——浅色画布上不可读，
 * 故 forceLight 走固定浅色基线（与 forceDark 对称）。
 */
describe("ChartCard 强制浅色渲染", () => {
  it("站点暗色 + forceLight：light 主题 + 固定浅色基线", async () => {
    state.siteDark = true;
    mountCard(BAR_CARD, { forceLight: true });
    await flushPromises();

    expect(state.initTheme).toBe("light");
    const option = state.setOptionsMock.mock.calls[0][0];
    expect(option.tooltip.backgroundColor).toBe("#ffffff");
    expect(option.tooltip.textStyle.color).toBe("#303133");
    expect(option.xAxis.axisLabel.color).toBe("#606266");
    expect(option.yAxis.splitLine.lineStyle.color).toBe("#ebeef5");
  });

  it("forceDark 优先于 forceLight（两者同传按深色渲染）", async () => {
    state.siteDark = false;
    mountCard(BAR_CARD, { forceDark: true, forceLight: true });
    await flushPromises();

    expect(state.initTheme).toBe("dark");
    expect(state.setOptionsMock.mock.calls[0][0].tooltip.backgroundColor).toBe(
      "#1d1e1f"
    );
  });

  it("浅色主题落在根类上（骨架同步走浅色，不闪深块）", async () => {
    state.siteDark = true;
    const wrapper = mountCard(BAR_CARD, { forceLight: true });
    await flushPromises();

    expect(wrapper.classes()).toContain("chart-card--force-light");
    expect(wrapper.attributes("data-chart-theme")).toBe("light");
  });
});
