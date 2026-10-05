import type { RecordType } from "plus-pro-components";
import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** 数据集与仪表盘（可视化一期） */
export type DatasetVisibility = "personal" | "shared";

export type DatasetFilter = {
  field: string;
  op:
    | "exact"
    | "in"
    | "gte"
    | "gt"
    | "lte"
    | "lt"
    | "contains"
    | "startswith"
    | "isnull";
  value: unknown;
};

export type DatasetItem = {
  pk: string;
  name: string;
  description: string;
  bound_model: string;
  columns: string[];
  /** 数值列（读侧派生）：sum/avg 度量字段候选（后端聚合二次校验） */
  numeric_columns?: string[];
  filters: DatasetFilter[];
  ordering: string;
  row_limit: number;
  config: { date_field?: string };
  visibility: DatasetVisibility;
  /** 行级归属：creator 本人/超管为 true；非本人修改删除会被后端守卫拒绝（1003） */
  is_owner?: boolean;
};

export type DatasetMeta = {
  models: string[];
  fields: Record<string, string[]>;
  /** 各模型上的 JSON 字段（JSON 路径列 `字段.键` 的可用根） */
  json_fields?: Record<string, string[]>;
};

export type ExecuteResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
};

export type AggregateResult = {
  name: string;
  metric: string;
  series: { name: string; value: number }[];
};

/** metric：指标卡（无分组单值聚合，count = 行总数；与数据集聚合同口径） */
export type ChartType = "number" | "metric" | "line" | "bar" | "pie";

export type DashboardCard = {
  id: string;
  dataset: string;
  title: string;
  chart_type: ChartType;
  group_by?: string;
  metric?: "count" | "sum" | "avg";
  date_trunc?: "day" | "month";
  value_field?: string;
  span?: 3 | 6 | 9 | 12;
  /** 卡片高度 px（缺省 224，向后兼容存量布局） */
  height?: number;
  /** 卡片级权限：可见角色 code 列表，空/缺省 = 全员可见 */
  allowed_roles?: string[];
};

export type DashboardItem = {
  pk: string;
  name: string;
  visibility: DatasetVisibility;
  layout: DashboardCard[];
  creator?: { username: string };
  /** 行级归属：creator 本人/超管为 true；非本人修改删除会被后端守卫拒绝（1003） */
  is_owner?: boolean;
};

/** 数据集 API：CRUD 复用 BaseApi，执行/聚合/元数据为自定义动作 */
class DatasetApi extends BaseApi {
  meta = () => {
    return this.request<DetailResult>("get", {}, {}, `${this.baseApi}/meta`);
  };
  execute = <T = RecordType>(pk: string, data?: object) => {
    return this.request<DetailResult<T>>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/execute`
    );
  };
  aggregate = <T = RecordType>(pk: string, data: object) => {
    return this.request<DetailResult<T>>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/aggregate`
    );
  };
}

export const datasetApi = new DatasetApi("/api/dataset/datasets");

export const dashboardApi = new BaseApi("/api/dataset/dashboards");

/** 列表结果取行（BaseModelSet 分页外壳）：统一实现在 api/base.ts */
export { listRows } from "@/api/base";
