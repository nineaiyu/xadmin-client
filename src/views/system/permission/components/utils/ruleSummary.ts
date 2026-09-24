import type { FieldLookupNode, FieldRuleRow, RuleValueInput } from "./types";
import { objectValueCount } from "./ruleValue";

/**
 * 规则可读摘要（纯函数，配 vitest）。
 *
 * 列表与编辑卡片上都直接展示这类摘要，把「表.字段 + 匹配符 + 值类型 + 方向」
 * 翻译成一句话，避免管理员在配置页阅读 JSON 结构。
 */

/** 摘要所需的文案函数（由调用方注入 i18n，纯函数不直接依赖 t） */
export interface RuleDescribeContext {
  fieldLabel: (table?: string, field?: string) => string;
  typeLabel: (type?: string) => string;
  matchLabel: (match?: string) => string;
  /** 关联对象值（已选 N 项） */
  objectText: (count: number) => string;
  /** 相对时间窗口（过去/未来 N 天等） */
  secondsText: (seconds: number) => string;
  /** 通用值文本 */
  valueText: (value: unknown) => string;
  /** 全部数据 / 包含 / 排除 三个前缀 */
  allText: string;
  includeText: string;
  excludeText: string;
}

/** 字段索引：`表.字段` → 中文标签（含模型节点与字段节点） */
export function buildFieldIndex(nodes: FieldLookupNode[]): Map<string, string> {
  const index = new Map<string, string>();
  nodes.forEach(app => {
    (app.children ?? []).forEach(model => {
      if (!model.name) return;
      index.set(String(model.name), model.label ?? String(model.name));
      (model.children ?? []).forEach(field => {
        if (!field.name) return;
        index.set(
          `${model.name}.${field.name}`,
          field.label ?? String(field.name)
        );
      });
    });
  });
  return index;
}

/** 值文案（按控件形态：关联对象给数量、相对时间给窗口、其余给原文） */
export function describeRuleValue(
  input: RuleValueInput,
  raw: unknown,
  ctx: RuleDescribeContext
): string {
  if (input === "seconds") return ctx.secondsText(Number(raw) || 0);
  if (
    input === "user" ||
    input === "dept" ||
    input === "role" ||
    input === "menu"
  ) {
    return ctx.objectText(objectValueCount(raw));
  }
  return ctx.valueText(raw);
}

export function describeRule(
  rule: FieldRuleRow,
  input: RuleValueInput,
  ctx: RuleDescribeContext
): string {
  if (rule.type === "value.all" || rule.match === "all") return ctx.allText;
  const field = ctx.fieldLabel(rule.table, rule.field);
  const direction = rule.exclude ? ctx.excludeText : ctx.includeText;
  const target =
    input === "none"
      ? ctx.typeLabel(rule.type)
      : `${ctx.matchLabel(rule.match)} ${describeRuleValue(input, rule.value, ctx)}`;
  return `${direction} ${field} ${target}`;
}
