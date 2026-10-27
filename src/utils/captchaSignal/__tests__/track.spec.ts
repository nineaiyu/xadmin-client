import { describe, expect, it } from "vitest";

import {
  TRACK_SAMPLE_MS,
  buildTrackPoint,
  isKeyboardTrack,
  shouldSample,
  trackDuration
} from "../track";

describe("captchaSignal/track", () => {
  it("采样节流按 16ms 判定", () => {
    expect(TRACK_SAMPLE_MS).toBe(16);
    expect(shouldSample(100, 84)).toBe(true);
    expect(shouldSample(100, 99)).toBe(false);
  });

  it("构建轨迹点与键盘标记", () => {
    const point = buildTrackPoint(1, 2, 3, "move");
    expect(point).toEqual({ x: 1, y: 2, t: 3, ev: "move" });
    expect(isKeyboardTrack([buildTrackPoint(1, 0, 0, "keyboard")])).toBe(true);
    expect(isKeyboardTrack([point])).toBe(false);
  });

  it("轨迹时长取首尾差", () => {
    expect(trackDuration([])).toBe(0);
    expect(
      trackDuration([buildTrackPoint(0, 0, 10), buildTrackPoint(1, 0, 90)])
    ).toBe(80);
  });
});
