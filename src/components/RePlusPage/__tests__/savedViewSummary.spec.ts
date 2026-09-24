import { describe, expect, it } from "vitest";
import {
  summarizeConditions,
  summarizeConditionsText,
  type SummaryTranslator
} from "../src/utils/savedViewSummary";
import type { PageColumn } from "../src/utils/types";

/** 最小翻译表（key 缺失时回落 key 本身，与 vue-i18n 的 t(key, fallback) 口径一致） */
const DICT: Record<string, string> = {
  "advancedFilter.lookups.exact": "等于",
  "advancedFilter.lookups.icontains": "包含",
  "advancedFilter.lookups.in": "属于",
  "advancedFilter.lookups.isnull": "为空",
  "advancedFilter.true": "是",
  "advancedFilter.false": "否"
};
const t: SummaryTranslator = key => DICT[key] ?? key;

const column = (over: Record<string, unknown>): PageColumn => {
  const prop = String(over.prop ?? "field");
  return {
    prop,
    label: "字段",
    lookups: [],
    _column: { key: prop, label: "字段", input_type: "string" },
    ...over
  } as unknown as PageColumn;
};

const columns = [
  column({
    prop: "gender",
    label: "性别",
    lookups: ["exact", "in", "ne", "isnull"],
    _column: {
      key: "gender",
      label: "性别",
      input_type: "labeled_choice",
      choices: [
        { value: 1, label: "男" },
        { value: 2, label: "女" }
      ]
    }
  }),
  column({
    prop: "is_active",
    label: "有效",
    lookups: ["exact", "ne", "isnull"],
    _column: { key: "is_active", label: "有效", input_type: "boolean" }
  }),
  column({
    prop: "roles",
    label: "角色权限",
    lookups: ["exact", "in", "ne"],
    _column: {
      key: "roles",
      label: "角色权限",
      input_type: "m2m_related_field",
      multiple: true,
      choices: [
        { pk: "r1", label: "管理员", value: "r1" },
        { pk: "r2", label: "审计员", value: "r2" }
      ]
    }
  }),
  column({
    prop: "username",
    label: "用户名",
    lookups: ["exact", "icontains", "in", "isnull", "ne"]
  })
];

describe("summarizeConditions（条件快照 → 可读摘要）", () => {
  it("选择型字段回显选项标签与条件词", () => {
    const items = summarizeConditions({ gender__exact: "1" }, columns, t);
    expect(items).toEqual([{ label: "性别", operator: "等于", value: "男" }]);
    expect(summarizeConditionsText(items)).toBe("性别 等于 男");
  });

  it("多值条件拼接「、」并回显选项标签", () => {
    const items = summarizeConditions({ roles__in: ["r1", "r2"] }, columns, t);
    expect(summarizeConditionsText(items)).toBe("角色权限 属于 管理员、审计员");
  });

  it("为空条件回显布尔文案", () => {
    const items = summarizeConditions({ is_active__isnull: false }, columns, t);
    expect(summarizeConditionsText(items)).toBe("有效 为空 否");
  });

  it("普通搜索条件按「字段：值」展示且跳过分页键", () => {
    const items = summarizeConditions(
      { page: 1, size: 15, ordering: "name", username: "admin" },
      columns,
      t
    );
    expect(items).toEqual([{ label: "用户名", value: "admin" }]);
    expect(summarizeConditionsText(items)).toBe("用户名：admin");
  });

  it("未在列元数据中的字段回落字段名与原始值", () => {
    const items = summarizeConditions({ legacy__exact: "x" }, columns, t);
    expect(summarizeConditionsText(items)).toBe("legacy 等于 x");
  });

  it("空条件产出空摘要", () => {
    expect(summarizeConditions(undefined, columns, t)).toEqual([]);
  });
});
