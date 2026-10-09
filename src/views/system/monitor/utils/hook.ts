import { onActivated, onDeactivated, onUnmounted } from "vue";
import { createMonitorState } from "./monitorState";
import { createMonitorFetchers } from "./monitorFetchers";
import { createMonitorLive } from "./monitorLive";

/**
 * 监控面板数据源：状态容器见 monitorState.ts，拉取逻辑见 monitorFetchers.ts，
 * 实时通道（WS 推送 + 轮询兜底）见 monitorLive.ts。
 */
export function useMonitor() {
  const state = createMonitorState();
  const fetchers = createMonitorFetchers(state);
  const live = createMonitorLive({ state, fetchAll: fetchers.fetchAll });

  const start = async () => {
    await fetchers.fetchAll();
    live.toggleAuto(state.autoRefresh.value);
  };

  onActivated(live.resumeLive);
  onDeactivated(live.stopLive);
  onUnmounted(live.stopLive);

  return {
    ...state,
    fetchAll: fetchers.fetchAll,
    fetchHistory: fetchers.fetchHistory,
    fetchThresholds: fetchers.fetchThresholds,
    saveThresholds: fetchers.saveThresholds,
    fetchAlerts: fetchers.fetchAlerts,
    toggleAuto: live.toggleAuto,
    start
  };
}

/** 启动时长（boot_time 为 unix 秒） */
export function formatUptime(bootTime: number): string {
  if (!bootTime) return "—";
  const seconds = Math.max(0, Date.now() / 1000 - bootTime);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
