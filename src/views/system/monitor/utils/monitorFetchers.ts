import { SUCCESS_CODE } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import { monitorApi } from "@/api/system/monitor";
import { ALERT_RANGE } from "./monitorState";
import type {
  MonitorEventsParams,
  MonitorHistoryParams
} from "@/api/system/monitor";
import type { MonitorState } from "./monitorState";

/**
 * 监控面板数据拉取（自 hook.ts 抽出）：全量面板（含 fresh 穿透短缓存）、
 * 历史趋势、阈值读写与告警记录。
 */
export function createMonitorFetchers(state: MonitorState) {
  /** fresh=true 时带 no_cache 参数穿透服务端 10s 短缓存（手动刷新场景） */
  const fetchAll = async (fresh = false) => {
    state.loading.value = true;
    try {
      // 面板各区块独立展示，单个接口失败不拖垮整页
      const params = fresh ? { no_cache: "1" } : undefined;
      const results = await Promise.allSettled([
        monitorApi.overview(params),
        monitorApi.services(params),
        monitorApi.redisInfo(params),
        monitorApi.celery(params),
        monitorApi.slow(params),
        monitorApi.taskHealth(params),
        monitorApi.thresholds(),
        monitorApi.events({ kind: "alert", range: ALERT_RANGE })
      ]);
      if (results[0].status === "fulfilled")
        state.overview.value = results[0].value.data;
      if (results[1].status === "fulfilled")
        state.services.value = results[1].value.data;
      if (results[2].status === "fulfilled")
        state.redisInfo.value = results[2].value.data;
      if (results[3].status === "fulfilled")
        state.celery.value = results[3].value.data;
      if (results[4].status === "fulfilled")
        state.slow.value = results[4].value.data;
      if (results[5].status === "fulfilled")
        state.taskHealth.value = results[5].value.data;
      if (results[6].status === "fulfilled")
        state.thresholds.value = results[6].value.data;
      if (results[7].status === "fulfilled") {
        state.alerts.value = results[7].value.data.results;
        if (results[7].value.data.counts)
          state.alertCounts.value = results[7].value.data.counts;
      }
    } finally {
      state.loading.value = false;
    }
  };

  /** 历史趋势：筛选条件由页面持有，按需拉取（无短缓存，多窗口不互相污染） */
  const fetchHistory = async (params: MonitorHistoryParams) => {
    state.historyLoading.value = true;
    try {
      const res = await monitorApi.history(params);
      if (res.code === SUCCESS_CODE) state.history.value = res.data;
    } catch {
      // 请求失败（含切页/连点筛选被路由层取消）静默：保留旧数据，loading 由 finally 复位
    } finally {
      state.historyLoading.value = false;
    }
  };

  const fetchThresholds = async () => {
    try {
      const res = await monitorApi.thresholds();
      if (res.code === SUCCESS_CODE) state.thresholds.value = res.data;
    } catch {
      // 静默：阈值区块保留旧值
    }
  };

  /** 保存阈值：返回原始响应，由调用方按业务码提示（异常归一为失败结果） */
  const saveThresholds = (values: Record<string, number>) =>
    monitorApi.updateThresholds(values).catch(normalizeError);

  /** 告警记录（告警卡筛选联动；counts 同步回写顶部横幅口径） */
  const fetchAlerts = async (params?: Omit<MonitorEventsParams, "kind">) => {
    try {
      const res = await monitorApi.events({
        kind: "alert",
        range: ALERT_RANGE,
        ...params
      });
      if (res.code === SUCCESS_CODE) {
        state.alerts.value = res.data.results;
        if (res.data.counts) state.alertCounts.value = res.data.counts;
      }
    } catch {
      // 静默：告警列表保留旧值
    }
  };

  return {
    fetchAll,
    fetchHistory,
    fetchThresholds,
    saveThresholds,
    fetchAlerts
  };
}
