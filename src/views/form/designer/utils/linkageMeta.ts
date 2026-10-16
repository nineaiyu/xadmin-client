import type {
  FormField,
  FormLinkage,
  FormLinkageEffect,
  FormLinkageOp
} from "@/api/dataset/dform";

/**
 * 联动规则的展示元数据（编辑弹窗与规则清单共用；标签经 i18n 词条取，不在此处硬编码文案）。
 */

export const LINKAGE_OPS: { value: FormLinkageOp; labelKey: string }[] = [
  { value: "eq", labelKey: "dform.linkageOpEq" },
  { value: "ne", labelKey: "dform.linkageOpNe" },
  { value: "in", labelKey: "dform.linkageOpIn" },
  { value: "notin", labelKey: "dform.linkageOpNotin" },
  { value: "empty", labelKey: "dform.linkageOpEmpty" },
  { value: "notempty", labelKey: "dform.linkageOpNotempty" }
];

export const LINKAGE_EFFECTS: { value: FormLinkageEffect; labelKey: string }[] =
  [
    { value: "hide", labelKey: "dform.linkageEffectHide" },
    { value: "show", labelKey: "dform.linkageEffectShow" },
    { value: "require", labelKey: "dform.linkageEffectRequire" },
    { value: "optional", labelKey: "dform.linkageEffectOptional" }
  ];

/** 值型操作符（必须提供规则值；empty/notempty 不看值） */
export const VALUED_LINKAGE_OPS: FormLinkageOp[] = ["eq", "ne", "in", "notin"];

/** 触发/目标字段展示名：命中则「标签（key）」，字段已被删除时回退 key */
export const linkageFieldLabel = (fields: FormField[], key: string): string => {
  const field = fields.find(item => item.key === key);
  return field ? `${field.label}（${field.key}）` : key;
};

/** 规则条件值的展示文本（数组以顿号连接） */
export const linkageValueText = (rule: FormLinkage): string =>
  Array.isArray(rule.value)
    ? rule.value.map(item => String(item)).join(", ")
    : String(rule.value ?? "");

/** 规则是否引用了已不存在的字段（保存前会给出提示并剔除） */
export const linkageBroken = (
  rule: FormLinkage,
  fields: FormField[]
): boolean =>
  !fields.some(item => item.key === rule.target) ||
  !fields.some(item => item.key === rule.field);
