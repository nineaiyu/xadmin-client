/** 规则值的输入形态（后端 choices 下发的 input 字段；未知值回退 text） */
export type RuleValueInput =
  | "none"
  | "text"
  | "json"
  | "seconds"
  | "datetime"
  | "datetimerange"
  | "user"
  | "dept"
  | "role"
  | "menu";

interface FormItemProps {
  name?: string[];
  match?: string;
  exclude?: boolean;
  type?: string;
  value?: unknown;
}

/** 字段权限规则行（一条 数据权限 过滤规则） */
export interface FieldRuleRow {
  table: string;
  field: string;
  match: string;
  exclude?: boolean;
  type?: string;
  /** 存储形态由类型决定（文本/秒数/时间串/时间对/关联对象 pk 数组 JSON） */
  value?: unknown;
}

/** 规则类型选项（后端 choices 下发：label/hint + 值控件元数据） */
export interface FieldLookupItem {
  label: string;
  value: string;
  disabled?: boolean;
  /** 过滤语义说明（后端 rule_meta 下发，前端不重复维护文案） */
  hint?: string;
  /** 值输入形态（none = 运行期按当前用户注入） */
  input?: RuleValueInput;
  /** 是否需要填写值 */
  value_required?: boolean;
  /** 建议匹配符（选择类型后预置） */
  default_match?: string;
  /** 配置页分组（all/runtime/explicit/time/free） */
  group?: string;
}

/** 字段级联树节点（app → 模型 → 字段） */
export interface FieldLookupNode {
  name?: string;
  label?: string;
  value?: string;
  disabled?: boolean;
  children?: FieldLookupNode[];
}

interface FormProps {
  formInline?: FormItemProps;
  fieldLookupsData?: FieldLookupNode[];
  ruleList?: FieldLookupNode[];
  /** 字段权限注册表（ROLE）树：字段试算草稿候选 */
  fieldRuleList?: FieldLookupNode[];
  dataList?: FieldRuleRow[];
  valuesData?: FieldLookupItem[];
  /** 菜单上下文候选（配置页即时试算面板用） */
  menus?: Array<{ value: string; label: string }>;
  /** 当前表单值（试算面板读 mode_type / 绑定菜单，保证草稿与保存同语义） */
  formValue?: unknown;
}

export type { FormItemProps, FormProps };
