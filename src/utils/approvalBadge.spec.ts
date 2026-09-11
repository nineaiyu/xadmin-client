const { pendingCountMock, hasAuthMock } = vi.hoisted(() => ({
  pendingCountMock: vi.fn(),
  hasAuthMock: vi.fn()
}));

vi.mock("@/api/system/approval", () => ({
  approvalApi: { pendingCount: pendingCountMock }
}));

vi.mock("@/router/utils", () => ({ hasAuth: hasAuthMock }));

import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshApprovalBadge, useApprovalBadge } from "./approvalBadge";

function mountBadge() {
  return mount(
    defineComponent({
      setup() {
        return useApprovalBadge();
      },
      template: "<div>{{ pendingCount }}</div>"
    })
  );
}

describe("refreshApprovalBadge", () => {
  beforeEach(() => {
    pendingCountMock
      .mockReset()
      .mockResolvedValue({ code: 1000, data: { pending: 7 } });
    hasAuthMock.mockReset().mockReturnValue(true);
  });

  it("有权限码时拉取并写入共享计数", async () => {
    const wrapper = mountBadge();
    refreshApprovalBadge();
    await vi.waitFor(() => expect(wrapper.vm.pendingCount).toBe(7));
    wrapper.unmount();
  });

  it("无权限码直接跳过请求（不产生 403 噪声）", () => {
    hasAuthMock.mockReturnValue(false);
    refreshApprovalBadge();
    expect(pendingCountMock).not.toHaveBeenCalled();
  });

  it("响应 data 为空时保持原值", async () => {
    const wrapper = mountBadge();
    await vi.waitFor(() => expect(wrapper.vm.pendingCount).toBe(7));
    pendingCountMock.mockResolvedValue({ code: 1000, data: null });
    refreshApprovalBadge();
    await vi.waitFor(() => expect(pendingCountMock).toHaveBeenCalledTimes(2));
    expect(wrapper.vm.pendingCount).toBe(7);
    wrapper.unmount();
  });

  it("拉取失败静默，不影响主流程", async () => {
    pendingCountMock.mockRejectedValue(new Error("network"));
    refreshApprovalBadge(); // 返回 void：内部吞掉 rejection，不得抛 unhandled
    await vi.waitFor(() => expect(pendingCountMock).toHaveBeenCalledTimes(1));
  });
});

describe("useApprovalBadge 轮询生命周期", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pendingCountMock
      .mockReset()
      .mockResolvedValue({ code: 1000, data: { pending: 3 } });
    hasAuthMock.mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("挂载即拉取一次，60s 轮询，卸载停止", async () => {
    const wrapper = mountBadge();
    await vi.advanceTimersByTimeAsync(0);
    expect(pendingCountMock).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.pendingCount).toBe(3);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(pendingCountMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(pendingCountMock).toHaveBeenCalledTimes(3);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(pendingCountMock).toHaveBeenCalledTimes(3);
  });
});
