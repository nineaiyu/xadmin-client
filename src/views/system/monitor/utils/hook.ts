import { onUnmounted, ref } from "vue";
import { isOutboundMessage, MessageAction } from "@/utils/websocket/protocol";
import type { MonitorPushPayload } from "@/utils/websocket/protocol";
import { WS } from "@/utils/websocket";
import {
  monitorApi,
  type MonitorCelery,
  type MonitorOverview,
  type MonitorRedisInfo,
  type MonitorServices,
  type MonitorSlow
} from "@/api/system/monitor";
/** WS 断连后的轮询兜底间隔（WS 在线时由服务端 5s 推 live / 30s 推 panel） */
const POLL_FALLBACK_INTERVAL = 15_000;

/** 监控面板数据源：WS 实时推送为主（autoRefresh 开启时），HTTP 轮询兜底 */
export function useMonitor() {
  const loading = ref(false);
  const autoRefresh = ref(true);
  const wsConnected = ref(false);
  const overview = ref<MonitorOverview>({
    live: null,
    latest: null,
    trend: []
  });
  const services = ref<MonitorServices | null>(null);
  const redisInfo = ref<MonitorRedisInfo>({});
  const celery = ref<MonitorCelery>({ workers: [], total: 0 });
  const slow = ref<MonitorSlow>({ threshold: 1, results: [] });

  let timer: ReturnType<typeof setInterval> | null = null;
  let ws: WS | null = null;

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
        monitorApi.slow(params)
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
    } finally {
      loading.value = false;
    }
  };

  const applyWsFrame = (payload: MonitorPushPayload) => {
    if (payload.section === "live" && payload.live) {
      // live 高频帧：只刷新主机快照，trend 由低频 panel 帧带出
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
    }
  };

  const startWs = () => {
    if (ws) return;
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
        // WS 断连期间回退到轮询，重连成功（openCallback）后自动停掉
        if (autoRefresh.value) startPolling();
      }
    });
    ws.onMessage((res: unknown) => {
      if (!isOutboundMessage<MonitorPushPayload>(res, MessageAction.MONITOR))
        return;
      if (res.code !== 1000 || !res.data) return;
      applyWsFrame(res.data);
    });
  };

  const stopWs = () => {
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

  onUnmounted(() => {
    stopWs();
    stopPolling();
  });

  return {
    loading,
    autoRefresh,
    wsConnected,
    overview,
    services,
    redisInfo,
    celery,
    slow,
    fetchAll,
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
