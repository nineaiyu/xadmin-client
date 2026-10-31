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
/** 实时档：超过该窗口没有推送帧即本机回落 HTTP 重拉（服务端 beat 15s 一推） */
export const REALTIME_STALE_MS = 30_000;
const REALTIME_WATCHDOG_MS = 15_000;

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
  refresh,
  lastFrameAt
}: {
  kiosk: Ref<boolean>;
  /** 地址栏 ?refresh= 的原始值（字符串/数组/undefined 均可） */
  requestedSeconds: unknown;
  refresh: () => void;
  /** 推送帧到达时刻（实时档回落判据；缺省视为没有推送通道） */
  lastFrameAt?: Ref<number>;
}) {
  function resolveInitialSeconds(): number {
    if (!kiosk.value) return 0;
    const requested = Number(requestedSeconds);
    return AUTO_REFRESH_OPTIONS.some(item => item.value === requested)
      ? requested
      : KIOSK_DEFAULT_REFRESH_SECONDS;
  }

  const seconds = ref(resolveInitialSeconds());
  const realtimeFallback = ref(false);
  let timer: number | undefined;

  const stop = () => {
    if (timer) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };

  const frameClock = lastFrameAt;
  const fallbackTick = () => {
    if (seconds.value !== REALTIME_REFRESH_SECONDS) return;
    const last = frameClock?.value ?? 0;
    if (Date.now() - last < REALTIME_STALE_MS) {
      realtimeFallback.value = false;
      return;
    }
    // 推送通道不可用/无帧：本机重拉，并在下一窗口内不重复触发
    realtimeFallback.value = true;
    if (frameClock) frameClock.value = Date.now();
    refresh();
  };

  // immediate：kiosk 初值非 0 时也要在挂载即建定时器（否则永远不刷新）
  watch(
    seconds,
    value => {
      stop();
      realtimeFallback.value = false;
      if (value > 0) {
        timer = window.setInterval(refresh, value * 1000);
      } else if (value === REALTIME_REFRESH_SECONDS) {
        timer = window.setInterval(fallbackTick, REALTIME_WATCHDOG_MS);
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(stop);

  return { seconds, stop, realtimeFallback };
}
