import { FieldKeyChoices } from "@/views/system/constants";
import type { FieldLookupItem, RuleValueInput } from "./types";

/**
 * 规则类型的配置端元数据读取口径。
 *
 * 权威来源是后端 `rule_meta.RULE_TYPE_META`（choices 接口下发 input / value_required /
 * default_match / group）；此处只保留兜底映射，保证接口未升级或字段缺失时表单仍可提交。
 * 新增规则类型只需改后端，前端无硬编码清单。
 */

/** 值输入形态兜底 */
const FALLBACK_INPUT: Record<string, RuleValueInput> = {
  [FieldKeyChoices.ALL]: "none",
  [FieldKeyChoices.TEXT]: "text",
  [FieldKeyChoices.JSON]: "json",
  [FieldKeyChoices.DATE]: "seconds",
  [FieldKeyChoices.DATETIME]: "datetime",
  [FieldKeyChoices.DATETIME_RANGE]: "datetimerange",
  [FieldKeyChoices.USER_ID]: "none",
  [FieldKeyChoices.USER_DEPT_ID]: "none",
  [FieldKeyChoices.USER_DEPT_IDS]: "none",
  [FieldKeyChoices.LEADER_DEPTS]: "none",
  [FieldKeyChoices.LEADER_USERS]: "none",
  [FieldKeyChoices.TABLE_USER]: "user",
  [FieldKeyChoices.TABLE_DEPT]: "dept",
  [FieldKeyChoices.DEPARTMENTS]: "dept",
  [FieldKeyChoices.TABLE_ROLE]: "role",
  [FieldKeyChoices.TABLE_MENU]: "menu"
};

/** 建议匹配符兜底（与后端 resolve_rule 的强制口径一致） */
const FALLBACK_MATCH: Record<string, string> = {
  [FieldKeyChoices.ALL]: "all",
  [FieldKeyChoices.USER_ID]: "exact",
  [FieldKeyChoices.USER_DEPT_ID]: "exact",
  [FieldKeyChoices.USER_DEPT_IDS]: "in",
  [FieldKeyChoices.LEADER_DEPTS]: "in",
  [FieldKeyChoices.LEADER_USERS]: "in",
  [FieldKeyChoices.TABLE_USER]: "in",
  [FieldKeyChoices.TABLE_DEPT]: "in",
  [FieldKeyChoices.DEPARTMENTS]: "in",
  [FieldKeyChoices.TABLE_ROLE]: "in",
  [FieldKeyChoices.TABLE_MENU]: "in",
  [FieldKeyChoices.DATETIME]: "gte",
  [FieldKeyChoices.DATETIME_RANGE]: "range",
  [FieldKeyChoices.DATE]: "gte"
};

/** 配置页分组顺序（分组标题由后端 choices.groups 下发，前端仅排序） */
export const RULE_GROUP_ORDER = ["all", "runtime", "explicit", "time", "free"];

/** 值控件由运行期注入的类型：匹配符同样由读取侧固定，配置端只读展示 */
const RUNTIME_INPUTS: RuleValueInput[] = ["none"];

export function ruleValueInput(
  type: string | undefined,
  item?: FieldLookupItem
): RuleValueInput {
  return item?.input ?? FALLBACK_INPUT[type ?? ""] ?? "text";
}

export function ruleDefaultMatch(
  type: string | undefined,
  item?: FieldLookupItem
): string {
  return item?.default_match ?? FALLBACK_MATCH[type ?? ""] ?? "exact";
}

export function ruleValueRequired(
  type: string | undefined,
  item?: FieldLookupItem
): boolean {
  if (item?.value_required !== undefined) return item.value_required;
  return !RUNTIME_INPUTS.includes(ruleValueInput(type, item));
}

/** 匹配符是否由读取侧固定（运行期注入类型统一按 in/exact 编译，用户选择无意义） */
export function ruleMatchFixed(
  type: string | undefined,
  item?: FieldLookupItem
): boolean {
  const input = ruleValueInput(type, item);
  return (
    input === "none" ||
    input === "user" ||
    input === "dept" ||
    input === "role" ||
    input === "menu"
  );
}

export function ruleTypeOption(
  valuesData: FieldLookupItem[],
  type?: string
): FieldLookupItem | undefined {
  return valuesData.find(item => item.value === type);
}

export interface RuleTypeGroup {
  key: string;
  items: FieldLookupItem[];
}

/** 类型下拉按分组渲染（分组顺序固定，未登记分组归入 free） */
export function groupRuleTypes(valuesData: FieldLookupItem[]): RuleTypeGroup[] {
  const groups = new Map<string, FieldLookupItem[]>();
  valuesData.forEach(item => {
    const key =
      item.group && RULE_GROUP_ORDER.includes(item.group) ? item.group : "free";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });
  return RULE_GROUP_ORDER.filter(key => groups.has(key)).map(key => ({
    key,
    items: groups.get(key) as FieldLookupItem[]
  }));
}

/** 常用规则模板：只预置类型与匹配符，表与字段按语义由管理员选择 */
export interface RulePreset {
  key: string;
  type: string;
  match: string;
  /** 全部数据：命中的是「所有表的所有字段」，需同时置通配属性名 */
  wildcard?: boolean;
}

export const RULE_PRESETS: RulePreset[] = [
  { key: "self", type: FieldKeyChoices.USER_ID, match: "exact" },
  { key: "ownDept", type: FieldKeyChoices.USER_DEPT_ID, match: "exact" },
  { key: "ownDeptTree", type: FieldKeyChoices.USER_DEPT_IDS, match: "in" },
  { key: "leaderDepts", type: FieldKeyChoices.LEADER_DEPTS, match: "in" },
  { key: "leaderUsers", type: FieldKeyChoices.LEADER_USERS, match: "in" },
  { key: "all", type: FieldKeyChoices.ALL, match: "all", wildcard: true }
];
