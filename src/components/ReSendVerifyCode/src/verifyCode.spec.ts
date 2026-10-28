import { effectScope } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FormInstance } from "element-plus";
import { useVerifyCode } from "./verifyCode";

const form = {
  validateField: (_props: unknown, callback: (valid: boolean) => void) =>
    callback(true)
} as FormInstance;

describe("useVerifyCode", () => {
  afterEach(() => vi.useRealTimers());

  it("调用方状态互相隔离（不再共享模块级冷却）", async () => {
    vi.useFakeTimers();
    const first = useVerifyCode();
    const second = useVerifyCode();

    await first.start(form, ["email"], 3);
    expect(first.isDisabled.value).toBe(true);
    expect(second.isDisabled.value).toBe(false);
    expect(first.text.value).toBe("3");

    vi.advanceTimersByTime(1000);
    expect(first.text.value).toBe("2");
    expect(second.text.value).toBe("");
  });

  it("作用域销毁后停止计时器", async () => {
    vi.useFakeTimers();
    const scope = effectScope();
    const code = scope.run(() => useVerifyCode())!;

    await code.start(form, ["email"], 3);
    scope.stop();
    vi.advanceTimersByTime(5000);

    expect(code.text.value).toBe("3");
  });
});
