import { describe, expect, it, vi } from "vitest";
import type { SearchColumnsResult, SearchFieldsResult } from "@/api/types";

import {
  applyChoicesTruncated,
  buildColumnRule,
  columnDefaultValue,
  detailInputType,
  resolveColumnLabel
} from "../columnRules";

type ColumnMeta = SearchFieldsResult["data"][0] &
  Partial<SearchColumnsResult["data"][0]>;

const base = {
  key: "name",
  label: null,
  input_type: "string",
  choices: [],
  default: {},
  required: false,
  read_only: false,
  write_only: false
} as ColumnMeta;

function meta(over: Partial<ColumnMeta> = {}): ColumnMeta {
  return { ...base, ...over };
}

describe("resolveColumnLabel", () => {
  const deps = {
    t: (key: string) => `词条:${key}`,
    te: (key: string) => key === "zh.name",
    localeName: "zh"
  };

  it("prefers the i18n label when the key is registered", () => {
    expect(resolveColumnLabel(deps, { key: "name", label: "服务端名" })).toBe(
      "词条:zh.name"
    );
  });

  it("falls back to server label then key", () => {
    expect(resolveColumnLabel(deps, { key: "other", label: "服务端名" })).toBe(
      "服务端名"
    );
    expect(resolveColumnLabel(deps, { key: "other", label: null })).toBe(
      "other"
    );
  });
});

describe("buildColumnRule", () => {
  it("builds a required message rule for default input types", () => {
    const [rule] = buildColumnRule(meta({ required: true }), "必填");
    expect(rule).toMatchObject({ required: true, message: "必填" });
  });

  it("email validator accepts valid and rejects invalid addresses", () => {
    const [rule] = buildColumnRule(meta({ input_type: "email" }), "邮箱不合法");
    const validator = rule.validator as (
      _rule: unknown,
      value: unknown,
      cb: (error?: Error) => void
    ) => void;
    expect(() => validator({}, "a@b.co", () => undefined)).not.toThrow();
    let error: Error | undefined;
    validator({}, "bad", e => (error = e));
    expect(error?.message).toBe("邮箱不合法");
    // 空值放行（由 required 声明接管）
    expect(() => validator({}, "", () => undefined)).not.toThrow();
  });

  it("integer validator rejects non-numeric values", () => {
    const [rule] = buildColumnRule(meta({ input_type: "integer" }), "");
    const validator = rule.validator as (
      _rule: unknown,
      value: unknown,
      cb: (error?: Error) => void
    ) => void;
    expect(() => validator({}, 3, () => undefined)).not.toThrow();
    let error: Error | undefined;
    validator({}, "abc", e => (error = e));
    expect(error?.message).toBe("field must be a number");
  });
});

describe("columnDefaultValue", () => {
  it("wraps scalar defaults for labeled choice families", () => {
    const labeled = meta({ input_type: "labeled_choice", default: {} });
    expect(columnDefaultValue(labeled)).toEqual({ value: {} });
    const multiLabeled = meta({
      input_type: "labeled_multiple_choice",
      default: {}
    });
    expect(columnDefaultValue(multiLabeled)).toEqual([{ value: {} }]);
    const multi = meta({ input_type: "multiple choice", default: {} });
    expect(columnDefaultValue(multi)).toEqual([{}]);
  });

  it("keeps the raw default reference for other input types", () => {
    const column = meta({ input_type: "string" });
    expect(columnDefaultValue(column)).toBe(column.default);
  });
});

describe("detailInputType", () => {
  it("maps api-search to related-field renderers by cardinality", () => {
    expect(detailInputType(meta({ input_type: "api-search-user" }))).toBe(
      "object_related_field"
    );
    expect(
      detailInputType(meta({ input_type: "api-search-user", multiple: true }))
    ).toBe("m2m_related_field");
  });

  it("passes other input types through", () => {
    expect(detailInputType(meta({ input_type: "labeled_choice" }))).toBe(
      "labeled_choice"
    );
  });
});

describe("applyChoicesTruncated", () => {
  it("enables local filtering only when choices were truncated", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const truncated: { fieldProps?: Record<string, unknown> } = {};
    applyChoicesTruncated(meta({ choices_truncated: true }), truncated);
    expect(truncated.fieldProps).toEqual({ filterable: true });

    const intact: { fieldProps?: Record<string, unknown> } = {
      fieldProps: {}
    };
    applyChoicesTruncated(meta(), intact);
    expect(intact.fieldProps).toEqual({});
    warn.mockRestore();
  });
});
