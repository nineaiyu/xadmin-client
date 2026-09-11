import { BaseRequest } from "@/api/base";

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
  boot_time: number;
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

/** 系统监控面板（只读，短缓存） */
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
}

export const monitorApi = new MonitorApi("/api/system/monitor");
