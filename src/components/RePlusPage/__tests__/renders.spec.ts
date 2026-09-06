import { describe, expect, it } from "vitest";

import { formatAddOrEditOptions } from "../src/utils/renders";

describe("formatAddOrEditOptions", () => {
  it("标量选项：value 透传，pk 取自 value", () => {
    const result = formatAddOrEditOptions([
      { value: 1, label: "启用" },
      { value: 0, label: "禁用" }
    ]);
    expect(result).toEqual([
      { label: "启用", value: 1, fieldItemProps: { disabled: undefined } },
      { label: "禁用", value: 0, fieldItemProps: { disabled: undefined } }
    ]);
  });

  it("isObjValue=true 时 value 为完整选项对象并带 pk", () => {
    const option = { value: "a", label: "A" };
    const result = formatAddOrEditOptions([option], true);
    expect(result[0].value).toEqual({ pk: "a", value: "a", label: "A" });
    expect(result[0].value.pk).toBe("a");
  });

  it("disabled 透传到 fieldItemProps", () => {
    const result = formatAddOrEditOptions([
      { value: 2, label: "锁定", disabled: true }
    ]);
    expect(result[0].fieldItemProps.disabled).toBe(true);
  });

  it("data 为空时返回空数组", () => {
    expect(formatAddOrEditOptions([])).toEqual([]);
    expect(
      formatAddOrEditOptions(
        undefined as unknown as Array<{ value: unknown; label?: unknown }>
      )
    ).toEqual([]);
  });
});
