/**
 * 流程定义配置的纯逻辑：类型、常量、回显/提交转换、校验与载荷装配
 * （拆分自 FlowConfigDrawer.vue，行为不变；便于单测）。
 */

export type ApiNode = {
  name: string;
  order: number;
  approve_type?: string;
  assignee_type?: string;
  assignee_value?: string;
  condition?: { field?: string; op?: string; value?: unknown } | null;
  timeout_hours?: number;
};
export type FlowRow = {
  pk: string;
  name: string;
  code: string;
  is_active: boolean;
  form_schema?: Array<{
    key: string;
    label?: string;
    type?: string;
    required?: boolean;
    options?: string[];
  }>;
  nodes?: ApiNode[];
};
export type NodeRow = {
  name: string;
  approve_type: string;
  assignee_type: string;
  assignee_value: string;
  condition_field: string;
  condition_op: string;
  condition_value: string;
  timeout_hours: number;
};
export type FieldRow = {
  label: string;
  key: string;
  type: string;
  required: boolean;
  options: string;
};

export const ASSIGNEE_TYPES = ["role", "user", "leader", "field"];
export const CONDITION_OPS = [
  "eq",
  "ne",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "is_empty",
  "not_empty"
];
export const FIELD_TYPES = ["text", "textarea", "number", "date", "select"];

/**
 * 取选项类字段的原始值：接口把 choices 序列化为 {value,label}（LabeledChoiceField），
 * 下拉框需要的是标量 value（保存时同样提交标量，服务端两种形态都收）。
 */
export function pickValue(raw: unknown, fallback: string): string {
  if (
    raw &&
    typeof raw === "object" &&
    "value" in (raw as Record<string, unknown>)
  ) {
    const value = (raw as { value?: unknown }).value;
    return value === undefined || value === null ? fallback : String(value);
  }
  return raw ? String(raw) : fallback;
}

/** 条件值回显：数组拼接为逗号分隔文本（保存时按运算符反向解析） */
export function formatConditionValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return Array.isArray(value) ? value.join(",") : String(value);
}

/** 条件值提交：in/not_in 拆数组；比较运算符转数值（失败保留原串） */
export function parseConditionValue(op: string, raw: string): unknown {
  const text = raw.trim();
  if (op === "in" || op === "not_in") {
    return text
      ? text
          .split(",")
          .map(item => item.trim())
          .filter(Boolean)
      : [];
  }
  if (["gt", "gte", "lt", "lte"].includes(op) && text !== "") {
    const num = Number(text);
    return Number.isNaN(num) ? text : num;
  }
  return text;
}

export function createEmptyNode(): NodeRow {
  return {
    name: "",
    approve_type: "OR",
    assignee_type: "role",
    assignee_value: "",
    condition_field: "",
    condition_op: "eq",
    condition_value: "",
    timeout_hours: 0
  };
}

/** 保存前校验：返回首个错误的 i18n key，全部通过返回 null */
export function validateFlowConfig(
  basic: { name: string; code: string },
  nodes: NodeRow[]
): string | null {
  if (!basic.name.trim() || !basic.code.trim()) {
    return "systemApprovalFlow.nameAndCodeRequired";
  }
  if (!nodes.length) {
    return "systemApprovalFlow.nodeRequired";
  }
  const emptyNode = nodes.find(node => !node.name.trim());
  if (emptyNode) {
    return "systemApprovalFlow.nodeNameRequired";
  }
  return null;
}

/** 编辑态行模型 → 服务端载荷（表单字段 + 顺序化节点列表） */
export function buildFlowPayload(
  basic: { name: string; code: string; is_active: boolean },
  fields: FieldRow[],
  nodes: NodeRow[]
) {
  return {
    name: basic.name.trim(),
    code: basic.code.trim(),
    is_active: basic.is_active,
    form_schema: fields
      .filter(field => field.key.trim())
      .map(field => ({
        key: field.key.trim(),
        label: field.label.trim() || field.key.trim(),
        type: field.type,
        required: field.required,
        options:
          field.type === "select"
            ? field.options
                .split(",")
                .map(item => item.trim())
                .filter(Boolean)
            : []
      })),
    nodes: nodes.map((node, index) => ({
      name: node.name.trim(),
      order: index + 1,
      approve_type: node.approve_type,
      assignee_type: node.assignee_type,
      assignee_value: node.assignee_value.trim(),
      condition: node.condition_field.trim()
        ? {
            field: node.condition_field.trim(),
            op: node.condition_op,
            value: parseConditionValue(node.condition_op, node.condition_value)
          }
        : {},
      timeout_hours: Number(node.timeout_hours) || 0
    }))
  };
}
