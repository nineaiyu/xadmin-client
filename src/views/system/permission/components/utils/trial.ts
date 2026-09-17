import type { FieldLookupNode } from "./types";

/** 数据权限试算的模型候选项 */
export interface TrialModelOption {
  value: string;
  label: string;
}

/** 字段权限试算的模型候选项（含可选字段） */
export interface TrialFieldModelOption {
  value: string;
  label: string;
  fields: Array<{ value: string; label: string }>;
}

/** 字段试算草稿条目（模型 + 已选字段文案） */
export interface TrialDraftEntry {
  model: string;
  label: string;
  text: string;
}

/** 表单且/或模式归一（数字/字符串/labeled 对象；空值与非法值返回 null） */
export function parseFormMode(raw: unknown): number | null {
  const value =
    raw && typeof raw === "object" ? (raw as { value?: unknown }).value : raw;
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

/** 表单绑定菜单归一为 pk 字符串列表（兼容单值/对象/数组） */
export function parseBoundMenuPks(raw: unknown): string[] {
  const items = Array.isArray(raw)
    ? raw
    : raw === null || raw === undefined
      ? []
      : [raw];
  return items
    .map(item =>
      item && typeof item === "object" ? (item as { pk?: unknown }).pk : item
    )
    .filter(item => item !== null && item !== undefined && item !== "")
    .map(String);
}

/** 目标用户归一为 pk 字符串（兼容字符串/数字/对象/数组，取首个非空 pk） */
export function normalizeTargetPk(raw: unknown): string {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (first === null || first === undefined || first === "") return "";
  if (typeof first === "string" || typeof first === "number")
    return String(first);
  const pk = (first as { pk?: string | number }).pk;
  return pk === undefined || pk === null ? "" : String(pk);
}

/** 数据权限模型候选 = 注册表树第二层（app → model → field），跳过「全部表」占位 */
export function buildModelOptions(
  ruleList: FieldLookupNode[]
): TrialModelOption[] {
  const options: TrialModelOption[] = [];
  ruleList.forEach(app => {
    (app.children ?? []).forEach(modelNode => {
      if (!modelNode.name || modelNode.name === "*") return;
      options.push({
        value: modelNode.name,
        label: `${modelNode.label ?? modelNode.name} (${modelNode.name})`
      });
    });
  });
  return options;
}

/** 字段注册表 → 模型候选（兼容 app→model→field 与 model→field 两种层级） */
export function buildFieldModelOptions(
  fieldRuleList: FieldLookupNode[]
): TrialFieldModelOption[] {
  const options: TrialFieldModelOption[] = [];
  const walk = (nodes: FieldLookupNode[]) => {
    nodes.forEach(node => {
      if (!node.name) return;
      const children = node.children ?? [];
      if (children.some(child => (child.children ?? []).length > 0)) {
        walk(children);
        return;
      }
      if (!children.length) return;
      options.push({
        value: node.name,
        label: node.label ?? node.name,
        fields: children
          .filter(child => Boolean(child.name))
          .map(child => ({
            value: child.name as string,
            label: child.label ?? (child.name as string)
          }))
      });
    });
  };
  walk(fieldRuleList);
  return options;
}

/** 草稿字段 → 展示条目（模型/字段中文名，未命中候选时回退原名） */
export function buildDraftEntries(
  draftFields: Record<string, string[]>,
  options: TrialFieldModelOption[]
): TrialDraftEntry[] {
  return Object.keys(draftFields).map(modelLabel => {
    const option = options.find(item => item.value === modelLabel);
    const labels = (draftFields[modelLabel] ?? []).map(
      name => option?.fields.find(field => field.value === name)?.label ?? name
    );
    return {
      model: modelLabel,
      label: option?.label ?? modelLabel,
      text: labels.join("、")
    };
  });
}
