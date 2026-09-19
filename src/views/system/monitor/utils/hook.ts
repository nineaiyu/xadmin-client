import { SUCCESS_CODE } from "@/api/types";
import { onActivated, onDeactivated, onUnmounted, ref } from "vue";
import { isOutboundMessage, MessageAction } from "@/utils/websocket/protocol";
import type { MonitorPushPayload } from "@/utils/websocket/protocol";
import { WS } from "@/utils/websocket";
import {
  monitorApi,
  type MonitorAlertEvent,
  type MonitorCelery,
  type MonitorEventsParams,
  type MonitorHistory,
  type MonitorHistoryParams,
  type MonitorOverview,
  type MonitorRedisInfo,
  type MonitorServices,
  type MonitorSlow,
  type MonitorTaskHealth,
  type MonitorThresholds
} from "@/api/system/monitor";
/** WS 断连后的轮询兜底间隔（WS 在线时由服务端 5s 推 live / 30s 推 panel） */
const POLL_FALLBACK_INTERVAL = 15_000;

/** 告警记录默认窗口：与告警卡「最近 7 天」口径一致 */
const ALERT_RANGE = "7d";

/** 监控面板数据源：WS 实时推送为主（autoRefresh 开启时），HTTP 轮询兜底 */
export function useMonitor() {
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

  let timer: ReturnType<typeof setInterval> | null = null;
  let ws: WS | null = null;
  /** 主动停止（切页停用/卸载/关闭自动刷新）后，WS 关闭回调不得再拉起轮询兜底 */
  let stopped = false;

  /** fresh=true 时带 no_cache 参数穿透服务端 10s 短缓存（手动刷新场景） */
  const fetchAll = async (fresh = false) => {
    loading.value = true;
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
        overview.value = results[0].value.data;
      if (results[1].status === "fulfilled")
        services.value = results[1].value.data;
      if (results[2].status === "fulfilled")
        redisInfo.value = results[2].value.data;
      if (results[3].status === "fulfilled")
        celery.value = results[3].value.data;
      if (results[4].status === "fulfilled") slow.value = results[4].value.data;
      if (results[5].status === "fulfilled")
        taskHealth.value = results[5].value.data;
      if (results[6].status === "fulfilled")
        thresholds.value = results[6].value.data;
      if (results[7].status === "fulfilled") {
        alerts.value = results[7].value.data.results as MonitorAlertEvent[];
        if (results[7].value.data.counts)
          alertCounts.value = results[7].value.data.counts;
      }
    } finally {
      loading.value = false;
    }
  };

  /** 历史趋势：筛选条件由页面持有，按需拉取（无短缓存，多窗口不互相污染） */
  const fetchHistory = async (params: MonitorHistoryParams) => {
    historyLoading.value = true;
    try {
      const res = await monitorApi.history(params);
      if (res.code === SUCCESS_CODE) history.value = res.data;
    } catch {
      // 请求失败（含切页/连点筛选被路由层取消）静默：保留旧数据，loading 由 finally 复位
    } finally {
      historyLoading.value = false;
    }
  };

  const fetchThresholds = async () => {
    try {
      const res = await monitorApi.thresholds();
      if (res.code === SUCCESS_CODE) thresholds.value = res.data;
    } catch {
      // 静默：阈值区块保留旧值
    }
  };

  /** 保存阈值：返回原始响应，由调用方按业务码提示（异常归一为失败结果） */
  const saveThresholds = (values: Record<string, number>) =>
    monitorApi.updateThresholds(values).catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error),
      data: null as unknown as MonitorThresholds
    }));

  /** 告警记录（告警卡筛选联动；counts 同步回写顶部横幅口径） */
  const fetchAlerts = async (params?: MonitorEventsParams) => {
    try {
      const res = await monitorApi.events({
        kind: "alert",
        range: ALERT_RANGE,
        ...params
      });
      if (res.code === SUCCESS_CODE) {
        alerts.value = res.data.results as MonitorAlertEvent[];
        if (res.data.counts) alertCounts.value = res.data.counts;
      }
    } catch {
      // 静默：告警列表保留旧值
    }
  };

  const applyWsFrame = (payload: MonitorPushPayload) => {
    if (payload.section === "live" && payload.live) {
      // live 高频帧：只刷新主机快照，trend/health 由低频 panel 帧带出
      overview.value = { ...overview.value, live: payload.live };
      return;
    }
    if (payload.section === "panel") {
      if (payload.services) services.value = payload.services;
      if (payload.redis) redisInfo.value = payload.redis;
      if (payload.celery) celery.value = payload.celery;
      if (payload.slow) slow.value = payload.slow;
      if (payload.trend?.length)
        overview.value = { ...overview.value, trend: payload.trend };
      if (payload.health)
        overview.value = { ...overview.value, health: payload.health };
    }
  };

  const startWs = () => {
    if (ws) return;
    stopped = false;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WS(`${protocol}//${location.host}/ws/system/monitor/`, {
      autoReconnect: true,
      heartbeat: true,
      openCallback: () => {
        wsConnected.value = true;
        stopPolling();
      },
      closeCallback: () => {
        wsConnected.value = false;
        // WS 异常断连期间回退到轮询（重连成功 openCallback 自动停）；主动停止
        // （切页停用/卸载/关闭自动刷新）触发的 close 不得再拉起轮询，否则组件
        // 离开后定时器仍在后台打接口
        if (!stopped && autoRefresh.value) startPolling();
      }
    });
    ws.onMessage((res: unknown) => {
      if (!isOutboundMessage<MonitorPushPayload>(res, MessageAction.MONITOR))
        return;
      if (res.code !== SUCCESS_CODE || !res.data) return;
      applyWsFrame(res.data);
    });
  };

  const stopWs = () => {
    stopped = true;
    ws?.close();
    ws = null;
    wsConnected.value = false;
  };

  const startPolling = () => {
    if (timer) return;
    timer = setInterval(fetchAll, POLL_FALLBACK_INTERVAL);
  };

  const stopPolling = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const toggleAuto = (enabled: boolean) => {
    if (enabled) {
      startWs();
      // WS 建立前的窗口用轮询兜底（openCallback 后自动停）
      startPolling();
    } else {
      stopWs();
      stopPolling();
    }
  };

  const start = async () => {
    await fetchAll();
    toggleAuto(autoRefresh.value);
  };

  /** 停用/卸载统一收尾：停推送 + 停轮询（keep-alive 切页只触发 deactivated） */
  const stopLive = () => {
    stopWs();
    stopPolling();
  };

  onActivated(() => {
    // keep-alive 命中缓存回到本页：恢复推送；WS 建连窗口内以轮询兜底
    if (!autoRefresh.value) return;
    startWs();
    if (!wsConnected.value) startPolling();
  });
  onDeactivated(stopLive);
  onUnmounted(stopLive);

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
    fetchAll,
    fetchHistory,
    fetchThresholds,
    saveThresholds,
    fetchAlerts,
    toggleAuto,
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
