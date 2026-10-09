import { ref, type Ref } from "vue";
import type { ScreenDataPayload } from "@/utils/websocket/protocol";
import type { ScreenItem } from "@/api/dataset/analysis";
import type { DashboardItem } from "@/api/dataset/datasets";
import { useScreenTimers, type DataFrameClock } from "./useScreenTimers";
import { useScreenChannel } from "./useScreenChannel";

/**
 * 投屏页的轮播 / 数据刷新 / 时钟定时器与远程控制通道（自 display.vue 抽出，
 * 行数门禁）。
 *
 * 定时器口径见 useScreenTimers；控制帧与聚合推送见 useScreenChannel（两者共享
 * 「最近数据帧时刻」：推送活跃期本机轮询静默，超过两个刷新周期未收到帧才回落
 * 本地重拉，服务端推送不可用/旧版本后端时行为与之前完全一致）。卸载清理
 * （停表 + 断开 WS）由两个 composable 各自注册，调用方无需再管。
 */
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
  /** 最近一次 screen_data 帧到达时刻（定时器与通道共享） */
  const dataFrameAt: DataFrameClock = { at: 0 };

  const { startTimers } = useScreenTimers({
    screen: deps.screen,
    dashboards: deps.dashboards,
    pageIndex,
    paused,
    controlMode,
    clock,
    refreshVisible: deps.refreshVisible,
    dataFrameAt
  });

  const { startWs, stopWs } = useScreenChannel({
    screen: deps.screen,
    dashboards: deps.dashboards,
    pageIndex,
    controlMode,
    refreshVisible: deps.refreshVisible,
    applyScreenData: deps.applyScreenData,
    dataFrameAt
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
