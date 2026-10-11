import { describe, expect, it } from "vitest";
import {
  PANE_ROTATE_MAX,
  PANE_ROTATE_MIN,
  clampRotate,
  hasPaneAnimation,
  paneAnimationClass,
  paneAnimationOptions
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
