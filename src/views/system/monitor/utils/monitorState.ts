import { ref } from "vue";
import type {
  MonitorAlertEvent,
  MonitorCelery,
  MonitorHistory,
  MonitorOverview,
  MonitorRedisInfo,
  MonitorServices,
  MonitorSlow,
  MonitorTaskHealth,
  MonitorThresholds
} from "@/api/system/monitor";
import type { MonitorPushPayload } from "@/utils/websocket/protocol";

/** 告警记录默认窗口：与告警卡「最近 7 天」口径一致 */
export const ALERT_RANGE = "7d";

/**
 * 监控面板状态容器（自 hook.ts 抽出）：各区块独立 ref，便于「单接口失败
 * 不拖垮整页」与 WS 推送的分区回写。
 */
export function createMonitorState() {
  const loading = ref(false);
  const autoRefresh = ref(true);
  const wsConnected = ref(false);
  const overview = ref<MonitorOverview>({
    live: null,
    latest: null,
    trend: [],
    health: null
  });
  const services = ref<MonitorServices | null>(null);
  const redisInfo = ref<MonitorRedisInfo>({});
  const celery = ref<MonitorCelery>({ workers: [], total: 0 });
  const slow = ref<MonitorSlow>({ threshold: 1, results: [] });
  const taskHealth = ref<MonitorTaskHealth | null>(null);
  const history = ref<MonitorHistory | null>(null);
  const historyLoading = ref(false);
  const thresholds = ref<MonitorThresholds | null>(null);
  const alerts = ref<MonitorAlertEvent[]>([]);
  const alertCounts = ref({ firing: 0, total_24h: 0, resolved_24h: 0 });

  return {
    loading,
    autoRefresh,
    wsConnected,
    overview,
    services,
    redisInfo,
    celery,
    slow,
    taskHealth,
    history,
    historyLoading,
    thresholds,
    alerts,
    alertCounts
  };
}

export type MonitorState = ReturnType<typeof createMonitorState>;

/** WS 推送帧回写：live 高频帧只刷新主机快照，trend/health 由低频 panel 帧带出 */
export function applyMonitorWsFrame(
  state: MonitorState,
  payload: MonitorPushPayload
) {
  if (payload.section === "live" && payload.live) {
    state.overview.value = { ...state.overview.value, live: payload.live };
    return;
  }
  if (payload.section === "panel") {
    if (payload.services) state.services.value = payload.services;
    if (payload.redis) state.redisInfo.value = payload.redis;
    if (payload.celery) state.celery.value = payload.celery;
    if (payload.slow) state.slow.value = payload.slow;
    if (payload.trend?.length)
      state.overview.value = { ...state.overview.value, trend: payload.trend };
    if (payload.health)
      state.overview.value = {
        ...state.overview.value,
        health: payload.health
      };
  }
}
