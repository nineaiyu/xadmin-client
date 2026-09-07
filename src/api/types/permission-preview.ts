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
  rules: PreviewRule[];
  rule_text: string;
}

/** 部门祖先链上的一层授权 */
export interface PreviewDeptChainItem {
  dept: { pk: string; name: string };
  relation: "self" | "ancestor";
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

/** POST /api/system/user/{pk}/preview/trial 响应 data */
export interface TrialResult {
  model: string;
  menu: string | null;
  count: number;
  sql: string;
  is_superuser: boolean;
  data_enabled: boolean;
  note: string | null;
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
