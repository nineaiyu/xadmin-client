import type { FieldRuleRow } from "./types";

/** 规则行 + 编辑器内部稳定身份（_rid 不回传表单值 / 试算 / 保存载荷） */
export interface EditableRule extends FieldRuleRow {
  _rid: number;
}

let sequence = 0;

function nextRuleId(): number {
  sequence += 1;
  return sequence;
}

/** 外部数据 → 可编辑行：按到达顺序分配稳定身份 */
export function withRuleIds(rules: FieldRuleRow[]): EditableRule[] {
  return rules.map(rule => ({ ...rule, _rid: nextRuleId() }));
}

/** 可编辑行 → 纯规则行（提交 / 试算用） */
export function stripRuleIds(rules: EditableRule[]): FieldRuleRow[] {
  return rules.map(({ _rid, ...rule }) => rule);
}

/** 追加规则（新增卡片提交） */
export function appendRule(
  rules: EditableRule[],
  draft: FieldRuleRow
): EditableRule[] {
  return [...rules, { ...draft, _rid: nextRuleId() }];
}

/** 按身份替换规则（编辑中的行在前序行被删/复制后仍是同一条） */
export function replaceRule(
  rules: EditableRule[],
  rid: number,
  draft: FieldRuleRow
): EditableRule[] {
  return rules.map(rule =>
    rule._rid === rid ? { ...draft, _rid: rid } : rule
  );
}

/** 按身份删除规则 */
export function removeRule(rules: EditableRule[], rid: number): EditableRule[] {
  return rules.filter(rule => rule._rid !== rid);
}

/** 按身份复制规则（副本紧随源行，各自持有独立身份） */
export function copyRule(rules: EditableRule[], rid: number): EditableRule[] {
  const index = rules.findIndex(rule => rule._rid === rid);
  if (index === -1) return rules;
  const copy = { ...rules[index], _rid: nextRuleId() };
  return [...rules.slice(0, index + 1), copy, ...rules.slice(index + 1)];
}
