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

/** 定时任务管理（django_celery_beat） */
class PeriodicTaskApi extends BaseApi {
  /** 批量更新：对选中行统一写入同组字段值 */
  batchUpdate = (
    pks: Array<number | string>,
    fields: Record<string, unknown>,
    marker = "batchUpdate"
  ) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pks, fields, _write_marker: marker },
      `${this.baseApi}/batch-update`
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
  /** 批量启用/停用任务（enabled 省略时按各任务当前状态取反） */
  batchEnable = (pks: Array<number | string>, enabled?: boolean) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pks: [...pks], enabled },
      `${this.baseApi}/batch-enable`
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

export const periodicTaskApi = new PeriodicTaskApi(
  "/api/system/tasks/periodic"
);
export const crontabScheduleApi = new BaseApi("/api/system/tasks/crontab");
export const intervalScheduleApi = new BaseApi("/api/system/tasks/interval");

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
}

export const taskExecutionApi = new TaskExecutionApi(
  "/api/system/tasks/executions"
);

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

export const taskCenterApi = new TaskCenterApi("/api/system/tasks/unified");
