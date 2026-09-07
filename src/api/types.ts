import type { RecordType } from "plus-pro-components";

/**
 * choices 接口下发的选项条目：对象形态（value/label + attrs 扩展字段），
 * 与 RePlusPage formatAddOrEditOptions 的入参契约保持一致
 */
export type ChoiceOption = {
  value: unknown;
  label?: unknown;
  disabled?: boolean;
  [key: string]: unknown;
};

export type ChoicesResult = {
  detail: string;
  code: number;
  /** choices 字典：userinfo 系接口为选项数组、permission 系接口为 { choices: [...] }，形态由消费侧收窄 */
  choices_dict: RecordType;
};

/** 动态行列表结果，行结构由具体接口决定 */
export type DataListResult<T = RecordType> = {
  detail: string;
  code: number;
  data: Array<T>;
};

export type SearchFieldsResult = {
  detail: string;
  code: number;
  data: Array<{
    key: string;
    label: string;
    input_type: string;
    help_text?: string;
    /** 后端动态默认值（字符串/数值/布尔/数组/对象），写入由渲染器按 input_type 决定 */
    default?: unknown;
    choices?: ChoiceOption[];
    /** 关联列选项超过 SEARCH_CHOICES_MAX_COUNT 被截断，应降级为远程搜索 */
    choices_truncated?: boolean;
  }>;
};

export type SearchColumnsResult = {
  detail: string;
  code: number;
  data: Array<{
    key: string;
    label: string;
    input_type: string;
    required: boolean;
    read_only: boolean;
    write_only: boolean;
    max_length?: number;
    multiple?: boolean;
    table_show?: number;
    help_text?: string;
    /** 后端动态默认值（字符串/数值/布尔/数组/对象），写入由渲染器按 input_type 决定 */
    default?: unknown;
    choices?: ChoiceOption[];
    /** 关联列选项超过 SEARCH_CHOICES_MAX_COUNT 被截断，应降级为远程搜索 */
    choices_truncated?: boolean;
    /** ListField(child=ChoiceField) 下发的子字段元信息，choices 候选值供多选下拉渲染 */
    child?: { choices?: ChoiceOption[]; [key: string]: unknown };
  }>;
};

/** 分页列表结果，行结构由具体接口决定 */
export type ListResult<T = RecordType> = {
  detail: string;
  code: number;
  data: {
    /** 列表数据 */
    results: Array<T>;
    /** 总条目数 */
    total?: number;
    /** T3.2：`?with_meta=1` 时内联的展示字段元数据（同 search-columns 载荷） */
    search_columns?: SearchColumnsResult["data"];
    /** T3.2：`?with_meta=1` 时内联的查询字段元数据（同 search-fields 载荷） */
    search_fields?: SearchFieldsResult["data"];
  };
};

export type DetailResult = {
  detail: string;
  code: number;
  /** 详情数据：单行动态对象，字段由具体接口决定 */
  data: RecordType;
  /** UX-2：服务端字段级校验错误（校验失败场景），RePlusPage 表单消费后内联展示 */
  errors?: ServerErrors;
};

/** UX-2：服务端字段级校验错误（common/core/exception.py 封装），field → 错误消息(列表) */
export type ServerErrors = Record<string, string[] | string>;

export type BaseResult = {
  detail: string;
  code: number;
  /** 校验错误时携带；RePlusPage 表单消费后内联展示 */
  errors?: ServerErrors;
};

/**
 * 标准操作结果：`create`/`update` 类接口返回 `DetailResult`（带 `data`），
 * 其余写操作返回 `BaseResult`；调用方仅依赖 `code`/`detail` 时使用本联合类型
 */
export type ApiResult = BaseResult | DetailResult;
