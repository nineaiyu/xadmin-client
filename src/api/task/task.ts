import { BaseApi } from "@/api/base";
import type {
  BaseResult,
  DataListResult,
  DetailResult,
  ListResult,
  RecordStats
} from "@/api/types";

/** 已注册 celery 任务（任务路径下拉数据源） */
type RegisteredTask = {
  name: string;
  verbose_name: string;
};

/** 任务日志增量块（WS 帧与 HTTP log 接口同形状，见 task/utils/task_log.py） */
export type TaskLogChunk = {
  offset: number;
  content: string;
  finished: boolean;
};

/** 定时任务管理（django_celery_beat） */
class PeriodicTaskApi extends BaseApi {
  /** 启停单条任务（专用动作，不走通用布尔开关） */
  enable = (pk: number | string, enabled: boolean) => {
    return this.request<DetailResult>(
      "patch",
      {},
      { enabled },
      `${this.baseApi}/${pk}/enable`
    );
  };
  /** 立即执行一次任务 */
  run = (pk: number | string) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/run`
    );
  };
  /** 批量立即执行任务（请求体为任务主键数组） */
  batchRun = (pks: Array<number | string>) => {
    return this.request<BaseResult>(
      "post",
      {},
      [...pks],
      `${this.baseApi}/batch-run`
    );
  };
  /** 批量启用任务（独立路由与权限点） */
  batchEnable = (pks: Array<number | string>) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pks: [...pks] },
      `${this.baseApi}/batch-enable`
    );
  };
  /** 批量停用任务（独立路由与权限点） */
  batchDisable = (pks: Array<number | string>) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pks: [...pks] },
      `${this.baseApi}/batch-disable`
    );
  };
  /** 克隆任务（复制计划与参数，克隆体默认停用） */
  clone = (pk: number | string) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/clone`
    );
  };
  /** 已注册任务列表（任务路径下拉数据源） */
  registered = () => {
    return this.request<DataListResult<RegisteredTask>>(
      "get",
      {},
      {},
      `${this.baseApi}/registered`
    );
  };
}

export const periodicTaskApi = new PeriodicTaskApi("/api/task/periodic");

/** crontab 未来触发预览（按声明时区换算） */
export type CrontabPreview = {
  expression: string;
  timezone: string;
  next_runs: string[];
};

/** 调度被引用任务明细（删除前预览 / 删除被拒时定位） */
export type ScheduleReference = {
  total: number;
  tasks: Array<{ pk: string; name: string }>;
  truncated: boolean;
};

/** 调度基础能力：引用任务清单（crontab / interval 共用） */
class ScheduleApi extends BaseApi {
  references = (pk: number | string) => {
    return this.request<DetailResult<ScheduleReference>>(
      "get",
      {},
      {},
      `${this.baseApi}/${pk}/references`
    );
  };
}

/** cron 表达式管理（额外提供未来 5 次触发预览） */
class CrontabScheduleApi extends ScheduleApi {
  preview = (data: {
    minute: string;
    hour: string;
    day_of_month: string;
    month_of_year: string;
    day_of_week: string;
    timezone?: string;
  }) => {
    return this.request<DetailResult<CrontabPreview>>(
      "post",
      {},
      data,
      `${this.baseApi}/preview`
    );
  };
}

export const crontabScheduleApi = new CrontabScheduleApi("/api/task/crontab");
export const intervalScheduleApi = new ScheduleApi("/api/task/interval");

/** 任务执行历史（日志经 WebSocket 增量推送，见 TaskLogDialog.vue） */
class TaskExecutionApi extends BaseApi {
  /** 近 N 天统计（总数 / 进行中 / 失败 / 最近一次），服务端 10s 短缓存 */
  stats = () => {
    return this.request<DetailResult<RecordStats>>(
      "get",
      {},
      {},
      `${this.baseApi}/stats`
    );
  };
  /**
   * 增量读取执行日志（HTTP 兜底通道）。
   *
   * 主通道是 `ws/tasks/log/<pk>` 的 WebSocket 推送；代理不支持升级、连接假活
   * 等场景按 offset 轮询本接口，两路读的是同一份 celery 日志文件。
   */
  log = (pk: string | number, offset = 0) => {
    return this.request<DetailResult<TaskLogChunk>>(
      "get",
      { offset },
      {},
      `${this.baseApi}/${pk}/log`
    );
  };
}

export const taskExecutionApi = new TaskExecutionApi("/api/task/executions");

/* ---------------- 任务中心：三类记录统一视图 + 取消 / 重跑 ---------------- */

export type TaskCenterKind = "task" | "export" | "import";

export type TaskCenterRow = {
  type: TaskCenterKind;
  pk: string;
  name: string;
  module: string;
  /** 所属定时任务名（仅执行历史有值，手动执行为空） */
  periodic_task: string;
  status: string;
  progress: number | null;
  /** 统一进度助手的阶段描述（如「统计行数 / 渲染内容」，任务类型为空） */
  stage: string;
  /** 执行耗时（秒，仅执行历史有值） */
  time_cost: number | null;
  creator: string;
  created_time: string | null;
  finished_time: string | null;
  error: string;
  has_file: boolean;
  total?: number;
  success_rows?: number;
  failed_rows?: number;
  can_cancel: boolean;
  can_rerun: boolean;
  /** 可在任务中心清理（仅执行历史；导出/导入记录的删除在下载中心） */
  can_delete: boolean;
};

export type TaskCenterQuery = {
  type?: string;
  status?: string;
  keyword?: string;
  creator?: string;
  created_time_after?: string;
  created_time_before?: string;
  page?: number;
  size?: number;
};

/** 任务中心接口（跨类型聚合，不建新表） */
class TaskCenterApi extends BaseApi {
  /** 统一任务列表（按创建时间倒序 + 分页） */
  getUnified = (params: TaskCenterQuery) => {
    return this.request<ListResult<TaskCenterRow>>(
      "get",
      params,
      {},
      this.baseApi
    );
  };
  /** 取消任务（PENDING 立即终态；RUNNING 走协作点） */
  cancel = (type: TaskCenterKind, pk: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      { type, pk },
      `${this.baseApi}/cancel`
    );
  };
  /** 重跑任务（白名单：导出 / 导入 / 报表） */
  rerun = (type: TaskCenterKind, pk: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      { type, pk },
      `${this.baseApi}/rerun`
    );
  };
}

export const taskCenterApi = new TaskCenterApi("/api/task/unified");
