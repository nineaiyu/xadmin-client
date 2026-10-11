import { describe, expect, it } from "vitest";
import {
  PANE_ROTATE_MAX,
  PANE_ROTATE_MIN,
  clampAnimationMs,
  clampRotate,
  hasPaneAnimation,
  paneAnimationClass,
  paneAnimationOptions,
  paneAnimationStyle
} from "../paneEffects";

describe("clampRotate", () => {
  it("缺省与非法值按 0（不旋转）", () => {
    expect(clampRotate()).toBe(0);
    expect(clampRotate(Number.NaN)).toBe(0);
    expect(clampRotate(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("取整并夹到 -180~180", () => {
    expect(clampRotate(45.4)).toBe(45);
    expect(clampRotate(-45.6)).toBe(-46);
    expect(clampRotate(999)).toBe(PANE_ROTATE_MAX);
    expect(clampRotate(-999)).toBe(PANE_ROTATE_MIN);
  });
});

describe("paneAnimationClass", () => {
  it("none / 缺省 / 未知值都不给类名", () => {
    expect(paneAnimationClass()).toBe("");
    expect(paneAnimationClass("none")).toBe("");
    expect(paneAnimationClass("flash")).toBe("");
  });

  it("白名单内的取值映射为类名", () => {
    expect(paneAnimationClass("fade")).toBe("pane-animation--fade");
    expect(paneAnimationClass("slide-up")).toBe("pane-animation--slide-up");
    expect(paneAnimationClass("zoom-in")).toBe("pane-animation--zoom-in");
  });

  it("hasPaneAnimation 与类名同口径", () => {
    expect(hasPaneAnimation({})).toBe(false);
    expect(hasPaneAnimation({ animation: "none" })).toBe(false);
    expect(hasPaneAnimation({ animation: "fade" })).toBe(true);
  });
});

describe("paneAnimationOptions", () => {
  it("下拉选项覆盖全部取值且 i18n key 可拼（slide-up → slideUp）", () => {
    const options = paneAnimationOptions();
    expect(options.map(item => item.value)).toEqual([
      "none",
      "fade",
      "slide-up",
      "slide-down",
      "slide-left",
      "slide-right",
      "zoom-in"
    ]);
    expect(options[0].label).toBe("dataScreen.animationNone");
    expect(options[2].label).toBe("dataScreen.animationSlideUp");
    expect(options[6].label).toBe("dataScreen.animationZoomIn");
  });
});

describe("clampAnimationMs 与 paneAnimationStyle", () => {
  it("毫秒夹取：非法值回落缺省，越界落到 0~5000", () => {
    expect(clampAnimationMs(Number.NaN, 320)).toBe(320);
    expect(clampAnimationMs(undefined, 320)).toBe(320);
    expect(clampAnimationMs(800.4, 320)).toBe(800);
    expect(clampAnimationMs(-100, 320)).toBe(0);
    expect(clampAnimationMs(99999, 320)).toBe(5000);
  });

  it("未配动画不给时序样式（编辑态载荷原样）", () => {
    expect(paneAnimationStyle({ animation: "none" })).toEqual({});
    expect(paneAnimationStyle({})).toEqual({});
  });

  it("缺省时序不写内联样式，非缺省才写", () => {
    expect(paneAnimationStyle({ animation: "fade" })).toEqual({});
    expect(
      paneAnimationStyle({ animation: "fade", animation_duration: 320 })
    ).toEqual({});
    expect(
      paneAnimationStyle({
        animation: "fade",
        animation_duration: 800,
        animation_delay: 200,
        animation_loop: true
      })
    ).toEqual({
      animationDuration: "800ms",
      animationDelay: "200ms",
      animationIterationCount: "infinite"
    });
  });
});
