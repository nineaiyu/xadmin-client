import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { exportStatsMock, importStatsMock, taskStatsMock, hasAuthMock } =
  vi.hoisted(() => ({
    exportStatsMock: vi.fn(),
    importStatsMock: vi.fn(),
    taskStatsMock: vi.fn(),
    hasAuthMock: vi.fn()
  }));

vi.mock("@/api/task/export", () => ({
  exportRecordApi: { stats: exportStatsMock }
}));
vi.mock("@/api/task/import", () => ({
  importRecordApi: { stats: importStatsMock }
}));
vi.mock("@/api/task/task", () => ({
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

let activeWrapper: ReturnType<typeof mountTaskCenter> | null = null;

/** 挂载并登记：模块级轮询是单例（按订阅者计数），用例结束必须卸载回收 */
function mountAndTrack() {
  activeWrapper = mountTaskCenter();
  return activeWrapper;
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
    activeWrapper?.unmount();
    activeWrapper = null;
    vi.useRealTimers();
  });

  it("三类统计聚合进 runningCount（只计进行中）", async () => {
    mountAndTrack();
    await vi.advanceTimersByTimeAsync(0);
    expect(runningCount.value).toBe(9);
  });

  it("无权限码的类型跳过请求且计数为 0，不影响其他类型", async () => {
    hasAuthMock.mockImplementation(
      (code: string) => code !== "stats:SystemImportRecord"
    );
    mountAndTrack();
    await vi.advanceTimersByTimeAsync(0);
    expect(importStatsMock).not.toHaveBeenCalled();
    expect(exportStatsMock).toHaveBeenCalledTimes(1);
    expect(taskStatsMock).toHaveBeenCalledTimes(1);
    expect(runningCount.value).toBe(6);
  });

  it("单类失败静默，其余两类照常聚合", async () => {
    importStatsMock.mockRejectedValue(new Error("network"));
    mountAndTrack();
    await vi.advanceTimersByTimeAsync(0);
    expect(runningCount.value).toBe(6);
  });

  it("挂载即拉取，60s 轮询，卸载停止", async () => {
    const wrapper = mountAndTrack();
    await vi.advanceTimersByTimeAsync(0);
    expect(exportStatsMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(exportStatsMock).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    activeWrapper = null;
    await vi.advanceTimersByTimeAsync(180_000);
    expect(exportStatsMock).toHaveBeenCalledTimes(2);
  });
});
