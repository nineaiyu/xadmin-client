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
  filters: DatasetFilter[];
  ordering: string;
  row_limit: number;
  config: { date_field?: string };
  visibility: DatasetVisibility;
};

export type DatasetMeta = {
  models: string[];
  fields: Record<string, string[]>;
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

export type ChartType = "number" | "line" | "bar" | "pie";

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
};

export type DashboardItem = {
  pk: string;
  name: string;
  visibility: DatasetVisibility;
  layout: DashboardCard[];
  creator?: { username: string };
};

/** 数据集 API：CRUD 复用 BaseApi，执行/聚合/元数据为自定义动作 */
class DatasetApi extends BaseApi {
  meta = () => {
    return this.request<DetailResult>("get", {}, {}, `${this.baseApi}/meta`);
  };
  execute = (pk: string, data?: object) => {
    return this.request<DetailResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/execute`
    );
  };
  aggregate = (pk: string, data: object) => {
    return this.request<DetailResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/aggregate`
    );
  };
}

export const datasetApi = new DatasetApi("/api/system/datasets");

export const dashboardApi = new BaseApi("/api/system/dashboards");

/** 列表结果取行（BaseModelSet 分页外壳）：统一实现在 api/base.ts */
export { listRows } from "@/api/base";
