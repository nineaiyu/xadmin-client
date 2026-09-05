// 元数据接口契约类型：由 contract/schema/*.schema.json 生成（T2.3）。
// 该目录镜像自 xadmin-server/docs/schema（服务端为契约源）；禁止手改。
// 重新生成：pnpm gen:metadata-types；Schema 变更属破坏性契约变更，需与后端一同评审。

/**
 * GET /api/<resource>/search-fields 响应中 data 字段的载荷（查询字段元数据）。T2.3 契约固化；服务端由 tests/unit/common/test_metadata_schema.py 持续校验。
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
   * 前端渲染器类型：text/select/select-multiple/number/datetime/datetimerange/input/api-search-user/select-ordering 等
   */
  input_type: string;
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
   * choices 超过 SEARCH_CHOICES_MAX_COUNT 被截断时为 true（PERF-07）
   */
  choices_truncated?: boolean;
}[];
