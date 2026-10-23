import { describe, expect, it } from "vitest";

import { resolveAiConsoleReady } from "../aiConsoleState";

describe("AI 控制台就绪判定", () => {
  it("状态可用时按 enabled/configured 判定", () => {
    expect(
      resolveAiConsoleReady({ enabled: true, configured: true }, false)
    ).toBe(true);
    expect(
      resolveAiConsoleReady({ enabled: true, configured: false }, true)
    ).toBe(false);
    expect(
      resolveAiConsoleReady({ enabled: false, configured: true }, true)
    ).toBe(false);
  });

  it("状态不可用但只授 ask：仍允许提问（不再整页死路）", () => {
    expect(resolveAiConsoleReady(null, true)).toBe(true);
    expect(resolveAiConsoleReady(null, false)).toBe(false);
  });
});
