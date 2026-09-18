import { BaseApi, listRows } from "@/api/base";
import { fetchAllRows } from "@/utils/fetchAllRows";
import type { DataListResult, DetailResult, ListResult } from "@/api/types";
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
  cron_expression: string;
  recipients: string[];
  /** 投递渠道：email/dingtalk/wecom/feishu；空 = 仅邮件（存量兼容） */
  notify_channels: string[];
  /** IM 接收人（用户主键） */
  im_recipients: number[];
  is_active: boolean;
  last_run_at: string | null;
  last_status: string;
};

/** IM 接收人候选（报表管理权限内的关键字搜索） */
export type ReportUserOption = {
  pk: number;
  username: string;
  nickname: string;
};

/** 大屏远程控制态（服务端缓存，与 system/ws_screen.py 落态一致） */
export type ScreenCommandState = {
  /** auto 自动轮播 / manual 远程控制停播 */
  mode: "auto" | "manual";
  /** 当前页码（0 基） */
  index: number;
  /** 数据刷新代数：递增即展示端重拉数据 */
  refresh_rev: number;
  /** 控制态版本号（单调递增） */
  rev: number;
  /** 指令落态时间（ISO） */
  ts: string;
};

/** 大屏控制指令：switch 需 dashboard_pk、page 需 index、refresh/auto 无参 */
export type ScreenCommandPayload =
  | { command: "switch"; dashboard_pk: string }
  | { command: "page"; index: number }
  | { command: "refresh" }
  | { command: "auto" };

export const screenApi = new BaseApi("/api/system/screens");
export const reportApi = new BaseApi("/api/system/reports");

/** 读取控制态：state + 该大屏的仪表盘清单（pk 数组） */
export const getScreenCommandState = (pk: string) => {
  return screenApi.request<
    DetailResult<{ state: ScreenCommandState; dashboards: string[] }>
  >("get", {}, {}, `${screenApi.baseApi}/${pk}/command`);
};

/** 下发控制指令（服务端落态后广播到展示端 ws/screen/<pk>） */
export const sendScreenCommand = (pk: string, data: ScreenCommandPayload) => {
  return screenApi.request<DetailResult<{ state: ScreenCommandState }>>(
    "post",
    {},
    data,
    `${screenApi.baseApi}/${pk}/command`
  );
};

/** 报表 IM 接收人候选：关键字搜索 / 按主键回显（≤20 条） */
export const searchReportUsers = (params: {
  keyword?: string;
  pks?: number[];
}) => {
  const api = new BaseApi("/api/system/reports");
  const query: Record<string, unknown> = {};
  if (params.keyword) query.keyword = params.keyword;
  if (params.pks?.length) query.pks = params.pks.join(",");
  return api.request<DataListResult<ReportUserOption>>(
    "get",
    query,
    {},
    `${api.baseApi}/user-options`
  );
};

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
