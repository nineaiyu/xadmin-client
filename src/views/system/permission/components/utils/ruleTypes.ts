import { FieldKeyChoices } from "@/views/system/constants";

/**
 * 规则 value 的输入形态（纯 UI 关注点）。
 *
 * 过滤语义（每种类型是什么含义）由后端 `choices` 接口的 `hint` 下发，前端不重复维护文案；
 * 这里只回答「这个类型的值用什么控件、要不要填」。
 * - none：由后端运行期按当前用户注入（本人/本部门/主管部门…），配置端无需填写
 */
export type RuleValueInput =
  | "none"
  | "text"
  | "datetime"
  | "datetimerange"
  | "user"
  | "dept"
  | "role"
  | "menu";

const INPUT_BY_TYPE: Record<string, RuleValueInput> = {
  [FieldKeyChoices.ALL]: "none",
  [FieldKeyChoices.USER_ID]: "none",
  [FieldKeyChoices.USER_DEPT_ID]: "none",
  [FieldKeyChoices.USER_DEPT_IDS]: "none",
  [FieldKeyChoices.LEADER_DEPTS]: "none",
  [FieldKeyChoices.LEADER_USERS]: "none",
  [FieldKeyChoices.DATETIME]: "datetime",
  [FieldKeyChoices.DATETIME_RANGE]: "datetimerange",
  [FieldKeyChoices.TABLE_USER]: "user",
  [FieldKeyChoices.TABLE_DEPT]: "dept",
  [FieldKeyChoices.DEPARTMENTS]: "dept",
  [FieldKeyChoices.TABLE_ROLE]: "role",
  [FieldKeyChoices.TABLE_MENU]: "menu",
  [FieldKeyChoices.TEXT]: "text",
  [FieldKeyChoices.JSON]: "text",
  [FieldKeyChoices.DATE]: "text"
};

/** 未知类型回退文本输入，保证表单始终可提交（后端写入校验会给出准确报错）。 */
export function ruleValueInput(type?: string): RuleValueInput {
  return (type && INPUT_BY_TYPE[type]) || "text";
}

/** 常用规则模板：只预置 type/match，表与字段由管理员按语义选择。 */
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
