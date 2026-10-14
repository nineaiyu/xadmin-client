import { describe, expect, it } from "vitest";

import { buildBadgeSources, sumBadgeSources } from "./badgeSources";

describe("buildBadgeSources", () => {
  it("无其他待办时返回空数组（底栏不显示角标）", () => {
    expect(buildBadgeSources({ pending: 0, running: 0 })).toEqual([]);
    expect(buildBadgeSources({})).toEqual([]);
  });

  it("只有一路时只列出该路", () => {
    const items = buildBadgeSources({ pending: 2, running: 0 });
    expect(items.map(item => item.key)).toEqual(["pending"]);
    expect(items[0].labelKey).toBe("taskCenter.pendingApproval");
    expect(items[0].count).toBe(2);
  });

  it("两路都有时按「待审批 → 进行中任务」顺序展示", () => {
    const items = buildBadgeSources({ pending: 1, running: 3 });
    expect(items.map(item => item.key)).toEqual(["pending", "running"]);
    expect(items.map(item => item.labelKey)).toEqual([
      "taskCenter.pendingApproval",
      "taskCenter.runningTasks"
    ]);
    expect(items.map(item => item.count)).toEqual([1, 3]);
  });

  it("非法计数（负数 / NaN / 缺失）按 0 处理并从列表剔除", () => {
    expect(buildBadgeSources({ pending: -1, running: Number.NaN })).toEqual([]);
    expect(buildBadgeSources({ pending: undefined })).toEqual([]);
    expect(buildBadgeSources({ pending: 0, running: -5 })).toEqual([]);
  });
});

describe("sumBadgeSources", () => {
  it("合计即底栏角标数字（站内信之外的部分）", () => {
    expect(sumBadgeSources(buildBadgeSources({ pending: 1, running: 3 }))).toBe(
      4
    );
    expect(sumBadgeSources([])).toBe(0);
  });
});
