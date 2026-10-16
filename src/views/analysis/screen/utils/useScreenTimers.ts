import { onBeforeUnmount, type Ref } from "vue";
import type { ScreenItem } from "@/api/dataset/analysis";
import type { DashboardItem } from "@/api/dataset/datasets";

/** 本机轮询回落窗口 = refresh × 该倍数（期间收到过 screen_data 帧即视为推送活跃） */
export const DATA_FALLBACK_FACTOR = 2;

/** 最近一次 screen_data 帧到达时刻（epoch ms）：推送活跃期本机轮询静默（与通道共享） */
export type DataFrameClock = { at: number };

/**
 * 投屏页的轮播 / 数据刷新 / 时钟定时器（自 useScreenDisplay 抽出，行数门禁）。
 *
 * 口径与抽取前一致：轮播按 `screen.interval` 翻页（远程接管或暂停时停翻），数据按
 * `screen.refresh` 重拉；时钟独立 1s tick（画布模式的时钟窗格复用同一文本，避免每
 * 窗格一个 interval）。卸载清理（停表）由本 composable 注册。
 */
export function useScreenTimers(deps: {
  screen: Ref<ScreenItem | null>;
  dashboards: Ref<DashboardItem[]>;
  pageIndex: Ref<number>;
  paused: Ref<boolean>;
  controlMode: Ref<"auto" | "manual">;
  clock: Ref<string>;
  /** 重拉可见数据（轮播模式逐卡、画布模式逐窗格，由调用方决定口径） */
  refreshVisible: () => void;
  dataFrameAt: DataFrameClock;
}) {
  let pageTimer: number | undefined;
  let refreshTimer: number | undefined;
  let clockTimer: number | undefined;

  const tickClock = () => {
    deps.clock.value = new Date().toLocaleTimeString("zh-CN", {
      hour12: false
    });
  };

  const stopTimers = () => {
    [pageTimer, refreshTimer, clockTimer].forEach(
      timer => timer && window.clearInterval(timer)
    );
    pageTimer = refreshTimer = clockTimer = undefined;
  };

  const startTimers = () => {
    stopTimers();
    const interval = Math.max((deps.screen.value?.interval ?? 15) * 1000, 5000);
    const refresh = Math.max((deps.screen.value?.refresh ?? 60) * 1000, 10000);
    pageTimer = window.setInterval(() => {
      if (
        deps.paused.value ||
        deps.controlMode.value === "manual" ||
        deps.dashboards.value.length === 0
      )
        return;
      deps.pageIndex.value =
        (deps.pageIndex.value + 1) % deps.dashboards.value.length;
    }, interval);
    refreshTimer = window.setInterval(() => {
      // screen_data 推送活跃（回落窗口内收到过帧）时本机重拉静默，避免双通道并发取数
      if (Date.now() - deps.dataFrameAt.at < refresh * DATA_FALLBACK_FACTOR)
        return;
      deps.refreshVisible();
    }, refresh);
    clockTimer = window.setInterval(tickClock, 1000);
    tickClock();
  };

  onBeforeUnmount(stopTimers);

  return { startTimers, stopTimers };
}
