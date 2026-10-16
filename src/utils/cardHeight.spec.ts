import { describe, expect, it } from "vitest";
import {
  CARD_HEIGHT_OPTIONS,
  DEFAULT_CARD_HEIGHT,
  cardRenderHeight
} from "./cardHeight";

describe("cardHeight", () => {
  it("缺省高度与存量渲染档位一致（224 = h-56）", () => {
    expect(DEFAULT_CARD_HEIGHT).toBe(224);
  });

  it("未配置高度回退缺省值，已配置原样返回", () => {
    expect(cardRenderHeight()).toBe(DEFAULT_CARD_HEIGHT);
    expect(cardRenderHeight(undefined)).toBe(DEFAULT_CARD_HEIGHT);
    expect(cardRenderHeight(320)).toBe(320);
  });

  it("表单档位为升序四档且包含缺省值", () => {
    expect([...CARD_HEIGHT_OPTIONS]).toEqual([160, 224, 320, 440]);
    expect(CARD_HEIGHT_OPTIONS).toContain(DEFAULT_CARD_HEIGHT);
  });
});
