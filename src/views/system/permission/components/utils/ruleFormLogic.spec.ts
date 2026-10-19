import { describe, expect, it } from "vitest";

import { buildRulePayload, editorValueOf, validateRule } from "./ruleFormLogic";

const MESSAGES = {
  typeRequired: "typeRequired",
  scopeRequired: "scopeRequired",
  matchRequired: "matchRequired",
  pickerAuthMissing: "pickerAuthMissing",
  jsonInvalid: "jsonInvalid",
  valueRequired: "valueRequired"
};

function validation(overrides: Record<string, unknown> = {}) {
  return {
    type: "value.text",
    isAll: false,
    table: "identity.userinfo",
    field: "username",
    matchFixed: false,
    match: "exact",
    objectPickerMissing: false,
    input: "text" as const,
    json: "",
    valueRequired: true,
    value: "xadmin",
    ...overrides
  };
}

describe("editorValueOf 编辑态 → 提交值", () => {
  it("按控件形态映射（none 固定通配、range 缺省空数组、关联对象序列化）", () => {
    const base = {
      text: "abc",
      json: "",
      datetime: "",
      range: null,
      seconds: { amount: 0, unit: 60, future: false },
      object: [] as unknown[]
    };
    expect(editorValueOf({ ...base, input: "none" })).toBe("*");
    expect(editorValueOf({ ...base, input: "text" })).toBe("abc");
    expect(editorValueOf({ ...base, input: "json", json: '{"a":1}' })).toBe(
      '{"a":1}'
    );
    expect(
      editorValueOf({
        ...base,
        input: "datetimerange",
        range: ["2026-01-01", "2026-01-02"]
      })
    ).toEqual(["2026-01-01", "2026-01-02"]);
    expect(editorValueOf({ ...base, input: "datetimerange" })).toEqual([]);
    expect(
      editorValueOf({
        ...base,
        input: "user",
        object: [{ pk: "u-1" }]
      })
    ).toBe('[{"pk":"u-1"}]');
  });
});

describe("validateRule 校验", () => {
  it("类型缺失时只报类型", () => {
    expect(validateRule(validation({ type: "" }), MESSAGES)).toEqual({
      type: "typeRequired"
    });
  });

  it("「全部数据」只校验类型，不校验范围与取值", () => {
    expect(
      validateRule(
        validation({ isAll: true, field: "*", value: "", table: "" }),
        MESSAGES
      )
    ).toEqual({});
  });

  it("范围 / 匹配符 / 取值必填分别落到对应字段", () => {
    expect(validateRule(validation({ field: "" }), MESSAGES)).toEqual({
      scope: "scopeRequired"
    });
    expect(validateRule(validation({ match: "" }), MESSAGES)).toEqual({
      match: "matchRequired"
    });
    expect(validateRule(validation({ value: "" }), MESSAGES)).toEqual({
      value: "valueRequired"
    });
    // 匹配符由类型固定时不再要求用户选择
    expect(
      validateRule(validation({ matchFixed: true, match: "" }), MESSAGES)
    ).toEqual({});
  });

  it("关联对象缺搜索权限优先拦截取值行", () => {
    expect(
      validateRule(
        validation({ input: "user", objectPickerMissing: true, value: [] }),
        MESSAGES
      )
    ).toEqual({ value: "pickerAuthMissing" });
  });

  it("JSON 非法时报错，合法时不报", () => {
    expect(
      validateRule(validation({ input: "json", json: "{bad" }), MESSAGES)
    ).toEqual({ value: "jsonInvalid" });
    expect(
      validateRule(validation({ input: "json", json: '{"a":1}' }), MESSAGES)
    ).toEqual({});
  });

  it("非必填取值不因空值报错", () => {
    expect(
      validateRule(validation({ valueRequired: false, value: "" }), MESSAGES)
    ).toEqual({});
  });
});

describe("buildRulePayload 提交载荷", () => {
  it("普通规则空匹配符回落 exact", () => {
    expect(
      buildRulePayload({
        isAll: false,
        table: "identity.userinfo",
        field: "username",
        match: "",
        exclude: true,
        type: "value.text",
        value: "xadmin"
      })
    ).toEqual({
      table: "identity.userinfo",
      field: "username",
      match: "exact",
      exclude: true,
      type: "value.text",
      value: "xadmin"
    });
  });

  it("「全部数据」保留已选表、字段与匹配符固定，未选表落通配", () => {
    const all = buildRulePayload({
      isAll: true,
      table: "identity.userinfo",
      field: "username",
      match: "exact",
      exclude: true,
      type: "value.all",
      value: "x"
    });
    expect(all).toEqual({
      table: "identity.userinfo",
      field: "*",
      match: "all",
      exclude: false,
      type: "value.all",
      value: "*"
    });
    expect(
      buildRulePayload({
        isAll: true,
        table: "",
        field: "",
        match: "",
        exclude: false,
        type: "value.all",
        value: ""
      }).table
    ).toBe("*");
  });
});
