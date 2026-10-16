import { onBeforeUnmount, watch, type Ref } from "vue";
import { WS } from "@/utils/websocket";
import {
  MessageAction,
  type ScreenCommandPayload,
  type ScreenDataPayload,
  type ScreenPageStatePayload
} from "@/utils/websocket/protocol";
import type { ScreenItem } from "@/api/dataset/analysis";
import type { DashboardItem } from "@/api/dataset/datasets";
import {
  localIndexToServer,
  resolveScreenFrame,
  resolveScreenInbound,
  serverIndexToLocal
} from "./control";
import type { DataFrameClock } from "./useScreenTimers";

/**
 * 投屏页的远程控制与聚合推送通道（自 useScreenDisplay 抽出，行数门禁）：控制帧
 * 对齐（refresh 去重内核见 control.ts）、当前页上报（screen_page_state，仅轮播
 * 模式，canvas 单帧与页码无关）、聚合数据帧（screen_data）转发并按帧刷新数据帧
 * 时刻（推送活跃期本机轮询静默）；卸载时断开 WS。
 */
export function useScreenChannel(deps: {
  screen: Ref<ScreenItem | null>;
  dashboards: Ref<DashboardItem[]>;
  pageIndex: Ref<number>;
  controlMode: Ref<"auto" | "manual">;
  refreshVisible: () => void;
  /** 应用服务端聚合数据帧（screen_data，按 card 免拉刷新；由调用方决定路由） */
  applyScreenData: (frame: ScreenDataPayload) => void;
  dataFrameAt: DataFrameClock;
}) {
  let ws: WS | null = null;
  /** 最近一次数据刷新代数：重连回放/重复帧不触发多余重拉 */
  let lastRefreshRev = 0;

  const serverDashboards = () => deps.screen.value?.dashboards ?? [];

  /** 服务端页码对齐到本地可见列表（无对应可见项时保持当前页） */
  const applyServerIndex = (serverIndex: number) => {
    const localIndex = serverIndexToLocal(
      serverDashboards(),
      deps.dashboards.value,
      serverIndex
    );
    if (localIndex !== null) deps.pageIndex.value = localIndex;
  };

  /** 上报当前页（screen_page_state，仅轮播模式）：WS 未开静默跳过（重连后 onOpen 补报） */
  const reportPageState = () => {
    if (!ws || deps.dashboards.value.length === 0) return;
    if ((deps.screen.value?.layout ?? []).length > 0) return;
    const serverIndex = localIndexToServer(
      serverDashboards(),
      deps.dashboards.value,
      deps.pageIndex.value
    );
    if (serverIndex < 0) return;
    const payload: ScreenPageStatePayload = { index: serverIndex };
    ws.send(
      JSON.stringify({ action: MessageAction.SCREEN_PAGE_STATE, data: payload })
    );
  };

  /** 应用控制帧：模式/页码对齐 + refresh 帧仅在代数递增时重拉数据 */
  const applyScreenFrame = (frame: ScreenCommandPayload) => {
    const effect = resolveScreenFrame(
      { mode: deps.controlMode.value, refreshRev: lastRefreshRev },
      frame
    );
    deps.controlMode.value = effect.mode;
    lastRefreshRev = effect.refreshRev;
    if (effect.serverIndex !== null) applyServerIndex(effect.serverIndex);
    if (effect.refresh) deps.refreshVisible();
  };

  /** 展示端通道：连接即回放控制态，此后被动接收控制帧与聚合数据帧（断线由 WS 自带退避重连） */
  const startWs = (pk: string) => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WS(`${protocol}//${location.host}/ws/screen/${pk}`, {
      autoReconnect: true,
      heartbeat: true,
      // 连接（含断线重连）成功即补报当前页：重连后服务端按新连接重新聚合
      openCallback: () => reportPageState()
    });
    ws.onMessage((res: unknown) => {
      const inbound = resolveScreenInbound(res);
      if (!inbound) return;
      if (inbound.kind === "data") {
        deps.dataFrameAt.at = Date.now();
        deps.applyScreenData(inbound.frame);
        return;
      }
      applyScreenFrame(inbound.frame);
    });
  };

  const stopWs = () => {
    ws?.close();
    ws = null;
  };

  // 每次翻页（本地轮播 / 远程切换 / 回放对齐）随手上报，服务端下一轮触发按新页聚合
  watch(deps.pageIndex, reportPageState);

  onBeforeUnmount(stopWs);

  return { startWs, stopWs };
}
