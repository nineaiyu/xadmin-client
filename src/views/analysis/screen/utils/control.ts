import type { ScreenCommandPayload } from "@/utils/websocket/protocol";

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
