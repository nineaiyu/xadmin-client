import { ref } from "vue";
import { describe, expect, it } from "vitest";
import type { RecordType } from "plus-pro-components";

import type { TreeResult } from "@/utils/tree";
import type { FieldLookupItem } from "../components/utils/types";
import type { MenuScopeRow } from "../components/utils/menuScope";
import { buildPermissionFormColumns } from "./permissionFormColumns";

/**
 * 数据权限表单列解析器守护：`pk` 与统计列（rule_count/menu_count/user_count/
 * dept_count）在后端是只读列，框架按 `read_only` 过滤后不会把它们装进表单列集合，
 * 解析器因此拿不到 `column`——必须按「本列不参与表单」返回空值，不能直接改 undefined。
 */
function build() {
  return buildPermissionFormColumns({
    fieldLookupsData: ref<TreeResult<RecordType>[]>([]),
    fieldLookupsRole: ref<TreeResult<RecordType>[]>([]),
    valuesData: ref<FieldLookupItem[]>([]),
    matchTexts: ref<Record<string, string>>({}),
    menuRows: ref<MenuScopeRow[]>([]),
    menuContextOptions: ref<{ value: string; label: string }[]>([])
  });
}

const HIDDEN_KEYS = [
  "pk",
  "rule_count",
  "menu_count",
  "user_count",
  "dept_count"
] as const;

describe("数据权限表单列装配", () => {
  it("只读列不在表单列集合时：解析器返回空值且不抛错", () => {
    const { columns } = build();
    HIDDEN_KEYS.forEach(key => {
      expect(columns[key]({})).toBeUndefined();
    });
  });

  it("列存在时标记 hideInForm 并保持原列引用", () => {
    const { columns } = build();
    const column: Record<string, unknown> = { prop: "pk" };
    expect(columns.pk({ column })).toBe(column);
    expect(column["hideInForm"]).toBe(true);
  });

  it("生效范围列改用菜单树选择器：清理元数据透传的输入框 props", () => {
    const { columns } = build();
    const column: Record<string, unknown> = {
      prop: "menu",
      fieldProps: { maxlength: undefined, showWordLimit: true, multiple: true }
    };
    expect(columns.menu({ column })).toBe(column);
    // 多根节点的 ScopeSelect 继承不了这些非 prop 属性（Vue 告警），故必须清空
    expect(column["fieldProps"]).toEqual({});
    expect(typeof column["renderField"]).toBe("function");
  });

  it("且或模式与规则编辑器列缺失时同样跳过", () => {
    const { columns } = build();
    expect(columns.mode_type({})).toBeUndefined();
    expect(columns.rules({})).toBeUndefined();
  });

  it("行值映射：生效范围取菜单 pk、规则取行内规则数组", () => {
    const { row } = build();
    expect(row.menu({ rawRow: { menu: [{ pk: "1" }, { pk: "2" }] } })).toEqual([
      "1",
      "2"
    ]);
    expect(row.menu({ rawRow: {} })).toEqual([]);
    expect(row.rules({ rawRow: { rules: [{ field: "a" }] } })).toEqual([
      { field: "a" }
    ]);
    expect(row.rules({ rawRow: {} })).toEqual([]);
  });
});
