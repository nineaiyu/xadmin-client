import { describe, expect, it } from "vitest";

import type { FormField } from "@/api/dataset/dform";
import {
  buildFilterPayload,
  filterableFieldsOf,
  filterOptionsOf,
  isNumberField,
  isOptionedField
} from "../filters";

const field = (overrides: Partial<FormField>): FormField =>
  ({
    key: "k",
    label: "字段",
    type: "input",
    ...overrides
  }) as FormField;

describe("可筛选字段面", () => {
  it("只保留勾选 filterable 且类型可渲染筛选控件的字段（保持 schema 顺序）", () => {
    const fields = [
      field({ key: "name", filterable: true }),
      field({ key: "remark" }), // 未勾选
      field({ key: "level", type: "select", filterable: true }),
      field({ key: "owner", type: "user", filterable: true }), // 需专用选择器，UI 不渲染
      field({ key: "files", type: "upload", filterable: true }) // 类型不可筛选
    ];
    expect(filterableFieldsOf(fields).map(item => item.key)).toEqual([
      "name",
      "level"
    ]);
  });
});

describe("筛选条件编译", () => {
  const fields = [
    field({ key: "name", filterable: true }),
    field({ key: "archived", type: "switch", filterable: true }),
    field({ key: "score", type: "number", filterable: true }),
    field({ key: "skills", type: "checkbox", filterable: true })
  ];

  it("空值不入条件：false 与 0 是有效取值", () => {
    expect(
      buildFilterPayload(fields, {
        name: "",
        archived: false,
        score: 0,
        skills: []
      })
    ).toBe(JSON.stringify({ archived: false, score: 0 }));
  });

  it("无有效条件返回空串（调用方据此从请求中剔除参数）", () => {
    expect(buildFilterPayload(fields, {})).toBe("");
    expect(buildFilterPayload(fields, { name: null })).toBe("");
  });

  it("多值字段原样下发（服务端包成数组包含语义），键序随 schema 字段序", () => {
    expect(
      buildFilterPayload(fields, { skills: ["a", "b"], name: "张三" })
    ).toBe(JSON.stringify({ name: "张三", skills: ["a", "b"] }));
  });
});

describe("筛选控件渲染辅助", () => {
  it("选项型/数字型判定", () => {
    expect(isOptionedField(field({ type: "select" }))).toBe(true);
    expect(isOptionedField(field({ type: "checkbox" }))).toBe(true);
    expect(isOptionedField(field({ type: "input" }))).toBe(false);
    expect(isNumberField(field({ type: "amount" }))).toBe(true);
    expect(isNumberField(field({ type: "date" }))).toBe(false);
  });

  it("下拉候选项：字典优先，内联选项过滤非字符串节点", () => {
    expect(
      filterOptionsOf(field({ type: "select", dict: "priority" }), [
        { label: "高", value: "high" }
      ] as never)
    ).toEqual([{ label: "高", value: "high" }]);
    expect(
      filterOptionsOf(
        field({ type: "select", options: ["P4", "P5"] }),
        undefined
      )
    ).toEqual([
      { label: "P4", value: "P4" },
      { label: "P5", value: "P5" }
    ]);
    expect(
      filterOptionsOf(
        field({
          type: "select",
          options: [{ value: "a", label: "A" } as never]
        }),
        undefined
      )
    ).toEqual([]);
  });
});
