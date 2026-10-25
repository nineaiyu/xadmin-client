import { describe, expect, it } from "vitest";
import { ref } from "vue";

import type { DashboardCard, DatasetItem } from "@/api/dataset/datasets";
import { useDashboardLinkage } from "../useDashboardLinkage";

/**
 * 仪表盘卡片联动状态机：
 * - 点击带 raw 的维度值 → 设置/切换联动并报告变化（变化才整盘刷新）；
 * - 来源卡不参与自身联动；数据集缺该维度字段的卡静默跳过；
 * - 无分组 / 趋势序列（无 raw）点击不改变联动。
 */

/** 最小数据集夹具：联动判定只消费 pk 与 columns */
function makeDataset(pk: string, columns: string[]): DatasetItem {
  return {
    pk,
    name: pk,
    description: "",
    bound_model: "",
    columns,
    filters: [],
    ordering: "",
    row_limit: 1000,
    config: {},
    visibility: "shared"
  };
}

const DATASETS = ref<DatasetItem[]>([
  makeDataset("ds-a", ["category", "name"]),
  makeDataset("ds-b", ["name"])
]);

const SOURCE: DashboardCard = {
  id: "card-1",
  dataset: "ds-a",
  title: "分布",
  chart_type: "bar",
  group_by: "category",
  metric: "count"
};

const SAME_DATASET: DashboardCard = {
  id: "card-2",
  dataset: "ds-a",
  title: "同集卡",
  chart_type: "pie",
  group_by: "category"
};

const OTHER_FIELD: DashboardCard = {
  id: "card-3",
  dataset: "ds-b",
  title: "缺字段卡",
  chart_type: "number"
};

describe("useDashboardLinkage", () => {
  it("带 raw 的分组点击设置联动并报告变化", () => {
    const { linkage, applyFromPoint } = useDashboardLinkage({
      datasets: DATASETS
    });
    const changed = applyFromPoint(SOURCE, { name: "小说", raw: 0 });
    expect(changed).toBe(true);
    expect(linkage.value).toEqual({
      field: "category",
      label: "小说",
      value: 0,
      sourceCardId: "card-1",
      sourceTitle: "分布"
    });
  });

  it("同一维度值重复点击不报告变化（不触发多余整盘刷新）", () => {
    const { applyFromPoint } = useDashboardLinkage({ datasets: DATASETS });
    applyFromPoint(SOURCE, { name: "小说", raw: 0 });
    expect(applyFromPoint(SOURCE, { name: "小说", raw: 0 })).toBe(false);
  });

  it("切换维度值 / 来源卡均报告变化", () => {
    const { applyFromPoint } = useDashboardLinkage({ datasets: DATASETS });
    applyFromPoint(SOURCE, { name: "小说", raw: 0 });
    expect(applyFromPoint(SOURCE, { name: "文学", raw: 1 })).toBe(true);
    expect(applyFromPoint(SAME_DATASET, { name: "文学", raw: 1 })).toBe(true);
  });

  it("无分组或趋势序列（无 raw）点击不改变联动", () => {
    const { linkage, applyFromPoint } = useDashboardLinkage({
      datasets: DATASETS
    });
    expect(
      applyFromPoint({ ...SOURCE, group_by: undefined }, { name: "x", raw: 1 })
    ).toBe(false);
    expect(applyFromPoint(SOURCE, { name: "2026-10" })).toBe(false);
    expect(linkage.value).toBeNull();
  });

  it("payloadFor：来源卡排除，缺字段的数据集卡跳过，命中卡下发过滤", () => {
    const { applyFromPoint, payloadFor } = useDashboardLinkage({
      datasets: DATASETS
    });
    applyFromPoint(SOURCE, { name: "小说", raw: 0 });
    expect(payloadFor(SOURCE)).toBeNull();
    expect(payloadFor(SAME_DATASET)).toEqual({ field: "category", value: 0 });
    expect(payloadFor(OTHER_FIELD)).toBeNull();
  });

  it("清除后所有卡回到全量", () => {
    const { linkage, applyFromPoint, clear, payloadFor } = useDashboardLinkage({
      datasets: DATASETS
    });
    applyFromPoint(SOURCE, { name: "小说", raw: 0 });
    clear();
    expect(linkage.value).toBeNull();
    expect(payloadFor(SAME_DATASET)).toBeNull();
  });
});
