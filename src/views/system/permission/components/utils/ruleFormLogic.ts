import { FieldKeyChoices } from "@/views/system/constants";
import {
  fromSecondsEditor,
  isEmptyValue,
  serializeObjectValue,
  type SecondsEditor
} from "./ruleValue";
import type { FieldRuleRow, RuleValueInput } from "./types";

/**
 * 规则编辑表单的取值映射 / 校验 / 提交载荷（纯函数，配 vitest）。
 *
 * 组件只保留控件状态与事件接线：控件形态到存储值的映射、必填与格式校验、
 * 「全部数据」与普通规则的载荷差异都在这里，便于单测与复用。
 */

/** 各取值控件绑定的编辑态 */
export interface EditorValues {
  input: RuleValueInput;
  text: string;
  json: string;
  datetime: string;
  range: string[] | null;
  seconds: SecondsEditor;
  object: object | object[] | string | undefined;
}

/** 编辑态 → 提交值（形态由取值控件决定） */
export function editorValueOf(values: EditorValues): unknown {
  switch (values.input) {
    case "none":
      return "*";
    case "json":
      return values.json;
    case "datetime":
      return values.datetime;
    case "datetimerange":
      return values.range ?? [];
    case "seconds":
      return fromSecondsEditor(values.seconds);
    case "user":
    case "dept":
    case "role":
    case "menu":
      return serializeObjectValue(values.object);
    default:
      return values.text;
  }
}

export interface RuleValidationMessages {
  typeRequired: string;
  scopeRequired: string;
  matchRequired: string;
  pickerAuthMissing: string;
  jsonInvalid: string;
  valueRequired: string;
}

export interface RuleValidationInput {
  type: string;
  isAll: boolean;
  table: string;
  field: string;
  /** 匹配符由规则类型固定（无需用户选择） */
  matchFixed: boolean;
  match: string;
  /** 关联对象取值控件缺少对应搜索权限 */
  objectPickerMissing: boolean;
  input: RuleValueInput;
  /** JSON 控件原始文本（空串视为未填） */
  json: string;
  valueRequired: boolean;
  /** 已由 editorValueOf 归一后的提交值 */
  value: unknown;
}

/** 校验规则表单；返回「字段 → 错误文案」，空对象表示通过。 */
export function validateRule(
  input: RuleValidationInput,
  messages: RuleValidationMessages
): Record<string, string> {
  const next: Record<string, string> = {};
  if (!input.type) next.type = messages.typeRequired;
  if (input.isAll) return next;
  if (!input.table || !input.field) next.scope = messages.scopeRequired;
  if (!input.matchFixed && !input.match) next.match = messages.matchRequired;
  if (input.objectPickerMissing) {
    // 取值控件缺搜索权限时无法构造合法的关联对象值，提交前拦截并定位到取值行
    next.value = messages.pickerAuthMissing;
  }
  if (input.input === "json" && input.json) {
    try {
      JSON.parse(input.json);
    } catch {
      next.value = messages.jsonInvalid;
    }
  }
  if (
    input.valueRequired &&
    isEmptyValue(input.input, input.value) &&
    !next.value
  ) {
    next.value = messages.valueRequired;
  }
  return next;
}

export interface RulePayloadInput {
  isAll: boolean;
  table: string;
  field: string;
  /** 已按「匹配符是否固定」归一后的匹配符 */
  match: string;
  exclude: boolean;
  type: string;
  value: unknown;
}

/** 表单值 → 规则载荷；「全部数据」只约束表维度（字段与匹配符固定）。 */
export function buildRulePayload(payload: RulePayloadInput): FieldRuleRow {
  if (payload.isAll) {
    return {
      table: payload.table && payload.table !== "*" ? payload.table : "*",
      field: "*",
      match: "all",
      exclude: false,
      type: FieldKeyChoices.ALL,
      value: "*"
    };
  }
  return {
    table: payload.table,
    field: payload.field,
    match: payload.match || "exact",
    exclude: payload.exclude,
    type: payload.type,
    value: payload.value
  };
}
