import { describe, expect, it } from "vitest";
import {
  appendRule,
  copyRule,
  removeRule,
  replaceRule,
  stripRuleIds,
  withRuleIds
} from "./ruleRows";
import type { FieldRuleRow } from "./types";

const makeRule = (field: string): FieldRuleRow => ({
  table: "demo.book",
  field,
  match: "eq",
  type: "value.input",
  value: field
});

describe("规则行稳定身份", () => {
  it("编辑第 2 条时删除第 0 条再提交，规则不串位", () => {
    const rows = withRuleIds([makeRule("a"), makeRule("b"), makeRule("c")]);
    const editing = rows[1];
    const draft = { ...makeRule("b"), value: "changed" };

    const afterRemove = removeRule(rows, rows[0]._rid);
    const afterSubmit = replaceRule(afterRemove, editing._rid, draft);

    expect(stripRuleIds(afterSubmit)).toEqual([
      { ...makeRule("b"), value: "changed" },
      makeRule("c")
    ]);
  });

  it("复制行插入源行之后且身份独立", () => {
    const rows = withRuleIds([makeRule("a"), makeRule("b")]);
    const afterCopy = copyRule(rows, rows[0]._rid);

    expect(afterCopy).toHaveLength(3);
    expect(afterCopy[1].field).toBe("a");
    expect(afterCopy[1]._rid).not.toBe(afterCopy[0]._rid);
    expect(afterCopy[2]._rid).toBe(rows[1]._rid);
  });

  it("追加行不改变既有行身份", () => {
    const rows = withRuleIds([makeRule("a")]);
    const afterAppend = appendRule(rows, makeRule("b"));

    expect(afterAppend[0]._rid).toBe(rows[0]._rid);
    expect(stripRuleIds(afterAppend)).toEqual([makeRule("a"), makeRule("b")]);
  });

  it("stripRuleIds 不外泄编辑器内部身份", () => {
    const payload = stripRuleIds(withRuleIds([makeRule("a")]));

    expect(payload.every(rule => !("_rid" in rule))).toBe(true);
    expect(payload).toEqual([makeRule("a")]);
  });
});
