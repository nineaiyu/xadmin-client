import { onMounted, onUnmounted } from "vue";

/** 执行历史自动刷新间隔：进行中的行无需手动刷新 */
export const EXECUTION_AUTO_REFRESH_MS = 10_000;

type TableRef = { value?: { handleGetData?: () => void } };

/** 页面存活期间定时刷新列表；隐藏标签页时跳过，避免后台空转 */
export function useExecutionAutoRefresh(
  tableRef: TableRef | undefined,
  interval = EXECUTION_AUTO_REFRESH_MS
) {
  let timer: ReturnType<typeof setInterval> | undefined;

  onMounted(() => {
    timer = setInterval(() => {
      if (document.hidden) return;
      tableRef?.value?.handleGetData?.();
    }, interval);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });
}
