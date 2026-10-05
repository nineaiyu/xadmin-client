import { BaseApi, listRows } from "@/api/base";
import { fetchAllRows } from "@/utils/fetchAllRows";
import type { DataListResult, DetailResult, ListResult } from "@/api/types";
import type { DashboardItem } from "@/api/dataset/datasets";

/** 大屏画布窗格类型：仪表盘 / 文本 / 时钟 / 指标卡 / 图片 */
export type ScreenPaneType =
  "dashboard" | "text" | "clock" | "metric" | "image";

/**
 * 大屏画布窗格：12 列栅格绝对定位（x/y 为列/行下标，x+w≤12、y+h≤60）。
 * `layout` 为空 = 轮播模式（存量形态），非空 = 画布模式。
 * 服务端会丢弃未声明键并拒绝越界/重叠（见 dataset/utils/screen_layout.py）。
 */
export type ScreenLayoutPane = {
  pk: string;
  type: ScreenPaneType;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  /** type=dashboard：仪表盘 pk */
  dashboard?: string;
  /** type=text：文本内容 */
  text?: string;
  align?: "left" | "center" | "right";
  /** type=text/clock：字号 px（text 缺省 24、clock 缺省 40） */
  size?: number;
  /** type=metric：指标卡（无分组单值聚合，同数据集聚合口径） */
  dataset?: string;
  metric?: "count" | "sum" | "avg";
  value_field?: string;
  /** type=image：图片地址（仅 http/https）与填充方式 */
  url?: string;
  fit?: "cover" | "contain" | "fill";
};

/** 大屏与定时报表 */
export type ScreenItem = {
  pk: string;
  name: string;
  dashboards: string[];
  layout?: ScreenLayoutPane[];
  interval: number;
  refresh: number;
  visibility: "personal" | "shared";
  /** 行级归属：creator 本人/超管为 true；非本人修改删除会被后端守卫拒绝（1003） */
  is_owner?: boolean;
};

/**
 * 关联字段（object_related_field）的接口形态：BaseModelSerializer 对未声明
 * `label_format` 的外键下发 `{pk,label}` 对象，且此时 label 与 pk 同值；
 * 历史数据与部分接口为纯 pk 字符串，故按联合类型兼容两种形态。
 */
export type RelatedPk = string | { pk: string; label?: string };

/** 取关联字段主键：对象取 pk，标量原样透传（空值归空串） */
export function relatedPk(value: RelatedPk | null | undefined): string {
  return typeof value === "object" && value !== null
    ? value.pk
    : String(value ?? "");
}

/** 报表聚合组件类型（表格即「明细本体」，不做成组件） */
export type ReportComponentType = "number" | "bar" | "line" | "pie";

/**
 * 报表聚合组件：投递时每个组件落一张独立 sheet（见 dataset/utils/report_design.py）。
 * `number` 不带 group_by；图表类必须带 group_by；`sum`/`avg` 必须给数值列 value_field。
 */
export type ReportDesignComponent = {
  id: string;
  type: ReportComponentType;
  /** 宽度档位：12 整行 / 6 半行 */
  span?: 12 | 6;
  title?: string;
  metric?: "count" | "sum" | "avg";
  value_field?: string;
  group_by?: string;
  date_trunc?: "day" | "month";
};

/** 报表设计：明细列 + 行数上限 + 聚合组件；空 = 存量口径（全列明细单表） */
export type ReportDesign = {
  columns?: string[];
  table_limit?: number;
  components?: ReportDesignComponent[];
};

export type ReportItem = {
  pk: string;
  name: string;
  dataset: RelatedPk;
  mode: "rows" | "aggregate";
  group_by: string;
  metric: "count" | "sum" | "avg";
  date_trunc: string;
  value_field: string;
  /** 报表设计（P2.2 批次二）：空 = 存量口径 */
  design?: ReportDesign;
  frequency: "daily" | "weekly" | "monthly";
  send_time: string;
  weekday: number;
  /** 行级归属：creator 本人/超管为 true；非本人修改删除会被后端守卫拒绝（1003） */
  is_owner?: boolean;
  /** 每月几号投递（1~28，monthly 用） */
  month_day?: number;
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

export const screenApi = new BaseApi("/api/dataset/screens");
export const reportApi = new BaseApi("/api/dataset/reports");

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
  const api = new BaseApi("/api/dataset/reports");
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
  const api = new BaseApi("/api/dataset/reports");
  return api.request<DetailResult>("post", {}, {}, `${api.baseApi}/${pk}/run`);
};

/** 大屏管理弹窗的仪表盘选项（fetchAllRows 逐页拉全，避免超过分页上限被截断） */
export const listDashboards = async (): Promise<DashboardItem[]> => {
  const api = new BaseApi("/api/dataset/dashboards");
  const res = (await fetchAllRows(api.list)) as ListResult;
  return listRows<DashboardItem>(res);
};

export { listRows };
