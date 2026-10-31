import { describe, expect, it } from "vitest";
import type { PageColumn } from "@/components/RePlusPage";

import { buildRoleRulesColumns } from "../hooks";

/** 构造最小列对象（_column 是列渲染器唯一读取的元数据入口） */
const column = (key: string, extra: Record<string, unknown> = {}) =>
  ({ _column: { key }, ...extra }) as PageColumn;

const buildColumns = () => [
  column("pk"),
  column("username", { fieldProps: {} }),
  column("nickname", { fieldProps: {} }),
  column("phone"),
  column("email"),
  column("gender"),
  column("roles", { _column: { key: "roles", choices: [] } }),
  column("rules", { _column: { key: "rules", choices: [] } })
];

const build = (columns: PageColumn[]) =>
  buildRoleRulesColumns(columns, {
    keepKeys: ["username", "nickname", "roles", "rules"],
    disabledKeys: ["username", "nickname"],
    wideKeys: ["username", "nickname", "phone", "email", "gender"]
  });

describe("buildRoleRulesColumns 纯函数", () => {
  it("不回写入参（主表单列集合与布局不受授权弹层影响）", () => {
    const source = buildColumns();
    build(source);

    source.forEach(item => {
      expect(item.hideInForm).toBeUndefined();
      expect(item["colProps"]).toBeUndefined();
    });
    expect(source[6].options).toBeUndefined();
    expect(source[0].fieldProps).toBeUndefined();
  });

  it("返回新列对象：保留字段半宽、主表单专属字段隐藏、禁用字段只读", () => {
    const source = buildColumns();
    const columns = build(source);

    // 返回的是副本，与入参引用不同
    expect(columns).toHaveLength(source.length);
    columns.forEach((item, index) => {
      expect(item).not.toBe(source[index]);
    });

    const byKey = new Map(columns.map(item => [item._column.key, item]));
    expect(byKey.get("pk")?.hideInForm).toBe(true);
    expect(byKey.get("roles")?.hideInForm).toBe(true);
    expect(byKey.get("rules")?.hideInForm).toBe(true);
    expect(byKey.get("username")?.hideInForm).toBeUndefined();
    expect(byKey.get("phone")?.hideInForm).toBe(true);

    expect(byKey.get("username")?.fieldProps).toEqual({ disabled: true });
    expect(byKey.get("nickname")?.fieldProps).toEqual({ disabled: true });
    expect(byKey.get("username")?.colProps).toEqual({
      xs: 24,
      sm: 24,
      md: 24,
      lg: 12,
      xl: 12
    });

    // roles/rules 仍装配权限选项渲染（弹层内可展示）
    expect(byKey.get("roles")?.options).toEqual([]);
    expect(byKey.get("rules")?.options).toEqual([]);
  });
});
