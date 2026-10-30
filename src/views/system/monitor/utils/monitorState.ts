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
  /**
   * 各区块的加载失败原因（键存在 = 该块不可用）。
   *
   * 面板各区块独立展示，单个接口失败不拖垮整页；但「缺失」必须与真实值区分：
   * 此前健康横幅把空 health 当健康、资源卡把缺失当 0%、服务项把缺失当异常，
   * 三种「未知」被渲染成互相矛盾的确定结论。
   */
  const sectionErrors = ref<Partial<Record<MonitorSection, string>>>({});

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
    alertCounts,
    sectionErrors
  };
}

/** 监控面板区块标识（与 fetchAll 的 allSettled 顺序一一对应） */
export type MonitorSection =
  | "overview"
  | "services"
  | "redis"
  | "celery"
  | "slow"
  | "taskHealth"
  | "thresholds"
  | "alerts";

/** 失败原因归一：优先后端 detail，其次 axios message，最后通用文案 */
export function readSectionError(reason: unknown): string {
  const detail = (reason as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  if (detail != null && String(detail)) return String(detail);
  const message = (reason as { message?: unknown })?.message;
  return message != null && String(message) ? String(message) : "";
}

export type MonitorState = ReturnType<typeof createMonitorState>;

/** WS 推送帧回写：live 高频帧只刷新主机快照，trend/health 由低频 panel 帧带出 */
export function applyMonitorWsFrame(
  state: MonitorState,
  payload: MonitorPushPayload
) {
  if (payload.section === "live" && payload.live) {
    state.overview.value = { ...state.overview.value, live: payload.live };
    delete state.sectionErrors.value.overview;
    return;
  }
  if (payload.section === "panel") {
    // 推送到达即证明该区块可用：清掉此前 HTTP 拉取的失败标记
    if (payload.services) {
      state.services.value = payload.services;
      delete state.sectionErrors.value.services;
    }
    if (payload.redis) {
      state.redisInfo.value = payload.redis;
      delete state.sectionErrors.value.redis;
    }
    if (payload.celery) {
      state.celery.value = payload.celery;
      delete state.sectionErrors.value.celery;
    }
    if (payload.slow) {
      state.slow.value = payload.slow;
      delete state.sectionErrors.value.slow;
    }
    if (payload.trend?.length)
      state.overview.value = { ...state.overview.value, trend: payload.trend };
    if (payload.health) {
      state.overview.value = {
        ...state.overview.value,
        health: payload.health
      };
      delete state.sectionErrors.value.overview;
    }
  }
}
