import { BaseApi, listRows } from "@/api/base";
import { fetchAllRows } from "@/utils/fetchAllRows";
import type { DetailResult, ListResult } from "@/api/types";
import type { DashboardItem } from "@/api/system/datasets";

/** 大屏与定时报表 */
export type ScreenItem = {
  pk: string;
  name: string;
  dashboards: string[];
  interval: number;
  refresh: number;
  visibility: "personal" | "shared";
};

export type ReportItem = {
  pk: string;
  name: string;
  dataset: string;
  mode: "rows" | "aggregate";
  group_by: string;
  metric: "count" | "sum" | "avg";
  date_trunc: string;
  value_field: string;
  frequency: "daily" | "weekly" | "monthly";
  send_time: string;
  weekday: number;
  recipients: string[];
  is_active: boolean;
  last_run_at: string | null;
  last_status: string;
};

export const screenApi = new BaseApi("/api/system/screens");
export const reportApi = new BaseApi("/api/system/reports");

/** 报表立即运行（返回下载中心产物 pk） */
export const runReport = (pk: string) => {
  const api = new BaseApi("/api/system/reports");
  return api.request<DetailResult>("post", {}, {}, `${api.baseApi}/${pk}/run`);
};

/** 大屏管理弹窗的仪表盘选项（fetchAllRows 逐页拉全，避免超过分页上限被截断） */
export const listDashboards = async (): Promise<DashboardItem[]> => {
  const api = new BaseApi("/api/system/dashboards");
  const res = (await fetchAllRows(api.list)) as ListResult;
  return listRows<DashboardItem>(res);
};

export { listRows };
