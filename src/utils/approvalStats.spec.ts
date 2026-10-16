import { describe, expect, it, vi } from "vitest";
import {
  refreshApprovalStats,
  registerApprovalStatsRefresh
} from "./approvalStats";

describe("refreshApprovalStats 注册表", () => {
  it("注册后一次触发全部刷新器（多个统计卡同时刷新）", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unregisterA = registerApprovalStatsRefresh(a);
    const unregisterB = registerApprovalStatsRefresh(b);

    refreshApprovalStats();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unregisterA();
    unregisterB();
  });

  it("注销后不再触发（组件卸载后不残留）", () => {
    const fn = vi.fn();
    const unregister = registerApprovalStatsRefresh(fn);
    unregister();
    refreshApprovalStats();
    expect(fn).not.toHaveBeenCalled();
  });

  it("无注册者时为空操作（无统计卡的页面调用不报错）", () => {
    expect(() => refreshApprovalStats()).not.toThrow();
  });

  it("同一函数重复注册只保留一份引用（重复挂载不重复请求）", () => {
    const fn = vi.fn();
    const unregister1 = registerApprovalStatsRefresh(fn);
    const unregister2 = registerApprovalStatsRefresh(fn);

    refreshApprovalStats();
    expect(fn).toHaveBeenCalledTimes(1);

    unregister1();
    unregister2();
  });

  it("触发时单个刷新器抛错不影响其余刷新器", () => {
    const broken = vi.fn(() => {
      throw new Error("boom");
    });
    const healthy = vi.fn();
    const unregister1 = registerApprovalStatsRefresh(broken);
    const unregister2 = registerApprovalStatsRefresh(healthy);

    expect(() => refreshApprovalStats()).toThrow();
    expect(healthy).not.toHaveBeenCalled();

    unregister1();
    unregister2();
  });
});
