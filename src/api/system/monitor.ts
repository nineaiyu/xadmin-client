import { BaseRequest } from "@/api/base";
import { http } from "@/utils/http";

/** 监控接口通用响应（ApiResponse 外壳 + 强类型 data） */
export type MonitorResult<T> = {
  code: number;
  detail: string;
  data: T;
};

/** 实时指标快照（psutil 直读，卡片秒级新鲜；采集失败为 null） */
export type MonitorLive = {
  cpu_percent: number;
  cpu_load: number;
  memory_used: number;
  disk_used: number;
  swap_percent: number;
  cpu_count: number;
  process_count: number;
  net_sent_mb: number;
  net_recv_mb: number;
  /** 网卡上行速率（KB/s）；首次采集或计数器重置为 null */
  net_sent_rate: number | null;
  /** 网卡下行速率（KB/s） */
  net_recv_rate: number | null;
  boot_time: number;
};

/** 健康总览分项（资源走阈值分档，服务走探测状态） */
export type MonitorHealthItem = {
  key: string;
  group: "resource" | "service";
  label: string;
  status: "healthy" | "warning" | "critical" | "unknown";
  value?: number | null;
  unit?: string;
  threshold?: number;
  cost?: number | string;
};

export type MonitorHealth = {
  status: "healthy" | "warning" | "critical";
  score: number;
  items: MonitorHealthItem[];
  alerts: { firing: number; total_24h: number; resolved_24h: number };
  checked_at: string;
};

/** 主机资源概览 */
export type MonitorOverview = {
  live: MonitorLive | null;
  latest: {
    cpu_percent: number;
    cpu_load: number;
    memory_used: number;
    disk_used: number;
    boot_time: number;
    created_time: string;
  } | null;
  trend: {
    cpu_percent: number;
    cpu_load: number;
    memory_used: number;
    disk_used: number;
    created_time: string;
  }[];
  health: MonitorHealth | null;
};

/** 服务健康（status 与 cost 可能为探测失败原因字符串） */
export type MonitorServices = {
  db: { status: boolean; cost: number | string };
  redis: { status: boolean; cost: number | string };
  celery: { status: boolean; cost: number | string };
  status: boolean;
};

export type MonitorRedisInfo = {
  redis?: {
    version?: string;
    used_memory_human?: string;
    maxmemory_human?: string;
    connected_clients?: number;
    uptime_days?: number;
    keyspace_hits?: number;
    keyspace_misses?: number;
    hit_rate?: number | null;
    dbs?: Record<string, number>;
    status?: boolean;
    error?: string;
  };
  queues?: Record<string, number | string>;
};

export type MonitorCelery = {
  workers: {
    name: string;
    concurrency: number | string;
    active: number;
    reserved: number;
    uptime: number;
  }[];
  total: number;
  skipped?: boolean;
};

export type MonitorSlow = {
  threshold: number;
  results: {
    pk: string;
    module: string | null;
    path: string | null;
    method: string | null;
    exec_time: number;
    status_code: number | null;
    creator__username: string | null;
    created_time: string;
  }[];
};

export type MonitorTaskHealth = {
  window_days: number;
  total: number;
  success: number;
  failure: number;
  revoked: number;
  running: number;
  pending: number;
  success_rate: number | null;
  state: "healthy" | "degraded" | "failing";
  avg_cost_seconds: number | null;
  recent_failures: {
    pk: string;
    name: string;
    status: string;
    date_finished: string | null;
  }[];
  per_task: {
    name: string;
    total: number;
    success_rate: number | null;
  }[];
};

/** 历史趋势可选指标（百分比类与数值类分轴渲染） */
export type MonitorMetric =
  | "cpu_percent"
  | "cpu_load"
  | "memory_used"
  | "disk_used"
  | "net_sent_rate"
  | "net_recv_rate";

export type MonitorHistoryPoint = { time: string } & Partial<
  Record<MonitorMetric, number>
>;

export type MonitorMetricStat = {
  min: number | null;
  max: number | null;
  avg: number | null;
  last: number | null;
};

export type MonitorCompareStat = {
  prev_avg: number | null;
  delta: number | null;
  percent: number | null;
};

export type MonitorHistory = {
  range: {
    start: string;
    end: string;
    interval: string;
    interval_seconds: number;
    range_key: string;
  };
  metrics: MonitorMetric[];
  points: MonitorHistoryPoint[];
  summary: Partial<Record<MonitorMetric, MonitorMetricStat>>;
  compare: Partial<Record<MonitorMetric, MonitorCompareStat>>;
  raw_points: number;
};

export type MonitorHistoryParams = {
  range?: string;
  start?: string;
  end?: string;
  /** auto / 1m / 5m / 15m / 1h / 1d */
  interval?: string;
  /** 逗号分隔的多指标 */
  metrics?: string;
  compare?: string;
  /** 穿透服务端短缓存（趋势接口无缓存，保留兼容） */
  no_cache?: string;
};

export type MonitorThresholdItem = {
  key: string;
  value: number | null;
  label: string;
  help_text: string;
  min: number;
  max: number;
};

export type MonitorThresholds = {
  items: MonitorThresholdItem[];
  check_interval_seconds: number;
  changed?: string[];
};

export type MonitorAlertStatus = "firing" | "resolved";

export type MonitorAlertEvent = {
  pk: number;
  item: string;
  status: MonitorAlertStatus;
  value: number;
  threshold: number;
  message: string;
  count: number;
  first_time: string;
  last_time: string;
  resolved_time: string | null;
};

export type MonitorErrorEvent = {
  pk: string;
  module: string | null;
  path: string | null;
  method: string | null;
  status_code: number | null;
  response_code: number | null;
  exec_time: number | null;
  ipaddress: string | null;
  creator__username: string | null;
  created_time: string;
};

export type MonitorTaskEvent = {
  pk: string;
  name: string;
  status: string;
  date_start: string | null;
  date_finished: string | null;
};

export type MonitorEventKind = "alert" | "error" | "task";

export type MonitorEventsParams = {
  kind?: MonitorEventKind;
  /** 1h / 24h / 7d / 30d */
  range?: string;
  status?: MonitorAlertStatus | "";
  item?: string;
};

/** 事件响应随 kind 变化（调用方按 kind 断言具体行类型）；alert 带 counts */
export type MonitorEvents = {
  results: MonitorAlertEvent[] | MonitorErrorEvent[] | MonitorTaskEvent[];
  counts?: { firing: number; total_24h: number; resolved_24h: number };
};

/** 监控导出（kind=history 趋势报表 / alerts 告警记录；type=csv|xlsx） */
export type MonitorExportParams = MonitorHistoryParams & {
  kind?: "history" | "alerts";
  type?: "csv" | "xlsx";
  status?: MonitorAlertStatus | "";
  item?: string;
};

/** 系统监控面板（只读 + 告警阈值设置） */
class MonitorApi extends BaseRequest {
  overview = (params?: object) => {
    return this.request<MonitorResult<MonitorOverview>>(
      "get",
      params ?? {},
      {},
      `${this.baseApi}/overview`
    );
  };
  services = (params?: object) => {
    return this.request<MonitorResult<MonitorServices>>(
      "get",
      params ?? {},
      {},
      `${this.baseApi}/services`
    );
  };
  redisInfo = (params?: object) => {
    return this.request<MonitorResult<MonitorRedisInfo>>(
      "get",
      params ?? {},
      {},
      `${this.baseApi}/redis-info`
    );
  };
  celery = (params?: object) => {
    return this.request<MonitorResult<MonitorCelery>>(
      "get",
      params ?? {},
      {},
      `${this.baseApi}/celery`
    );
  };
  taskHealth = (params?: object) => {
    return this.request<MonitorResult<MonitorTaskHealth>>(
      "get",
      params ?? {},
      {},
      `${this.baseApi}/task-health`
    );
  };
  slow = (params?: object) => {
    return this.request<MonitorResult<MonitorSlow>>(
      "get",
      params ?? {},
      {},
      `${this.baseApi}/slow`
    );
  };
  history = (params?: MonitorHistoryParams) => {
    return this.request<MonitorResult<MonitorHistory>>(
      "get",
      params ?? {},
      {},
      `${this.baseApi}/history`
    );
  };
  thresholds = () => {
    return this.request<MonitorResult<MonitorThresholds>>(
      "get",
      {},
      {},
      `${this.baseApi}/thresholds`
    );
  };
  updateThresholds = (data: Record<string, number>) => {
    return this.request<MonitorResult<MonitorThresholds>>(
      "put",
      {},
      data,
      `${this.baseApi}/thresholds`
    );
  };
  events = (params?: MonitorEventsParams) => {
    return this.request<MonitorResult<MonitorEvents>>(
      "get",
      params ?? {},
      {},
      `${this.baseApi}/events`
    );
  };
  /** 报表导出（后端按 Content-Disposition 回传文件名，走 blob 落盘） */
  exportReport = (params?: MonitorExportParams) => {
    return http.autoDownload(
      `${this.baseApi}/export`,
      undefined,
      this.formatParams(params ?? {})
    );
  };
}

export const monitorApi = new MonitorApi("/api/system/monitor");
