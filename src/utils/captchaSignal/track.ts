/** 轨迹采样（L0 行为包）：纯函数，便于单测与跨组件复用。 */

import type { CaptchaTrackPoint } from "@/api/auth";

/** pointermove 采样节流（毫秒）：事件合并后仍保留可读的轨迹形态 */
export const TRACK_SAMPLE_MS = 16;

export function isKeyboardEvent(event: unknown): event is KeyboardEvent {
  return typeof KeyboardEvent !== "undefined" && event instanceof KeyboardEvent;
}

export function shouldSample(
  now: number,
  lastSampleAt: number,
  minInterval = TRACK_SAMPLE_MS
): boolean {
  return now - lastSampleAt >= minInterval;
}

export function buildTrackPoint(
  x: number,
  y: number,
  t: number,
  ev?: string
): CaptchaTrackPoint {
  return ev ? { x, y, t, ev } : { x, y, t };
}

export function trackDuration(track: CaptchaTrackPoint[]): number {
  if (track.length < 2) return 0;
  return Math.max(0, track[track.length - 1].t - track[0].t);
}

export function isKeyboardTrack(track: CaptchaTrackPoint[]): boolean {
  return track.some(point => point.ev === "keyboard");
}
