import { describe, expect, it } from "vitest";
import { isKioskMeta } from "../kiosk";

/**
 * 展板态判定（大屏投屏等全屏展示页）：站点级通知浮层是否弹的唯一开关。
 */
describe("isKioskMeta", () => {
  it("meta.kiosk === true 判定为展板态", () => {
    expect(isKioskMeta({ kiosk: true })).toBe(true);
  });

  it("未标记 / 显式 false / 空 meta 都不是展板态", () => {
    expect(isKioskMeta({})).toBe(false);
    expect(isKioskMeta({ kiosk: false })).toBe(false);
    expect(isKioskMeta(null)).toBe(false);
    expect(isKioskMeta(undefined)).toBe(false);
  });
});
