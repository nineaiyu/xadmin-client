import { afterEach, describe, expect, it, vi } from "vitest";

import { useVerifyCode } from "../src/verifyCode";

describe("ReSendVerifyCode 倒计时", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("校验通过后倒计时、结束自动恢复可点", async () => {
    vi.useFakeTimers();
    const code = useVerifyCode();
    const form = {
      validateField: (_prop: unknown, callback: (ok: boolean) => void) =>
        callback(true)
    };

    await code.start(form as never, "email", 2);
    expect(code.isDisabled.value).toBe(true);
    expect(code.text.value).toBe("2");

    vi.advanceTimersByTime(1000);
    expect(code.text.value).toBe("1");

    vi.advanceTimersByTime(1000);
    expect(code.text.value).toBe("0");
    vi.advanceTimersByTime(1000);
    expect(code.text.value).toBe("");
    expect(code.isDisabled.value).toBe(false);
  });

  it("校验未通过不启动倒计时", async () => {
    vi.useFakeTimers();
    const code = useVerifyCode();
    const form = {
      validateField: (_prop: unknown, callback: (ok: boolean) => void) =>
        callback(false)
    };
    await code.start(form as never, "email", 60);
    expect(code.isDisabled.value).toBe(false);
    expect(code.text.value).toBe("");
  });
});
