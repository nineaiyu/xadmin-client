import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { exportStatsMock, importStatsMock, taskStatsMock, hasAuthMock } =
  vi.hoisted(() => ({
    exportStatsMock: vi.fn(),
    importStatsMock: vi.fn(),
    taskStatsMock: vi.fn(),
    hasAuthMock: vi.fn()
  }));

vi.mock("@/api/system/export", () => ({
  exportRecordApi: { stats: exportStatsMock }
}));
vi.mock("@/api/system/import", () => ({
  importRecordApi: { stats: importStatsMock }
}));
vi.mock("@/api/system/task", () => ({
  taskExecutionApi: { stats: taskStatsMock }
}));
vi.mock("@/router/utils", () => ({ hasAuth: hasAuthMock }));

import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { runningCount, useTaskCenter } from "./taskCenter";

const STATS = (inProgress: number) => ({
  days: 30,
  total: 10,
  in_progress: inProgress,
  failed: 0,
  latest: null
});

function mountTaskCenter() {
  return mount(
    defineComponent({
      setup() {
        return useTaskCenter();
      },
      template: "<div>{{ runningCount }}</div>"
    })
  );
}

describe("refreshTaskCenter 聚合统计", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    exportStatsMock
      .mockReset()
      .mockResolvedValue({ code: 1000, data: STATS(2) });
    importStatsMock
      .mockReset()
      .mockResolvedValue({ code: 1000, data: STATS(3) });
    taskStatsMock.mockReset().mockResolvedValue({ code: 1000, data: STATS(4) });
    hasAuthMock.mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("三类统计聚合进 runningCount（只计进行中）", async () => {
    mountTaskCenter();
    await vi.advanceTimersByTimeAsync(0);
    expect(runningCount.value).toBe(9);
  });

  it("无权限码的类型跳过请求且计数为 0，不影响其他类型", async () => {
    hasAuthMock.mockImplementation(
      (code: string) => code !== "stats:SystemImportRecord"
    );
    mountTaskCenter();
    await vi.advanceTimersByTimeAsync(0);
    expect(importStatsMock).not.toHaveBeenCalled();
    expect(exportStatsMock).toHaveBeenCalledTimes(1);
    expect(taskStatsMock).toHaveBeenCalledTimes(1);
    expect(runningCount.value).toBe(6);
  });

  it("单类失败静默，其余两类照常聚合", async () => {
    importStatsMock.mockRejectedValue(new Error("network"));
    mountTaskCenter();
    await vi.advanceTimersByTimeAsync(0);
    expect(runningCount.value).toBe(6);
  });

  it("挂载即拉取，60s 轮询，卸载停止", async () => {
    const wrapper = mountTaskCenter();
    await vi.advanceTimersByTimeAsync(0);
    expect(exportStatsMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(exportStatsMock).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(exportStatsMock).toHaveBeenCalledTimes(2);
  });
});
