import { describe, expect, it } from "vitest";
import type { FormField } from "@/api/dataset/dform";
import {
  FIELD_KEY_RE,
  fieldRowErrorOf,
  findFieldError
} from "../fieldValidate";

const field = (overrides: Partial<FormField>): FormField => ({
  key: "name",
  label: "姓名",
  type: "input",
  ...overrides
});

describe("fieldValidate", () => {
  it("KEY_RE：小写字母开头、字母/数字/下划线、≤32 位", () => {
    expect(FIELD_KEY_RE.test("name")).toBe(true);
    expect(FIELD_KEY_RE.test("field_1a")).toBe(true);
    expect(FIELD_KEY_RE.test("1abc")).toBe(false);
    expect(FIELD_KEY_RE.test("Abc")).toBe(false);
    expect(FIELD_KEY_RE.test("a-b")).toBe(false);
    expect(FIELD_KEY_RE.test("a".repeat(33))).toBe(false);
    expect(FIELD_KEY_RE.test("a".repeat(32))).toBe(true);
  });

  it("合法行返回 null", () => {
    const fields = [field({ key: "name", label: "姓名" })];
    expect(fieldRowErrorOf(fields[0], fields)).toBeNull();
    expect(findFieldError(fields)).toBeNull();
  });

  it("标识格式非法（含行内误输空格）报 keyInvalid", () => {
    const fields = [field({ key: "bad key" })];
    expect(fieldRowErrorOf(fields[0], fields)).toBe("keyInvalid");
    expect(findFieldError(fields)?.error).toBe("keyInvalid");
  });

  it("标识整表重复报 keyDuplicated", () => {
    const fields = [
      field({ key: "dup" }),
      field({ key: "dup", label: "另一字段" })
    ];
    expect(fieldRowErrorOf(fields[1], fields)).toBe("keyDuplicated");
    expect(findFieldError(fields)).toEqual({
      index: 0,
      error: "keyDuplicated"
    });
  });

  it("标签为空（含纯空格）报 labelRequired", () => {
    const fields = [field({ label: "   " })];
    expect(fieldRowErrorOf(fields[0], fields)).toBe("labelRequired");
  });

  it("整表校验定位首个出错行", () => {
    const fields = [
      field({ key: "ok", label: "正常" }),
      field({ key: "bad key", label: "非法标识" }),
      field({ key: "ok2", label: "" })
    ];
    expect(findFieldError(fields)).toEqual({ index: 1, error: "keyInvalid" });
  });
});
