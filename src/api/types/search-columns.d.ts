// 元数据接口契约类型：由 xadmin-server/docs/schema/*.schema.json 生成（T2.3）。
// 禁止手改；重新生成：pnpm gen:metadata-types
// Schema 变更属破坏性契约变更，需与后端一同评审。

/**
 * GET /api/<resource>/search-columns 响应中 data 字段的载荷（展示字段元数据）。T2.3 契约固化；服务端由 tests/unit/common/test_metadata_schema.py 持续校验。
 */
export type SearchColumnsData = {
  /**
   * 序列化器字段名
   */
  key: string;
  /**
   * 展示名（优先取模型 verbose_name）
   */
  label: string | null;
  /**
   * 字段说明；无 help_text 时缺省
   */
  help_text?: string | null;
  required: boolean;
  read_only: boolean;
  write_only: boolean;
  /**
   * 前端渲染器类型：string/integer/float/boolean/datetime/labeled_choice/api-search-user/object_related_field/m2m_related_field/image upload/textarea 等
   */
  input_type: string;
  /**
   * 字符长度上限（CharField 及路径类字段）
   */
  max_length?: number;
  /**
   * 字段默认值（类型随字段而定；仅非 required 且有默认值时出现）
   */
  default?: {
    [k: string]: unknown;
  };
  /**
   * 关联字段的候选项，条目含 attrs 声明的展示键（如 pk/username）与 label/value
   */
  choices?: {
    value: unknown;
    label: unknown;
    pk?: unknown;
    [k: string]: unknown;
  }[];
  /**
   * choices 超过 SEARCH_CHOICES_MAX_COUNT 被截断时为 true（PERF-07）
   */
  choices_truncated?: boolean;
  /**
   * 多值关联（M2M）字段为 true
   */
  multiple?: boolean;
  /**
   * 表格列顺序（serializer Meta.table_fields 中的位置+1；不在 table_fields 中则缺省）
   */
  table_show?: number;
  /**
   * 表单分组 tabs 下标
   */
  tabs_index?: number;
  /**
   * 表单分组 tabs 名称
   */
  tabs_label?: string;
}[];
