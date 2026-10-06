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

const state = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/api/dataset/datasets", () => ({
  datasetApi: { execute: state.executeMock }
}));
// 避免拉起 echarts：数字卡路径不触达图表实例
vi.mock("@pureadmin/utils", () => ({
  useDark: () => ({ isDark: { value: false } }),
  useECharts: () => ({
    setOptions: vi.fn(),
    resize: vi.fn(),
    getInstance: vi.fn()
  })
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
