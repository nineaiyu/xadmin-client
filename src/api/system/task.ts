import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";

/** 定时任务管理（django_celery_beat） */
class PeriodicTaskApi extends BaseApi {
  /** 立即执行一次任务 */
  run = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/run`
    );
  };
  /** 批量立即执行任务（请求体为主键数组） */
  batchRun = (pks: Array<number | string>) => {
    return this.request<BaseResult>(
      "post",
      {},
      [...pks],
      `${this.baseApi}/batch-run`
    );
  };
  /** 已注册任务列表（任务路径下拉数据源，P1 使用） */
  registered = () => {
    return this.request<{ data: { name: string; verbose_name: string }[] }>(
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

/** 任务执行历史（日志走 WebSocket 推送，见 task-execution/TaskLogDialog.vue） */
export const taskExecutionApi = new BaseApi("/api/system/tasks/executions");
