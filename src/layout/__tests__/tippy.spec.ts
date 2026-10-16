import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "vue";

import { setupTippy } from "../tippy";

/** 布局重复挂载（账号设置等无布局页面返回）时不能重复注册插件 */
describe("setupTippy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function emptyApp() {
    return createApp({ render: () => null });
  }

  it("同一应用重复调用只注册一次", () => {
    const app = emptyApp();
    const use = vi.spyOn(app, "use");

    setupTippy(app);
    setupTippy(app);

    expect(use).toHaveBeenCalledTimes(1);
    expect(app.directive("tippy")).toBeTruthy();
    expect(app.component("tippy")).toBeTruthy();
  });

  it("重复调用不再触发 Vue 的重复插件告警", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn());
    const app = emptyApp();

    setupTippy(app);
    setupTippy(app);

    expect(warn.mock.calls.flat().join(" ")).not.toContain(
      "already been applied"
    );
  });

  it("不同应用各自注册一次", () => {
    const first = emptyApp();
    const second = emptyApp();
    const useFirst = vi.spyOn(first, "use");
    const useSecond = vi.spyOn(second, "use");

    setupTippy(first);
    setupTippy(second);

    expect(useFirst).toHaveBeenCalledTimes(1);
    expect(useSecond).toHaveBeenCalledTimes(1);
  });
});
