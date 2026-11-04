import { describe, expect, it, vi } from "vitest";
import { registerErrorReporter, reportGlobalError } from "../errorReporter";

describe("全局异常上报挂载点", () => {
  it("未注册时上报为静默空操作（默认零行为变化）", () => {
    expect(() =>
      reportGlobalError(new Error("x"), "render", "setup")
    ).not.toThrow();
  });

  it("注册后两条兜底链路（render / unhandledrejection）都进入上报器", () => {
    const reported: Array<[unknown, string, string | undefined]> = [];
    registerErrorReporter((error, source, info) => {
      reported.push([error, source, info]);
    });

    const renderErr = new Error("render boom");
    reportGlobalError(renderErr, "render", "render");
    reportGlobalError({ reason: "network" }, "unhandledrejection");

    expect(reported).toEqual([
      [renderErr, "render", "render"],
      [{ reason: "network" }, "unhandledrejection", undefined]
    ]);
  });

  it("后注册覆盖先注册；摘除（null）后回到静默", () => {
    const first = vi.fn();
    const second = vi.fn();
    registerErrorReporter(first);
    registerErrorReporter(second);
    reportGlobalError("e", "render");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    registerErrorReporter(null);
    expect(() => reportGlobalError("e", "render")).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
