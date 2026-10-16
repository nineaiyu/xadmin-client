import { describe, expect, it } from "vitest";

import {
  buildFieldIndex,
  describeRule,
  describeRuleValue,
  type RuleDescribeContext
} from "./ruleSummary";
import type { FieldLookupNode, FieldRuleRow } from "./types";

const tree: FieldLookupNode[] = [
  {
    name: "system",
    label: "system",
    children: [
      {
        name: "system.userinfo",
        label: "用户信息",
        children: [
          { name: "dept", label: "所属部门" },
          { name: "creator", label: "创建人" }
        ]
      }
    ]
  }
];

const ctx: RuleDescribeContext = {
  fieldLabel: (table, field) => `${table}.${field}`,
  typeLabel: type => `类型:${type}`,
  matchLabel: match => `匹配:${match}`,
  objectText: count => `已选 ${count} 项`,
  secondsText: seconds => `窗口 ${seconds}`,
  valueText: value => String(value),
  allText: "全部数据",
  includeText: "包含",
  excludeText: "排除"
};

describe("ruleSummary 规则摘要", () => {
  it("buildFieldIndex：建立「模型.字段」中文索引", () => {
    const index = buildFieldIndex(tree);
    expect(index.get("system.userinfo")).toBe("用户信息");
    expect(index.get("system.userinfo.dept")).toBe("所属部门");
    expect(index.get("system.userinfo.creator")).toBe("创建人");
  });

  it("describeRule：全部数据 / 包含 / 排除三类语义", () => {
    const allRule: FieldRuleRow = {
      table: "*",
      field: "*",
      match: "all",
      type: "value.all",
      value: "*"
    };
    expect(describeRule(allRule, "none", ctx)).toBe("全部数据");

    const ownRule: FieldRuleRow = {
      table: "system.userinfo",
      field: "creator",
      match: "exact",
      type: "value.user.id",
      value: ""
    };
    expect(describeRule(ownRule, "none", ctx)).toBe(
      "包含 system.userinfo.creator 类型:value.user.id"
    );

    const deptRule: FieldRuleRow = {
      table: "system.userinfo",
      field: "dept",
      match: "in",
      type: "value.table.dept.ids",
      value: '[{"pk":"d-1"},{"pk":"d-2"}]',
      exclude: true
    };
    expect(describeRule(deptRule, "dept", ctx)).toBe(
      "排除 system.userinfo.dept 匹配:in 已选 2 项"
    );
  });

  it("describeRuleValue：按控件形态输出（关联对象给数量、时间给窗口、其余原文）", () => {
    expect(describeRuleValue("user", '[{"pk":"a"},{"pk":"b"}]', ctx)).toBe(
      "已选 2 项"
    );
    expect(describeRuleValue("seconds", -86400, ctx)).toBe("窗口 -86400");
    expect(describeRuleValue("text", "active", ctx)).toBe("active");
  });
});
