import { describe, expect, it } from "vitest";

import {
  dictCodeColumnTransform,
  dictParentColumnTransform,
  dictValueColumnTransform,
  isDictTypeRow
} from "../dictColumnRules";

type TestColumn = { fieldProps?: Record<string, unknown> } & Record<
  string,
  unknown
>;
const column = (fieldProps?: Record<string, unknown>): TestColumn => ({
  fieldProps
});

describe("isDictTypeRow", () => {
  it("treats rows without parent as type rows", () => {
    expect(isDictTypeRow({ parent: null })).toBe(true);
    expect(isDictTypeRow({})).toBe(true);
  });

  it("treats rows with object parent as item rows", () => {
    expect(isDictTypeRow({ parent: { pk: 1, label: "类型" } })).toBe(false);
  });
});

describe("dictCodeColumnTransform", () => {
  it("disables editing for locked dicts", () => {
    const col = column();
    const result = dictCodeColumnTransform({
      column: col,
      rawRow: { is_locked: true }
    });
    expect(result).toBe(col);
    expect(col.fieldProps).toEqual({ disabled: true });
  });

  it("keeps editable code untouched for normal dicts", () => {
    const col = column();
    dictCodeColumnTransform({ column: col, rawRow: {} });
    expect(col.fieldProps).toBeUndefined();
  });
});

describe("dictParentColumnTransform", () => {
  it("hides parent column for type rows", () => {
    const col = column();
    const result = dictParentColumnTransform({
      column: col,
      rawRow: { parent: null }
    });
    expect(result).toBe(col);
    expect(col["hideInForm"]).toBe(true);
  });

  it("locks parent for locked dicts", () => {
    const col = column();
    dictParentColumnTransform({
      column: col,
      rawRow: { parent: { pk: 1 }, is_locked: true }
    });
    expect(col["hideInForm"]).toBeUndefined();
    expect(col.fieldProps).toEqual({ disabled: true });
  });

  it("locks parent when adding a child (parent pre-filled)", () => {
    const col = column();
    dictParentColumnTransform({
      column: col,
      rawRow: { parent: { pk: 1 } },
      isAdd: true
    });
    expect(col.fieldProps).toEqual({ disabled: true });
  });

  it("keeps parent editable when editing an item of an unlocked dict", () => {
    const col = column();
    dictParentColumnTransform({
      column: col,
      rawRow: { parent: { pk: 1 } },
      isAdd: false
    });
    expect(col.fieldProps).toBeUndefined();
    expect(col["hideInForm"]).toBeUndefined();
  });
});

describe("dictValueColumnTransform", () => {
  it("hides value column for type rows", () => {
    const col = column();
    dictValueColumnTransform({ column: col, rawRow: { parent: null } });
    expect(col["hideInForm"]).toBe(true);
  });

  it("keeps value column for item rows", () => {
    const col = column();
    dictValueColumnTransform({ column: col, rawRow: { parent: { pk: 1 } } });
    expect(col["hideInForm"]).toBeUndefined();
  });
});
