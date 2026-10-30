import { onBeforeUnmount, ref, watch, type Ref } from "vue";

/** 实时档位值：不开本机定时器，由 ws/dashboard/<pk> 推送通道驱动数据帧 */
export const REALTIME_REFRESH_SECONDS = -1;

/** 自动刷新档位（0 = 关闭，-1 = 实时推送）；模板与解析共用同一份清单 */
export const AUTO_REFRESH_OPTIONS = [
  { value: 0, labelKey: "dashboard.autoRefreshOff" },
  {
    value: REALTIME_REFRESH_SECONDS,
    labelKey: "dashboard.autoRefreshRealtime"
  },
  { value: 10, labelKey: "dashboard.autoRefresh10s" },
  { value: 30, labelKey: "dashboard.autoRefresh30s" },
  { value: 60, labelKey: "dashboard.autoRefresh60s" },
  { value: 300, labelKey: "dashboard.autoRefresh5m" }
];

/** 展板（kiosk）模式默认刷新间隔：挂屏无人操作，必须自动轮看 */
const KIOSK_DEFAULT_REFRESH_SECONDS = 60;

/**
 * 仪表盘自动刷新：档位选择 + 定时触发。
 *
 * - 普通模式默认关闭；
 * - kiosk 模式默认 60s（可用 `?refresh=` 覆盖，仅接受选项内档位）；
 * - 实时档（-1）：不开本机定时器，数据帧由 ws/dashboard/<pk> 推送通道驱动；
 * - 切档立即重建定时器，卸载时清理。
 */
export function useDashboardAutoRefresh({
  kiosk,
  requestedSeconds,
  refresh
}: {
  kiosk: Ref<boolean>;
  /** 地址栏 ?refresh= 的原始值（字符串/数组/undefined 均可） */
  requestedSeconds: unknown;
  refresh: () => void;
}) {
  function resolveInitialSeconds(): number {
    if (!kiosk.value) return 0;
    const requested = Number(requestedSeconds);
    return AUTO_REFRESH_OPTIONS.some(item => item.value === requested)
      ? requested
      : KIOSK_DEFAULT_REFRESH_SECONDS;
  }

  const seconds = ref(resolveInitialSeconds());
  let timer: number | undefined;

  const stop = () => {
    if (timer) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };

  // immediate：kiosk 初值非 0 时也要在挂载即建定时器（否则永远不刷新）
  watch(
    seconds,
    value => {
      stop();
      if (value > 0) {
        timer = window.setInterval(refresh, value * 1000);
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(stop);

  return { seconds, stop };
}
