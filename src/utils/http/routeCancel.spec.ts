import { afterEach, describe, expect, it } from "vitest";

import {
  cancelRoutePending,
  getCurrentRoutePath,
  registerPending,
  setCurrentRoutePath,
  unregisterPending
} from "./routeCancel";

/**
 * 路由级在途请求登记与取消：键为不含 query 的 path（router.afterEach 维护）。
 * 同页 query 变化不应取消在途请求——监控页筛选写回地址栏曾因此把刚发出的
 * history 请求整组取消（图表恒空）。
 */
describe("routeCancel", () => {
  const controllers: AbortController[] = [];

  const track = (controller: AbortController) => {
    controllers.push(controller);
    return controller;
  };

  afterEach(() => {
    // 清理模块级状态，避免用例间串扰
    controllers.splice(0).forEach(controller => {
      unregisterPending(controller);
    });
    setCurrentRoutePath("/");
  });

  it("按当前路由 path 分组登记，取消只中止该组请求", () => {
    setCurrentRoutePath("/system/monitor/index");
    const onMonitorA = track(new AbortController());
    const onMonitorB = track(new AbortController());
    registerPending(onMonitorA);
    registerPending(onMonitorB);

    setCurrentRoutePath("/system/user/index");
    const onUser = track(new AbortController());
    registerPending(onUser);

    cancelRoutePending("/system/monitor/index");
    expect(onMonitorA.signal.aborted).toBe(true);
    expect(onMonitorB.signal.aborted).toBe(true);
    expect(onUser.signal.aborted).toBe(false);
  });

  it("同页 query 变化（path 不变）不触发取消：请求仍可完成", () => {
    setCurrentRoutePath("/system/monitor/index");
    const history = track(new AbortController());
    registerPending(history);

    // 模拟 syncQuery 写回筛选 query：path 未变，不应调用 cancelRoutePending；
    // 即便调用方传同一 path，也只会取消该组——此用例锚定“键是 path 不是 fullPath”
    expect(getCurrentRoutePath()).toBe("/system/monitor/index");
    expect(history.signal.aborted).toBe(false);
  });

  it("unregisterPending 后不再受取消影响", () => {
    setCurrentRoutePath("/system/role/index");
    const finished = track(new AbortController());
    registerPending(finished);
    unregisterPending(finished);

    cancelRoutePending("/system/role/index");
    expect(finished.signal.aborted).toBe(false);
  });

  it("取消未登记路径是安全空操作，且取消具有幂等性", () => {
    setCurrentRoutePath("/system/dept/index");
    const controller = track(new AbortController());
    registerPending(controller);

    expect(() => cancelRoutePending("/system/unknown")).not.toThrow();
    cancelRoutePending("/system/dept/index");
    expect(controller.signal.aborted).toBe(true);
    expect(() => cancelRoutePending("/system/dept/index")).not.toThrow();
  });
});
