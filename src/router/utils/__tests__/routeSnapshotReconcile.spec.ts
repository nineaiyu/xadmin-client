import { describe, expect, it, vi, type Mock } from "vitest";

import {
  reconcileRoutesVersionOnce,
  type RoutesVersionReconcilerOptions
} from "../routeSnapshotReconcile";

/** 等微任务队列排空（fetchVersion 的 then/catch 链在同步 schedule 下全链执行） */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

/** harness 的四个注入点全部是可断言的 mock（Mock<T> 自带 T 的调用签名） */
type Harness = RoutesVersionReconcilerOptions & {
  fetchVersion: Mock<() => Promise<string | undefined>>;
  clearSnapshot: Mock<() => void>;
  reload: Mock<() => void>;
  schedule: Mock<(fn: () => void, delayMs: number) => void>;
};

function setup(overrides: Partial<Harness> = {}): Harness {
  const base: Harness = {
    fetchVersion: vi.fn<() => Promise<string | undefined>>(),
    clearSnapshot: vi.fn<() => void>(),
    reload: vi.fn<() => void>(),
    // 退避立即触发：测试不依赖真实定时器
    schedule: vi.fn<(fn: () => void, delayMs: number) => void>(
      (fn: () => void) => fn()
    )
  };
  return { ...base, ...overrides };
}

describe("路由快照版本校验调度", () => {
  it("版本不一致：丢弃快照并整页刷新", async () => {
    const h = setup();
    h.fetchVersion.mockResolvedValue("v2");
    reconcileRoutesVersionOnce("v1", h);
    await flush();
    expect(h.clearSnapshot).toHaveBeenCalledTimes(1);
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it("版本一致：沿用快照，不清不刷", async () => {
    const h = setup();
    h.fetchVersion.mockResolvedValue("v1");
    reconcileRoutesVersionOnce("v1", h);
    await flush();
    expect(h.clearSnapshot).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
  });

  it("响应缺少版本指纹：不触发自愈（与后端契约的兼容分支）", async () => {
    const h = setup();
    h.fetchVersion.mockResolvedValue(undefined);
    reconcileRoutesVersionOnce("v1", h);
    await flush();
    expect(h.clearSnapshot).not.toHaveBeenCalled();
  });

  it("校验失败按退避重试，期内恢复且版本一致：沿用快照", async () => {
    const h = setup();
    h.fetchVersion
      .mockRejectedValueOnce(new Error("网络抖动"))
      .mockRejectedValueOnce(new Error("网络抖动"))
      .mockResolvedValue("v1");
    reconcileRoutesVersionOnce("v1", h);
    await flush();
    expect(h.fetchVersion).toHaveBeenCalledTimes(3);
    expect(h.clearSnapshot).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
  });

  it("校验失败重试耗尽：同样丢弃快照并强制重新拉取（fail-closed）", async () => {
    const h = setup();
    h.fetchVersion.mockRejectedValue(new Error("后端不可达"));
    reconcileRoutesVersionOnce("v1", h);
    await flush();
    // 默认重试 2 次 + 首次共 3 次请求
    expect(h.fetchVersion).toHaveBeenCalledTimes(3);
    expect(h.clearSnapshot).toHaveBeenCalledTimes(1);
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it("默认退避参数：30s / 最多 2 次（透传给调度器）", async () => {
    const delays: number[] = [];
    const h = setup({
      // 调度器记录退避值并真实触发：第二次 schedule 依赖第一次回调执行，
      // no-op mock 会吞掉回调让链路停在首个重试
      schedule: vi.fn((fn: () => void, delayMs: number) => {
        delays.push(delayMs);
        fn();
      })
    });
    h.fetchVersion.mockRejectedValue(new Error("x"));
    reconcileRoutesVersionOnce("v1", h);
    await flush();
    expect(h.schedule).toHaveBeenCalledWith(expect.any(Function), 30_000);
    expect(delays).toEqual([30_000, 30_000]);
    // 最多 2 次重试：首次 + 2 次退避 = 3 次请求，随后丢弃快照
    expect(h.fetchVersion).toHaveBeenCalledTimes(3);
    expect(h.clearSnapshot).toHaveBeenCalledTimes(1);
  });
});
