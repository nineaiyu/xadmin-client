// 接口契约类型：由 contract/schema/*.schema.json 生成。
// 该目录镜像自 xadmin-server/docs/schema（服务端为契约源）；禁止手改。
// 重新生成：pnpm gen:metadata-types；Schema 变更属破坏性契约变更，需与后端一同评审。

/**
 * GET /api/<resource>/search-fields 响应中 data 字段的载荷（查询字段元数据）。契约固化；服务端由 tests/unit/common/test_metadata_schema.py 持续校验。
 */
export type SearchFieldsData = {
  /**
   * 过滤字段名；排序聚合项固定为 ordering
   */
  key: string;
  /**
   * 展示名
   */
  label: string | null;
  /**
   * 字段说明；ordering 聚合项无此键
   */
  help_text?: string | null;
  /**
   * 前端渲染器类型。封闭核心词表（单一事实源 packages/xadmin-common/common/core/modelset/input_types.py DECLARED_INPUT_TYPES，与本枚举锁步对账）+ 开放 api-* 前缀族；x-fallback-rendered 为无内置渲染器、依赖注册表回退语义呈现的登记类型。
   */
  input_type: (
    | (
        | "boolean"
        | "choice"
        | "color"
        | "date"
        | "datetime"
        | "datetimerange"
        | "email"
        | "field"
        | "file upload"
        | "float"
        | "image upload"
        | "input"
        | "integer"
        | "json"
        | "labeled_choice"
        | "labeled_multiple_choice"
        | "list"
        | "m2m_related_field"
        | "m2m_related_field_file"
        | "m2m_related_field_image"
        | "multiple choice"
        | "number"
        | "object_related_field"
        | "object_related_field_file"
        | "object_related_field_image"
        | "phone"
        | "select"
        | "select-multiple"
        | "select-ordering"
        | "string"
        | "text"
        | "textarea"
      )
    | string
  ) &
    string;
  choices: {
    value: unknown;
    label: unknown;
    disabled?: boolean;
  }[];
  /**
   * 默认值：multiple 类型为空数组，其余为字符串
   */
  default: {
    [k: string]: unknown;
  };
  /**
   * choices 超过 SEARCH_CHOICES_MAX_COUNT 被截断时为 true
   */
  choices_truncated?: boolean;
}[];
