import { onBeforeUnmount, watch, type Ref } from "vue";
import { WS } from "@/utils/websocket";
import {
  isOutboundMessage,
  MessageAction,
  type DashboardDataPayload
} from "@/utils/websocket/protocol";
import { isSuccess } from "@/api/types";

/** 卡片句柄面（ChartCard defineExpose 的推送相关子集，与 useCardImageHandle 收集共用） */
type FrameCardHandle = {
  applyData?: (entry: {
    card?: string;
    kind?: string;
    data?: unknown;
    detail?: string;
  }) => Promise<void> | void;
};

/**
 * 推送帧按卡片 id 路由到 ChartCard（applyData 与令牌重拉共用渲染路径）；
 * errors 走同一注入通道（ChartCard 按 detail 渲染错误态）。
 */
export function applyDashboardFrame(
  frame: DashboardDataPayload,
  cards: Record<string, FrameCardHandle | undefined>
) {
  for (const entry of frame.cards) {
    cards[entry.card]?.applyData?.(entry);
  }
  for (const error of frame.errors) {
    cards[error.card]?.applyData?.({
      card: error.card,
      detail: error.detail
    });
  }
}

/**
 * 仪表盘实时数据通道（ws/dashboard/<pk>）：自动刷新「实时」档的取数替代。
 *
 * 服务端按观察者权限各自聚合后自推（dashboard_data 帧，权限语义与逐卡 HTTP
 * 重拉等价）；连接即自推首帧，此后被动接收 beat 周期触发。断线由 WS 自带退避
 * 重连（重连后服务端 connect 逻辑重新推首帧）。本机定时器与手动刷新在实时档
 * 仍可用（手动刷新走 refreshToken，推送帧与令牌重拉共用 ChartCard 渲染路径）。
 */
export function useDashboardChannel(deps: {
  /** 是否启用通道（实时档选中且非编辑态） */
  enabled: Ref<boolean>;
  /** 当前仪表盘 pk（null = 未选中，不连） */
  dashboardPk: Ref<string | null>;
  /** 应用服务端聚合数据帧（dashboard_data，按 card 免拉刷新；由调用方路由到卡片句柄） */
  applyFrame: (frame: DashboardDataPayload) => void;
}) {
  let ws: WS | null = null;

  const startWs = (pk: string) => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WS(`${protocol}//${location.host}/ws/dashboard/${pk}`, {
      autoReconnect: true,
      heartbeat: true
    });
    ws.onMessage((res: unknown) => {
      if (
        !isOutboundMessage<DashboardDataPayload>(
          res,
          MessageAction.DASHBOARD_DATA
        )
      )
        return;
      if (!isSuccess(res) || !res.data) return;
      deps.applyFrame(res.data);
    });
  };

  const stopWs = () => {
    ws?.close();
    ws = null;
  };

  // 档位 / 切盘即时开合：切盘必须重连（组与服务端聚合都绑定盘 pk）
  watch(
    [deps.enabled, deps.dashboardPk],
    ([enabled, pk]) => {
      stopWs();
      if (enabled && pk) startWs(pk);
    },
    { immediate: true }
  );

  onBeforeUnmount(stopWs);

  return { stopWs };
}
