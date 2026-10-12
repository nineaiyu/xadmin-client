import { describe, expect, it } from "vitest";

import { FALLBACK_TIMEZONES, resolveTimezoneOptions } from "../timezoneOptions";

/**
 * 时区候选项测试：UTC 恒在首位；`Intl.supportedValuesOf` 缺失时回落内置清单，
 * 且清单内不出现重复的 UTC。
 */

describe("resolveTimezoneOptions", () => {
  it("UTC 排在首位且不与清单重复", () => {
    const options = resolveTimezoneOptions();
    expect(options[0]).toEqual({ label: "UTC", value: "UTC" });
    expect(options.filter(item => item.value === "UTC")).toHaveLength(1);
  });

  it("每项 label 与 value 同源（IANA 名直接可读）", () => {
    const options = resolveTimezoneOptions();
    options.forEach(item => expect(item.label).toBe(item.value));
  });

  it("内置兜底清单非空且含常用时区", () => {
    expect(FALLBACK_TIMEZONES.length).toBeGreaterThan(5);
    expect(FALLBACK_TIMEZONES).toContain("Asia/Shanghai");
  });
});
