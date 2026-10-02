import { onBeforeUnmount, ref, type Ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { WS } from "@/utils/websocket";
import {
  isOutboundMessage,
  MessageAction,
  type ScreenCommandPayload,
  type ScreenDataPayload
} from "@/utils/websocket/protocol";
import type { ScreenItem } from "@/api/dataset/analysis";
import type { DashboardItem } from "@/api/dataset/datasets";
import { resolveScreenFrame } from "./control";

/**
 * 投屏页的轮播 / 数据刷新 / 时钟定时器与远程控制通道（自 display.vue 抽出，行数门禁）。
 *
 * 口径与抽取前一致：
 * - 轮播按 `screen.interval` 翻页（远程接管或暂停时停翻），数据按 `screen.refresh` 重拉；
 * - 时钟独立 1s tick（画布模式的时钟窗格复用同一文本，避免每窗格一个 interval）；
 * - 控制帧：模式/页码对齐 + refresh 帧仅在代数递增时重拉（纯函数内核见 `utils/control.ts`）；
 * - 「服务端 dashboards 下标 → 本地可见列表」映射，跳过不可见仪表盘不会错位；
 * - 卸载清理（停表 + 断开 WS）由本 composable 注册，调用方无需再管。
 *
 * F2 服务端聚合推送：同通道接收 `screen_data` 帧（按浏览者各自聚合），收到即转发
 * `applyScreenData` 逐卡免拉刷新；推送活跃期本机数据轮询静默（超过两个刷新周期
 * 未收到帧才回落本地重拉，服务端推送不可用/旧版本后端时行为与之前完全一致）。
 */
/** 本机轮询回落窗口 = refresh × 该倍数（期间收到过 screen_data 帧即视为推送活跃） */
const DATA_FALLBACK_FACTOR = 2;

export function useScreenDisplay(deps: {
  screen: Ref<ScreenItem | null>;
  dashboards: Ref<DashboardItem[]>;
  /** 重拉可见数据（轮播模式逐卡、画布模式逐窗格，由调用方决定口径） */
  refreshVisible: () => void;
  /** 应用服务端聚合数据帧（screen_data，按 card 免拉刷新；由调用方决定路由） */
  applyScreenData: (frame: ScreenDataPayload) => void;
}) {
  const pageIndex = ref(0);
  const paused = ref(false);
  const clock = ref("");
  /** 远程控制态：manual = 管理端接管（停轮播）；连接时以服务端回放为准 */
  const controlMode = ref<"auto" | "manual">("auto");

  let pageTimer: number | undefined;
  let refreshTimer: number | undefined;
  let clockTimer: number | undefined;
  let ws: WS | null = null;
  /** 最近一次数据刷新代数：重连回放/重复帧不触发多余重拉 */
  let lastRefreshRev = 0;
  /** 最近一次 screen_data 帧到达时刻（epoch ms）：推送活跃期本机轮询静默 */
  let lastDataFrameAt = 0;

  const tickClock = () => {
    clock.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
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
        paused.value ||
        controlMode.value === "manual" ||
        deps.dashboards.value.length === 0
      )
        return;
      pageIndex.value = (pageIndex.value + 1) % deps.dashboards.value.length;
    }, interval);
    refreshTimer = window.setInterval(() => {
      // screen_data 推送活跃（回落窗口内收到过帧）时本机重拉静默，避免双通道并发取数
      if (Date.now() - lastDataFrameAt < refresh * DATA_FALLBACK_FACTOR) return;
      deps.refreshVisible();
    }, refresh);
    clockTimer = window.setInterval(tickClock, 1000);
    tickClock();
  };

  /** 服务端下标 → 本地可见列表下标（服务端按 Screen.dashboards 原序计页） */
  const applyServerIndex = (serverIndex: number) => {
    const pk = (deps.screen.value?.dashboards ?? [])[serverIndex];
    if (!pk) return;
    const localIndex = deps.dashboards.value.findIndex(item => item.pk === pk);
    if (localIndex >= 0) pageIndex.value = localIndex;
  };

  /** 应用控制帧：模式/页码对齐 + refresh 帧仅在代数递增时重拉数据 */
  const applyScreenFrame = (frame: ScreenCommandPayload) => {
    const effect = resolveScreenFrame(
      { mode: controlMode.value, refreshRev: lastRefreshRev },
      frame
    );
    controlMode.value = effect.mode;
    lastRefreshRev = effect.refreshRev;
    if (effect.serverIndex !== null) applyServerIndex(effect.serverIndex);
    if (effect.refresh) deps.refreshVisible();
  };

  /** 展示端通道：连接即回放控制态，此后被动接收控制帧与聚合数据帧（断线由 WS 自带退避重连） */
  const startWs = (pk: string) => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WS(`${protocol}//${location.host}/ws/screen/${pk}`, {
      autoReconnect: true,
      heartbeat: true
    });
    ws.onMessage((res: unknown) => {
      if (
        isOutboundMessage<ScreenDataPayload>(res, MessageAction.SCREEN_DATA)
      ) {
        if (res.code !== SUCCESS_CODE || !res.data) return;
        lastDataFrameAt = Date.now();
        deps.applyScreenData(res.data);
        return;
      }
      if (
        !isOutboundMessage<ScreenCommandPayload>(
          res,
          MessageAction.SCREEN_COMMAND
        )
      )
        return;
      if (res.code !== SUCCESS_CODE || !res.data) return;
      applyScreenFrame(res.data);
    });
  };

  const stopWs = () => {
    ws?.close();
    ws = null;
  };

  onBeforeUnmount(() => {
    stopTimers();
    stopWs();
  });

  return {
    pageIndex,
    paused,
    clock,
    controlMode,
    startTimers,
    startWs,
    stopWs
  };
}
