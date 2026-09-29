import type { RecordType } from "plus-pro-components";

import type { ApiResponseEnvelope } from "./types/api-response";
import type { SearchColumnsData } from "./types/search-columns";
import type { SearchFieldsData } from "./types/search-fields";

/**
 * 统一响应信封（服务端 common/core/response.py `ApiResponse`）。
 *
 * 契约唯一事实源是 `contract/schema/api-response.schema.json`（生成的
 * `./types/api-response.d.ts`）；这里显式取信封键（丢弃生成的索引签名——
 * `[k: string]: unknown` 会经交叉类型污染泛型 data）。`requestId`/`timestamp`
 * wire 上必有、但本仓存在手工构造的本地响应字面量（前端校验失败即时返回），
 * 故宽松为可选；`code`/`detail` 保持必有。本文件的信封形结果类型一律从
 * `Envelope` 派生，禁止再手写 `detail/code` 重复体。
 */
export type Envelope = Pick<ApiResponseEnvelope, "code" | "detail"> &
  Partial<Pick<ApiResponseEnvelope, "requestId" | "timestamp">>;

/** 业务成功码（与后端统一响应壳约定一致：common/core/response.py 的默认 code） */
export const SUCCESS_CODE = 1000;

/**
 * 判断业务响应是否成功（`code === SUCCESS_CODE`）。
 *
 * 统一入口：全库 165+ 处 `code === SUCCESS_CODE` 字面量收敛于此，
 * 成功码变更时只需改一处；与 http 层（axios 异常/状态码）错误策略互补。
 */
export function isSuccess(res?: { code?: number } | null): boolean {
  return res?.code === SUCCESS_CODE;
}

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

export type ChoicesResult = Omit<Envelope, "data"> & {
  /** choices 字典：userinfo 系接口为选项数组、permission 系接口为 { choices: [...] }，形态由消费侧收窄 */
  choices_dict: RecordType;
};

/** 动态行列表结果，行结构由具体接口决定 */
export type DataListResult<T = RecordType> = Omit<Envelope, "data"> & {
  data: Array<T>;
};

/**
 * search-fields 条目：生成契约（contract/schema/search-fields.schema.json）+ 两处覆盖。
 *
 * 覆盖原因（服务端契约待补，见 contract/schema 与 xadmin-server/docs/schema）：
 * - `default`：真实载荷是「多选为空数组 / 其余为字符串」（common/core/modelset/metadata.py），
 *   契约该键未限定类型 → 生成物退化为对象字面量，读侧需要 `unknown`；
 * - `choices`：契约要求必有，但字段无候选项时服务端下发空数组，前端按可选消费更贴合渲染分支。
 */
export type SearchFieldsItem = Omit<
  SearchFieldsData[number],
  "default" | "choices"
> & {
  /** 后端动态默认值（字符串/数值/布尔/数组），写入由渲染器按 input_type 决定 */
  default?: unknown;
  choices?: ChoiceOption[];
};

/**
 * search-columns 条目：生成契约（contract/schema/search-columns.schema.json）+ 两处覆盖。
 *
 * 覆盖原因：
 * - `child`（ListField(child=ChoiceField) 的子字段元信息）服务端确有下发，
 *   但契约尚未登记该键（补契约前先在客户端显式声明，避免读取处裸断言）；
 * - `default` 与 search-fields 同因：动态默认值（标量/数组/对象）由渲染器解释，
 *   契约该键未限定类型而生成物退化为对象字面量。
 */
export type SearchColumnsItem = Omit<
  SearchColumnsData[number],
  "choices" | "default"
> & {
  choices?: ChoiceOption[];
  /** 后端动态默认值（字符串/数值/布尔/数组/对象），写入由渲染器按 input_type 决定 */
  default?: unknown;
  /** ListField(child=ChoiceField) 下发的子字段元信息，choices 候选值供多选下拉渲染 */
  child?: { choices?: ChoiceOption[]; [key: string]: unknown };
};

export type SearchFieldsResult = Omit<Envelope, "data"> & {
  data: SearchFieldsItem[];
};

export type SearchColumnsResult = Omit<Envelope, "data"> & {
  data: SearchColumnsItem[];
};

/** 分页列表结果，行结构由具体接口决定 */
export type ListResult<T = RecordType> = Omit<Envelope, "data"> & {
  data: {
    /** 列表数据 */
    results: Array<T>;
    /** 总条目数 */
    total?: number;
    /** `?with_meta=1` 时内联的展示字段元数据（同 search-columns 载荷） */
    search_columns?: SearchColumnsResult["data"];
    /** `?with_meta=1` 时内联的查询字段元数据（同 search-fields 载荷） */
    search_fields?: SearchFieldsResult["data"];
  };
};

export type DetailResult<T = RecordType> = Omit<Envelope, "data"> & {
  /** 详情数据：单行动态对象（可用泛型收窄具体契约形状） */
  data: T;
  /** 服务端字段级校验错误（校验失败场景），RePlusPage 表单消费后内联展示 */
  errors?: ServerErrors;
};

/** 任务中心异步记录统计（后端 system/utils/record_stats.py 契约；导出/导入/任务执行三端 stats 共用） */
export type RecordStats = {
  days: number;
  total: number;
  in_progress: number;
  failed: number;
  latest: {
    pk: string;
    name: string;
    status: string;
    created_time: string;
  } | null;
};

/** 服务端字段级校验错误（common/core/exception.py 封装），field → 错误消息(列表) */
export type ServerErrors = Record<string, string[] | string>;

export type BaseResult = Omit<Envelope, "data"> & {
  /** 校验错误时携带；RePlusPage 表单消费后内联展示 */
  errors?: ServerErrors;
};

/** 导入列映射的目标字段选项（import-headers 下发） */
export type ImportFieldOption = { value: string; label: string };

/**
 * 上传文件首行表头解析结果（列映射步骤）：
 * `candidates` 与 `headers` 等长（归一化等名候选，无候选为空串）；
 * `model` 为目标模型 label_lower，模板按该标识隔离。
 */
export type ImportHeadersResult = Omit<Envelope, "data"> & {
  data: {
    headers: string[];
    candidates: string[];
    fields: ImportFieldOption[];
    model: string;
  };
};

/** 导入列映射模板（按目标模型隔离，个人 / 共享两档） */
export type ImportTemplateItem = {
  pk: string;
  model: string;
  name: string;
  mapping: Record<string, string>;
  options?: Record<string, unknown>;
  is_shared: boolean;
};

/**
 * 标准操作结果：`create`/`update` 类接口返回 `DetailResult`（带 `data`），
 * 其余写操作返回 `BaseResult`；调用方仅依赖 `code`/`detail` 时使用本联合类型
 */
export type ApiResult = BaseResult | DetailResult;
