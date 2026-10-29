/**
 * 流程定义配置的纯逻辑：类型、常量、回显/提交转换、校验与载荷装配
 * （拆分自 FlowConfigDrawer.vue，行为不变；便于单测）。
 */

/** 出口路由（排他网关）：condition 命中即跳转 target 节点 order */
export type RouteItem = {
  condition?: { field?: string; op?: string; value?: unknown } | null;
  target: number;
};
export type ApiNode = {
  name: string;
  order: number;
  approve_type?: string;
  approve_ratio?: number;
  assignee_type?: string;
  assignee_value?: string;
  condition?: { field?: string; op?: string; value?: unknown } | null;
  routes?: RouteItem[];
  layout?: { x?: number; y?: number };
  timeout_hours?: number;
  timeout_action?: string;
  /** 节点级默认抄送人（用户名数组）；实例发起时由后端解析为实例级快照 */
  cc_users?: string[];
};
export type FlowRow = {
  pk: string;
  name: string;
  code: string;
  is_active: boolean;
  /** 可发起角色 code 列表：空 = 所有用户可发起 */
  initiator_roles?: string[];
  /** 行版本戳：编辑抽屉保存时原样回传作乐观锁基线（后端比对拦截并发覆盖） */
  updated_time?: string;
  form_schema?: Array<{
    key: string;
    label?: string;
    type?: string;
    required?: boolean;
    options?: string[];
  }>;
  /** 表单字段编辑锁：流程被 dform 绑定后 form_schema 由绑定表单单向投影维护 */
  form_schema_locked?: boolean;
  nodes?: ApiNode[];
};
export type NodeRow = {
  name: string;
  approve_type: string;
  approve_ratio: number;
  assignee_type: string;
  assignee_value: string;
  condition_field: string;
  condition_op: string;
  condition_value: string;
  routes: RouteItem[];
  layout: { x?: number; y?: number };
  timeout_hours: number;
  /** 超时自动动作（none/approve/reject/transfer_up；仅在 timeout_hours>0 时生效） */
  timeout_action: string;
  /** 节点级默认抄送人：编辑回显 + 保存回传（缺省会清空既有配置） */
  cc_users: string[];
};
export type FieldRow = {
  label: string;
  key: string;
  type: string;
  required: boolean;
  options: string;
};

export const ASSIGNEE_TYPES = ["role", "user", "leader", "field", "post"];
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
/** 条件运算符可读文案（与审批类型/超时动作同走 i18n，避免表单中英混排） */
const CONDITION_OP_KEYS: Record<string, string> = {
  eq: "conditionOpEq",
  ne: "conditionOpNe",
  in: "conditionOpIn",
  not_in: "conditionOpNotIn",
  gt: "conditionOpGt",
  gte: "conditionOpGte",
  lt: "conditionOpLt",
  lte: "conditionOpLte",
  contains: "conditionOpContains",
  is_empty: "conditionOpIsEmpty",
  not_empty: "conditionOpNotEmpty"
};
export function conditionOpLabel(
  op: string,
  t: (key: string) => string
): string {
  const key = CONDITION_OP_KEYS[op];
  return key ? t(`systemApprovalFlow.${key}`) : op;
}
export const FIELD_TYPES = ["text", "textarea", "number", "date", "select"];
/** 超时自动动作（与后端 ApprovalFlowNode.TimeoutAction 同枚举） */
export const TIMEOUT_ACTIONS = ["none", "approve", "reject", "transfer_up"];
/** 数值比较运算符：条件值必须可转数值（引擎对转换失败按不命中跳节点，保存期拦截） */
const NUMERIC_OPS = ["gt", "gte", "lt", "lte"];

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
    approve_ratio: 100,
    assignee_type: "role",
    assignee_value: "",
    condition_field: "",
    condition_op: "eq",
    condition_value: "",
    routes: [],
    layout: {},
    timeout_hours: 0,
    timeout_action: "none",
    cc_users: []
  };
}

/** 接口节点 → 编辑态行（含节点抄送人回显，避免保存时被清空） */
export function toNodeRow(node: ApiNode): NodeRow {
  return {
    name: node.name ?? "",
    approve_type: pickValue(node.approve_type, "OR"),
    approve_ratio: node.approve_ratio ?? 100,
    assignee_type: pickValue(node.assignee_type, "role"),
    assignee_value: node.assignee_value ?? "",
    condition_field: node.condition?.field ?? "",
    condition_op: node.condition?.op ?? "eq",
    condition_value: formatConditionValue(node.condition?.value),
    routes: (node.routes ?? []).map(route => ({
      condition: {
        field: route.condition?.field ?? "",
        op: route.condition?.op ?? "eq",
        value: route.condition?.value ?? ""
      },
      target: Number(route.target)
    })),
    layout: { ...(node.layout ?? {}) },
    timeout_hours: node.timeout_hours ?? 0,
    timeout_action: node.timeout_action ?? "none",
    cc_users: Array.isArray(node.cc_users)
      ? node.cc_users.map(item => String(item).trim()).filter(Boolean)
      : []
  };
}

/**
 * 节点重排 / 删除后重映射出口路由 target（target 语义是「目标节点当前 order」）。
 *
 * ``previousOrder`` 是变更前的节点引用快照：按旧 order 找到目标节点，再换算成它的
 * 新 order；目标已被删除或会形成自环时丢弃该路由（保留会指向错误节点或死循环）。
 */
export function remapRouteTargets(
  nodes: NodeRow[],
  previousOrder: NodeRow[]
): void {
  for (const node of nodes) {
    const selfOrder = nodes.indexOf(node) + 1;
    node.routes = (node.routes || []).flatMap(route => {
      const targetNode = previousOrder[Number(route.target) - 1];
      if (!targetNode) return [];
      const newTarget = nodes.indexOf(targetNode) + 1;
      if (!newTarget || newTarget === selfOrder) return [];
      return [{ ...route, target: newTarget }];
    });
  }
}

/** 数值运算符的条件值是否可转数值（空串同样不合格）；in/not_in 为字符串集合比较，不在此列 */
export function isNumericConditionValue(op: string, raw: string): boolean {
  if (!NUMERIC_OPS.includes(op)) return true;
  const text = raw.trim();
  return text !== "" && !Number.isNaN(Number(text));
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
  const badRatio = nodes.find(
    node =>
      node.approve_type === "RATIO" &&
      !(node.approve_ratio >= 1 && node.approve_ratio <= 100)
  );
  if (badRatio) {
    return "systemApprovalFlow.ratioRangeRequired";
  }
  // 审批人必填（leader 由申请人部门负责人解析，无需填写）：
  // 缺值时保存会拿到后端 400，前端先行拦截给出可读提示
  const missingAssignee = nodes.find(
    node =>
      ["role", "user", "field", "post"].includes(node.assignee_type) &&
      !node.assignee_value.trim()
  );
  if (missingAssignee) {
    return "systemApprovalFlow.assigneeValueRequired";
  }
  // 数值条件的值必须可转数值（节点条件与出口路由同口径）：转换失败在引擎里
  // 一律按不命中处理，节点被静默跳过、流程走向改变且无告警
  const badNumeric = nodes.find(
    node =>
      (node.condition_field.trim() &&
        !isNumericConditionValue(node.condition_op, node.condition_value)) ||
      (node.routes || []).some(
        route =>
          route.condition?.field?.trim() &&
          !isNumericConditionValue(
            route.condition?.op || "eq",
            String(route.condition?.value ?? "")
          )
      )
  );
  if (badNumeric) {
    return "systemApprovalFlow.conditionValueNumericRequired";
  }
  return null;
}

/** 编辑态行模型 → 服务端载荷（表单字段 + 顺序化节点列表；baseUpdatedTime 为乐观锁基线） */
export function buildFlowPayload(
  basic: {
    name: string;
    code: string;
    is_active: boolean;
    initiator_roles?: string[];
  },
  fields: FieldRow[],
  nodes: NodeRow[],
  baseUpdatedTime?: string
) {
  return {
    name: basic.name.trim(),
    code: basic.code.trim(),
    is_active: basic.is_active,
    initiator_roles: (basic.initiator_roles ?? [])
      .map(item => String(item).trim())
      .filter(Boolean),
    ...(baseUpdatedTime ? { base_updated_time: baseUpdatedTime } : {}),
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
      approve_ratio: Number(node.approve_ratio) || 100,
      assignee_type: node.assignee_type,
      assignee_value: node.assignee_value.trim(),
      condition: node.condition_field.trim()
        ? {
            field: node.condition_field.trim(),
            op: node.condition_op,
            value: parseConditionValue(node.condition_op, node.condition_value)
          }
        : {},
      // 节点级抄送：缺省空数组（旧行为是整字段丢失 → 编辑任意流程会清空既有抄送）
      cc_users: (node.cc_users ?? [])
        .map(item => String(item).trim())
        .filter(Boolean),
      // 出口路由：条件值按 op 规范化后提交；layout 为画布坐标
      routes: (node.routes || []).map(route => ({
        condition: route.condition?.field?.trim()
          ? {
              field: route.condition.field.trim(),
              op: route.condition.op || "eq",
              value: parseConditionValue(
                route.condition.op || "eq",
                String(route.condition.value ?? "")
              )
            }
          : (route.condition ?? {}),
        target: Number(route.target)
      })),
      layout:
        node.layout &&
        (node.layout.x !== undefined || node.layout.y !== undefined)
          ? node.layout
          : {},
      timeout_hours: Number(node.timeout_hours) || 0,
      timeout_action: TIMEOUT_ACTIONS.includes(node.timeout_action)
        ? node.timeout_action
        : "none"
    }))
  };
}
