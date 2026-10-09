import { SUCCESS_CODE } from "@/api/types";
import {
  isOutboundMessage,
  MessageAction,
  type ScreenCommandPayload,
  type ScreenDataPayload
} from "@/utils/websocket/protocol";

/** 展示端控制态（轮播模式 + 数据刷新代数） */
export interface ScreenControlState {
  mode: "auto" | "manual";
  refreshRev: number;
}

/** 控制帧应用结果：新控制态 + 页码 + 是否重拉数据 */
export interface ScreenFrameEffect extends ScreenControlState {
  /** 帧携带的服务端页码（null = 未携带/非法，调用方保持当前页） */
  serverIndex: number | null;
  /** 是否需重拉当前页数据（refresh 帧且代数递增） */
  refresh: boolean;
}

/**
 * 控制帧 → 展示端控制态（display.vue 的纯函数内核，便于单测）。
 *
 * - `state`（连接回放）只对齐模式与刷新代数，不触发重拉；
 * - `refresh` 仅在代数递增时触发重拉：重连回放与重复帧不产生多余请求；
 * - `switch` / `page` / `auto` 只对齐模式与页码。
 */
export function resolveScreenFrame(
  current: ScreenControlState,
  frame: ScreenCommandPayload
): ScreenFrameEffect {
  const mode =
    frame.mode === "auto" || frame.mode === "manual"
      ? frame.mode
      : current.mode;
  const serverIndex =
    typeof frame.index === "number" &&
    Number.isInteger(frame.index) &&
    frame.index >= 0
      ? frame.index
      : null;
  const frameRev = frame.refresh_rev ?? 0;
  if (frame.command === "state") {
    return { mode, serverIndex, refresh: false, refreshRev: frameRev };
  }
  if (frame.command === "refresh" && frameRev !== current.refreshRev) {
    return { mode, serverIndex, refresh: true, refreshRev: frameRev };
  }
  return { mode, serverIndex, refresh: false, refreshRev: current.refreshRev };
}

/**
 * 服务端下标 → 本地可见列表下标（服务端按 Screen.dashboards 原序计页）。
 *
 * 可见列表是 dashboards 的过滤子集（personal 仪表盘对他人不可见），跳过不可见项
 * 时仍按 pk 定位，不会错位。返回 null = 该下标无对应可见项（保持当前页）。
 */
export function serverIndexToLocal(
  serverDashboards: string[],
  visibleDashboards: { pk: string }[],
  serverIndex: number
): number | null {
  const pk = serverDashboards[serverIndex];
  if (!pk) return null;
  const localIndex = visibleDashboards.findIndex(item => item.pk === pk);
  return localIndex >= 0 ? localIndex : null;
}

/** 本地可见列表下标 → 服务端下标（-1 = 无所属，勿上报） */
export function localIndexToServer(
  serverDashboards: string[],
  visibleDashboards: { pk: string }[],
  localIndex: number
): number {
  const pk = visibleDashboards[localIndex]?.pk;
  if (!pk) return -1;
  return serverDashboards.indexOf(pk);
}

/** 入站帧归一结果：聚合数据帧 / 控制帧（其它帧与失败帧为 null，调用方跳过） */
export type ScreenInboundFrame =
  | { kind: "data"; frame: ScreenDataPayload }
  | { kind: "command"; frame: ScreenCommandPayload }
  | null;

/**
 * 展示端入站帧归一（纯函数内核，便于单测）：只认 screen_data 与 screen_command
 * 且业务码成功、载荷非空的帧，其余一律 null。
 */
export function resolveScreenInbound(raw: unknown): ScreenInboundFrame {
  if (isOutboundMessage<ScreenDataPayload>(raw, MessageAction.SCREEN_DATA)) {
    if (raw.code !== SUCCESS_CODE || !raw.data) return null;
    return { kind: "data", frame: raw.data };
  }
  if (
    isOutboundMessage<ScreenCommandPayload>(raw, MessageAction.SCREEN_COMMAND)
  ) {
    if (raw.code !== SUCCESS_CODE || !raw.data) return null;
    return { kind: "command", frame: raw.data };
  }
  return null;
}
