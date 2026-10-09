import { SUCCESS_CODE } from "@/api/types";
import { isOutboundMessage, MessageAction } from "@/utils/websocket/protocol";
import { WS } from "@/utils/websocket";
import { applyMonitorWsFrame } from "./monitorState";
import type { MonitorPushPayload } from "@/utils/websocket/protocol";
import type { MonitorState } from "./monitorState";

/** WS 断连后的轮询兜底间隔（WS 在线时由服务端 5s 推 live / 30s 推 panel） */
const POLL_FALLBACK_INTERVAL = 15_000;

/**
 * 监控面板实时通道（自 hook.ts 抽出）：WS 实时推送为主，HTTP 轮询兜底。
 * 主动停止（切页停用/卸载/关闭自动刷新）后，WS 关闭回调不得再拉起轮询，
 * 否则组件离开后定时器仍在后台打接口。
 */
export function createMonitorLive({
  state,
  fetchAll
}: {
  state: MonitorState;
  fetchAll: (fresh?: boolean) => Promise<void>;
}) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let ws: WS | null = null;
  let stopped = false;

  const stopPolling = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const startPolling = () => {
    if (timer) return;
    timer = setInterval(fetchAll, POLL_FALLBACK_INTERVAL);
  };

  const startWs = () => {
    if (ws) return;
    stopped = false;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WS(`${protocol}//${location.host}/ws/system/monitor/`, {
      autoReconnect: true,
      heartbeat: true,
      openCallback: () => {
        state.wsConnected.value = true;
        stopPolling();
      },
      closeCallback: () => {
        state.wsConnected.value = false;
        // WS 异常断连期间回退到轮询（重连成功 openCallback 自动停）
        if (!stopped && state.autoRefresh.value) startPolling();
      }
    });
    ws.onMessage((res: unknown) => {
      if (!isOutboundMessage<MonitorPushPayload>(res, MessageAction.MONITOR))
        return;
      if (res.code !== SUCCESS_CODE || !res.data) return;
      applyMonitorWsFrame(state, res.data);
    });
  };

  const stopWs = () => {
    stopped = true;
    ws?.close();
    ws = null;
    state.wsConnected.value = false;
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

  /** 停用/卸载统一收尾：停推送 + 停轮询（keep-alive 切页只触发 deactivated） */
  const stopLive = () => {
    stopWs();
    stopPolling();
  };

  /** keep-alive 命中缓存回到本页：恢复推送；WS 建连窗口内以轮询兜底 */
  const resumeLive = () => {
    if (!state.autoRefresh.value) return;
    startWs();
    if (!state.wsConnected.value) startPolling();
  };

  return { toggleAuto, stopLive, resumeLive };
}
