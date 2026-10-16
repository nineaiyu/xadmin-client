import { describe, expect, it } from "vitest";

import {
  applyDeptParentColumn,
  deptParentFormValue
} from "../deptParentColumn";

type TestColumn = {
  fieldProps?: Record<string, unknown>;
  _column?: { choices?: Array<Record<string, unknown>> };
} & Record<string, unknown>;

const asColumn = (partial: TestColumn): TestColumn => partial;

describe("deptParentFormValue", () => {
  it("extracts pk from object-shaped parent", () => {
    expect(deptParentFormValue({ parent: { pk: 7 } })).toBe(7);
    expect(deptParentFormValue({ parent: { pk: "abc" } })).toBe("abc");
  });

  it("falls back to empty string for missing parent or pk", () => {
    expect(deptParentFormValue({})).toBe("");
    expect(deptParentFormValue({ parent: {} })).toBe("");
    expect(deptParentFormValue(undefined)).toBe("");
  });
});

describe("applyDeptParentColumn", () => {
  it("switches column to cascader with pk/name mapping", () => {
    const column = asColumn({});
    const result = applyDeptParentColumn(column);
    expect(result).toBe(column);
    expect(result["valueType"]).toBe("cascader");
    expect(result["fieldProps"]).toEqual({
      props: {
        value: "pk",
        label: "name",
        emitPath: false,
        checkStrictly: true
      }
    });
  });

  it("preserves existing fieldProps entries", () => {
    const column = asColumn({ fieldProps: { placeholder: "pick" } });
    const result = applyDeptParentColumn(column);
    expect(result["fieldProps"]).toEqual({
      placeholder: "pick",
      props: {
        value: "pk",
        label: "name",
        emitPath: false,
        checkStrictly: true
      }
    });
  });

  it("builds options tree from choices and tolerates empty choices", () => {
    const choices = [
      { pk: 1, name: "总部", parent_id: null },
      { pk: 2, name: "研发", parent_id: 1 }
    ];
    const withChoices = asColumn({ _column: { choices } });
    expect(applyDeptParentColumn(withChoices)["options"]).toEqual([
      {
        pk: 1,
        name: "总部",
        parent_id: null,
        children: [{ pk: 2, name: "研发", parent_id: 1 }]
      }
    ]);

    const empty = asColumn({});
    expect(applyDeptParentColumn(empty)["options"]).toEqual([]);
  });
});
