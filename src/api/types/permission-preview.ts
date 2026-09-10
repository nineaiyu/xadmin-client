/** 权限可视化（预览/试算）契约类型——对应后端 system/utils/permission_preview.py */

/** 只读菜单树节点（_serialize_menu_tree 投影） */
export interface PreviewMenuItem {
  pk: string;
  name: string;
  rank: number;
  path: string;
  menu_type: number;
  parent: { pk: string; name: string } | null;
  title: string;
  children?: PreviewMenuItem[];
}

/** API 权限码（menu_type=2） */
export interface PreviewApiPermission {
  menu_pk: string;
  code: string;
  method: string | null;
  path: string;
  title: string;
}

/** 数据权限规则（JSON 解码后附可读文案） */
export interface PreviewRule {
  table: string;
  table_label: string;
  field: string;
  field_label: string;
  type: string;
  type_text: string;
  match: string;
  match_text: string;
  value: unknown;
  value_text: string;
  exclude: boolean;
}

/** 一条 DataPermission 授权（规则组） */
export interface PreviewDataRuleGroup {
  pk: string;
  name: string;
  is_active: boolean;
  mode_type: number;
  menus: Array<{ pk: string; title: string }>;
  /** 绑定了菜单：仅在对应菜单上下文生效，通用列表接口下不生效 */
  menu_scoped: boolean;
  rules: PreviewRule[];
  rule_text: string;
}

/** 部门祖先链上的一层授权 */
export interface PreviewDeptChainItem {
  dept: { pk: string; name: string };
  relation: "self" | "ancestor";
  /** 该部门是否启用；停用部门的授权不参与实际过滤（effective=false） */
  is_active: boolean;
  effective: boolean;
  permissions: PreviewDataRuleGroup[];
}

/** 数据权限块 */
export interface PreviewDataPermissions {
  enabled: boolean;
  superuser_bypass: boolean;
  has_any_grant: boolean;
  personal: PreviewDataRuleGroup[];
  dept_chain: PreviewDeptChainItem[];
  semantic_note: string;
}

/** 字段权限矩阵行：菜单 × 角色 × 模型 → 字段白名单 */
export interface PreviewFieldRow {
  menu: { pk: string; title: string };
  role: { pk: string; name: string };
  model: string;
  model_label: string;
  fields: string[];
  field_labels: string[];
}

/** 试算模型候选（数据权限注册表根节点） */
export interface TrialCandidate {
  label: string;
  display: string;
  has_rules: boolean;
}

/** 用户维度预览目标基本信息 */
export interface PreviewUser {
  pk: string;
  username: string;
  nickname: string | null;
  is_active: boolean;
  is_superuser: boolean;
  dept: { pk: string; name: string } | null;
  roles: Array<{ pk: string; name: string; code: string; is_active: boolean }>;
}

/** GET /api/system/user/{pk}/preview 响应 data */
export interface UserPreviewResult {
  user: PreviewUser;
  menu_tree: PreviewMenuItem[];
  api_permissions: PreviewApiPermission[];
  data_permissions: PreviewDataPermissions;
  field_permissions: PreviewFieldRow[];
  field_permission_enabled: boolean;
  trial_candidates: TrialCandidate[];
  summary: {
    menu_count: number;
    api_code_count: number;
    data_permission_count: number;
    field_permission_count: number;
  };
}

/** 试算草稿：配置页即时验证影响面（不落库，仅参与本次试算） */
export interface TrialDraft {
  rules: Array<Record<string, unknown>>;
  mode_type?: number;
  /** 草稿绑定的菜单：仅在该菜单上下文下参与试算 */
  menu?: string | null;
}

/** POST /api/system/user/{pk}/preview/trial 响应 data */
export interface TrialResult {
  model: string;
  menu: string | null;
  count: number;
  sql: string;
  is_superuser: boolean;
  data_enabled: boolean;
  /** 草稿是否参与本次试算（绑定了不匹配的菜单时为 false） */
  draft_applied: boolean;
  note: string | null;
}

/** 部门维度预览行（部门信息 + 部门侧授权 + 成员采样） */
export interface DeptPreviewResult {
  dept: {
    pk: string;
    name: string;
    code: string;
    is_active: boolean;
    rank: number;
    parent: { pk: string; name: string } | null;
    leader: { pk: string; username: string; nickname: string | null } | null;
    child_count: number;
    active_child_count: number;
  };
  roles: Array<{ pk: string; name: string; code: string; is_active: boolean }>;
  menu_tree: PreviewMenuItem[];
  data_permissions: {
    enabled: boolean;
    has_any_grant: boolean;
    rules: PreviewDataRuleGroup[];
  };
  field_permissions: Array<{
    menu: { pk: string; title: string };
    role: { pk: string; name: string };
    models: Array<{
      model: string;
      model_label: string;
      fields: string[];
      field_labels: string[];
    }>;
  }>;
  field_permission_enabled: boolean;
  users: {
    total: number;
    truncated: boolean;
    sample_limit: number;
    list: Array<{
      pk: string;
      username: string;
      nickname: string | null;
      is_active: boolean;
    }>;
  };
  notes: string[];
}

/** GET /api/system/role/{pk}/preview 响应 data */
export interface RolePreviewResult {
  role: { pk: string; name: string; code: string; is_active: boolean };
  menu_tree: PreviewMenuItem[];
  field_permissions: Array<{
    menu: { pk: string; title: string };
    models: Array<{
      model: string;
      model_label: string;
      fields: string[];
      field_labels: string[];
    }>;
  }>;
  users: {
    total: number;
    truncated: boolean;
    sample_limit: number;
    list: Array<{
      pk: string;
      username: string;
      nickname: string | null;
      dept: { pk: string; name: string } | null;
      is_active: boolean;
    }>;
  };
}

/** ApiResponse 信封 + 强类型 data（后端 preview 系列端点） */
export type PreviewDetailResult<T> = {
  detail: string;
  code: number;
  data: T;
};
