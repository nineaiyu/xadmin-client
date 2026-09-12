import { computed, type Ref, ref } from "vue";
import { useIntervalFn } from "@vueuse/core";
import { hasAuth } from "@/router/utils";
import { exportRecordApi } from "@/api/system/export";
import { importRecordApi } from "@/api/system/import";
import { taskExecutionApi } from "@/api/system/task";
import type { DetailResult, RecordStats } from "@/api/types";

/**
 * 任务中心：导出 / 导入 / 任务执行三类异步记录的**聚合计数**。
 *
 * 设计要点（沿用 `utils/approvalBadge` 的单例范式）：
 * - **模块级单例**：顶栏角标与任务中心抽屉共享同一份计数，任一处刷新即可同步；
 * - **按权限码收口**：无 `stats:SystemXxx` 权限码的用户不发起请求（不产生 403 噪声），
 *   对应计数保持 0 —— 与后端 action 的权限校验口径一致；
 * - **短轮询 + 写后刷新**：服务端 `stats` 有 10s 短缓存，客户端 60s 轮询足够；
 *   提交异步任务后调用 `refreshTaskCenter()` 立即刷新，避免"刚提交看不到"。
 * 轮询生命周期（挂载即拉取、卸载自动停止）由 `useIntervalFn` 随组件 scope 清理。
 */

const POLL_INTERVAL = 60_000;

// RecordStats 契约类型已归位到 @/api/types（后端 record_stats.py 对应），此处 re-export 保持既有引用点
export type { RecordStats };

const STATS_AUTH = {
  export: "stats:SystemExportRecord",
  import: "stats:SystemImportRecord",
  task: "stats:SystemTaskExecution"
} as const;

type StatsKey = keyof typeof STATS_AUTH;

const exportStats = ref<RecordStats | null>(null);
const importStats = ref<RecordStats | null>(null);
const taskStats = ref<RecordStats | null>(null);

const statsRefs: Record<StatsKey, Ref<RecordStats | null>> = {
  export: exportStats,
  import: importStats,
  task: taskStats
};

const statsApis: Record<StatsKey, () => Promise<DetailResult<RecordStats>>> = {
  export: () => exportRecordApi.stats(),
  import: () => importRecordApi.stats(),
  task: () => taskExecutionApi.stats()
};

/** 拉取一类记录统计：无权限直接跳过；失败静默（角标是附加信息，不能影响主流程） */
async function loadOne(key: StatsKey): Promise<void> {
  if (!hasAuth(STATS_AUTH[key])) {
    statsRefs[key].value = null;
    return;
  }
  try {
    const res = await statsApis[key]();
    if (res.code === 1000 && res.data) {
      statsRefs[key].value = res.data;
    }
  } catch {
    // 静默：轮询失败不应打断页面
  }
}

/** 拉取全部三类统计（任一失败不影响其他两类） */
export function refreshTaskCenter(): void {
  void Promise.all([loadOne("export"), loadOne("import"), loadOne("task")]);
}

/**
 * 进行中的异步记录数（导出 + 导入 + 任务执行）。
 *
 * **只计"进行中"、不计"失败"**：失败记录会长期滞留（近 30 天窗口），
 * 计入角标会让铃铛长期挂着一个与当前无关的数字；失败在抽屉里单独成段展示。
 */
export const runningCount = computed(
  () =>
    Number(exportStats.value?.in_progress || 0) +
    Number(importStats.value?.in_progress || 0) +
    Number(taskStats.value?.in_progress || 0)
);

/** 订阅聚合统计：挂载即拉取一次并开启轮询，卸载自动停止 */
export function useTaskCenter() {
  useIntervalFn(refreshTaskCenter, POLL_INTERVAL, { immediateCallback: true });

  return {
    exportStats,
    importStats,
    taskStats,
    runningCount,
    load: refreshTaskCenter
  };
}
