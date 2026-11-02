import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import { buildIntervalEveryText } from "./everyText";

const t = ((key: string, params?: Record<string, unknown>) =>
  key === "systemTaskInterval.nextApprox"
    ? `下次约 ${params?.time}`
    : key) as never;

const now = dayjs("2026-10-30T10:00:00");

describe("buildIntervalEveryText", () => {
  it("保留周期数值并追加下次时间（不再整列替换为「下次约」）", () => {
    expect(
      buildIntervalEveryText(
        { every: 5, period: { value: "minutes", label: "分钟" } },
        t,
        now
      )
    ).toBe("5 分钟 · 下次约 10-30 10:05:00");
  });

  it("microseconds 按 1000µs = 1ms 换算（不再错当毫秒放大 1000 倍）", () => {
    expect(
      buildIntervalEveryText(
        { every: 500000, period: { value: "microseconds", label: "微秒" } },
        t,
        now
      )
    ).toBe("500000 微秒 · 下次约 10-30 10:00:00");
    expect(
      buildIntervalEveryText(
        { every: 2000000, period: { value: "microseconds", label: "微秒" } },
        t,
        now
      )
    ).toBe("2000000 微秒 · 下次约 10-30 10:00:02");
  });

  it("未知周期 / 非正数值只展示原值，不猜时间", () => {
    expect(
      buildIntervalEveryText({ every: 3, period: { value: "weeks" } }, t, now)
    ).toBe("3 weeks");
    expect(buildIntervalEveryText({ every: 0 }, t, now)).toBe("0");
  });
});
