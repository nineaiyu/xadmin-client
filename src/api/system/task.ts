import { BaseApi } from "@/api/base";
import type { BaseResult, DataListResult, DetailResult } from "@/api/types";

/** 已注册 celery 任务（任务路径下拉数据源） */
type RegisteredTask = {
  name: string;
  verbose_name: string;
};

/** 定时任务管理（django_celery_beat） */
class PeriodicTaskApi extends BaseApi {
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
export const taskExecutionApi = new BaseApi("/api/system/tasks/executions");
