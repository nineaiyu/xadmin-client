import { BaseApi, listRows } from "@/api/base";
import { fetchAllRows } from "@/utils/fetchAllRows";
import type {
  DataListResult,
  DetailResult,
  Envelope,
  ListResult
} from "@/api/types";
import type { DashboardItem } from "@/api/dataset/datasets";

/** 大屏画布窗格类型：仪表盘 / 文本 / 时钟 / 指标卡 / 图片 / 视频 / 自定义 HTML */
export type ScreenPaneType =
  "dashboard" | "text" | "clock" | "metric" | "image" | "video" | "html";

/**
 * 大屏画布窗格：坐标语义随模式变化，类型字段两模式共用。
 *
 * - 栅格模式（`layout`）：12 列栅格绝对定位（x/y 为列/行下标，x+w≤12、y+h≤60）；
 * - 自由模式（`free_layout.panes`）：像素坐标（x/y 非负、w/h≥16、不超设计画幅，
 *   **允许重叠**——数组顺序即层级，后者在上）。
 *
 * 服务端会丢弃未声明键并按当前模式校验（见 dataset/utils/screen_layout.py）。
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
  /**
   * type=image / video / html：地址。图片收 http(s) 或站内根相对路径；视频同图片口径；
   * **自定义 HTML 只收 http(s) 绝对地址**（iframe src，绝不接受原样 HTML）。
   */
  url?: string;
  /** type=image / video：填充方式（video 只支持 cover / contain） */
  fit?: "cover" | "contain" | "fill";
  /** type=video：封面地址（http(s) 或站内根相对路径） */
  poster?: string;
  /** type=video：播放行为（缺省「静音 + 循环 + 自动播放」，只有显式关掉才下发） */
  muted?: boolean;
  loop?: boolean;
  autoplay?: boolean;
  /**
   * 视觉旋转角度（度，-180~180；缺省 0 不下发）。
   * **不参与几何**：吸附 / 框选 / 对齐仍按未旋转的轴对齐盒模型计算。
   */
  rotate?: number;
  /** 入场动画（仅展示态播放；缺省 none 不下发） */
  animation?: ScreenPaneAnimation;
  /** 动画时长 ms（0~5000，缺省 320 不下发；见 utils/paneEffects） */
  animation_duration?: number;
  /** 动画延迟 ms（0~5000，缺省 0 不下发） */
  animation_delay?: number;
  /** 循环播放（缺省 false 不下发；用于「呼吸」类强调效果） */
  animation_loop?: boolean;
  /** type=text：文本格式（缺省 plain 不下发；rich = 受限标记，见 utils/richText） */
  text_format?: "plain" | "rich";
};

/** 入场动画取值（与服务端 `SCREEN_ANIMATIONS` 同序同值） */
export type ScreenPaneAnimation =
  | "none"
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in";

/** 画布模式：grid 用 layout（缺省），free 用 free_layout */
export type ScreenLayoutMode = "grid" | "free";

/**
 * 自由画布载荷：基准设计画幅（投屏按此等比适配）+ 像素窗格。
 * 空对象 = 未启用自由画布（投屏回退链：自由窗格非空 → 栅格 > 轮播）。
 */
export type ScreenFreeLayout = {
  design_w: number;
  design_h: number;
  panes: ScreenLayoutPane[];
};

/**
 * choices 字段（layout_mode / visibility）经 BaseModelSerializer 序列化为
 * labeled choice（`{value,label}`）；历史纯字符串输入按标量兼容，读取统一走
 * `choiceValue`（见 @/utils/dict）。
 */
export type ScreenChoiceValue =
  string | { value?: string; label?: string } | null | undefined;

/** 大屏与定时报表 */
export type ScreenItem = {
  pk: string;
  name: string;
  dashboards: string[];
  layout?: ScreenLayoutPane[];
  /** 画布模式（labeled choice 形态，读取用 choiceValue） */
  layout_mode?: ScreenChoiceValue;
  /** 自由画布载荷（空对象 = 未启用） */
  free_layout?: Partial<ScreenFreeLayout>;
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
  /** 报表设计：空 = 存量口径 */
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

/**
 * 大屏模板（团队共享，ADR-088）：载荷与自由画布同形（`free_layout`），
 * 可见性 / 行级归属守卫与大屏同口径（非创建者改删 1003，列表下发 is_owner）。
 */
export type ScreenTemplateItem = {
  pk: string;
  name: string;
  /** 模板分组（ADR-090 D4；空 = 未分组） */
  group?: string;
  free_layout?: Partial<ScreenFreeLayout>;
  visibility: "personal" | "shared";
  is_owner?: boolean;
  created_time?: string;
  updated_time?: string;
};

export const screenTemplateApi = new BaseApi("/api/dataset/screen-templates");

/** 模板历史版本（只读；回滚目标选择用） */
export type ScreenTemplateVersionItem = {
  pk: string;
  version: number;
  name: string;
  group?: string;
  free_layout?: Partial<ScreenFreeLayout>;
  created_time?: string;
};

/** 模板历史版本列表（最新在前） */
export const listScreenTemplateVersions = (pk: string) =>
  screenTemplateApi.request<DataListResult<ScreenTemplateVersionItem>>(
    "get",
    {},
    {},
    `${screenTemplateApi.baseApi}/${pk}/versions`
  );

/** 回滚模板到指定版本（回滚本身也会记一版，可再回滚回来） */
export const rollbackScreenTemplate = (pk: string, version: number) =>
  screenTemplateApi.request<DetailResult<ScreenTemplateItem>>(
    "post",
    {},
    { version },
    `${screenTemplateApi.baseApi}/${pk}/rollback`
  );

/** 云端剪贴板（按用户单槽，ADR-090 D4）：跨设备复制粘贴 */
export const screenClipboardApi = new BaseApi("/api/dataset/screen-clipboard");

/** 投递渠道枚举：choices_dict 在响应顶层（与其它 choices 消费方同口径） */
export type ReportChannelChoicesResult = Omit<Envelope, "data"> & {
  choices_dict: Partial<{
    notify_channels: string[];
    im_notify_channels: string[];
  }>;
};

/** 投递渠道枚举（结构元数据）：值集单源在后端 REPORT_NOTIFY_CHANNELS / IM_NOTIFY_CHANNELS */
export const fetchReportChannels = () => {
  return reportApi.request<ReportChannelChoicesResult>(
    "get",
    {},
    {},
    `${reportApi.baseApi}/choices`
  );
};

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
