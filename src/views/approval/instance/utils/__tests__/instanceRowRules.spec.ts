import { describe, expect, it } from "vitest";

import { hasMyTask, statusValue } from "../instanceRowRules";

describe("hasMyTask", () => {
  it("is true only when the row carries my_task", () => {
    expect(hasMyTask({ my_task: { pk: "t1" } })).toBe(true);
    expect(hasMyTask({ my_task: 1 })).toBe(true);
    expect(hasMyTask({})).toBe(false);
    expect(hasMyTask({ my_task: null })).toBe(false);
  });
});

describe("statusValue", () => {
  it("unwraps {value,label} status objects", () => {
    expect(statusValue({ status: { value: "PENDING" } })).toBe("PENDING");
    // 对象形态但缺 value 时原样回退整对象（与框架行状态口径一致）
    const partial = { label: "无值" };
    expect(statusValue({ status: partial as { value?: string } })).toBe(
      partial
    );
  });

  it("passes bare string statuses through", () => {
    expect(statusValue({ status: "REJECTED" })).toBe("REJECTED");
    expect(statusValue({})).toBeUndefined();
  });
});
