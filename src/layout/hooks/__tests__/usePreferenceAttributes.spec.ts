import { describe, expect, it, beforeEach } from "vitest";

import {
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_RANGE,
  applyPreferenceAttributes,
  normalizeSidebarWidth
} from "../usePreferenceAttributes";

/**
 * 偏好 → `<html>` 落点测试：
 * 档位属性（data-radius / data-font）与侧栏宽度变量（--sidebar-width）都必须
 * 「默认档撤除、非默认档写入」，否则未改动状态会与历史取值产生偏移。
 */

const root = () => document.documentElement;

describe("normalizeSidebarWidth", () => {
  beforeEach(() => {
    root().removeAttribute("data-radius");
    root().removeAttribute("data-font");
    root().style.removeProperty("--sidebar-width");
  });

  it("缺省 / 非数值回落到基准宽度", () => {
    expect(normalizeSidebarWidth(undefined)).toBe(DEFAULT_SIDEBAR_WIDTH);
    expect(normalizeSidebarWidth(null)).toBe(DEFAULT_SIDEBAR_WIDTH);
    expect(normalizeSidebarWidth("auto")).toBe(DEFAULT_SIDEBAR_WIDTH);
  });

  it("越界值按区间钳制、小数取整", () => {
    expect(normalizeSidebarWidth(SIDEBAR_WIDTH_RANGE.min - 60)).toBe(
      SIDEBAR_WIDTH_RANGE.min
    );
    expect(normalizeSidebarWidth(SIDEBAR_WIDTH_RANGE.max + 60)).toBe(
      SIDEBAR_WIDTH_RANGE.max
    );
    expect(normalizeSidebarWidth(241.6)).toBe(242);
  });
});

describe("applyPreferenceAttributes", () => {
  beforeEach(() => {
    root().removeAttribute("data-radius");
    root().removeAttribute("data-font");
    root().style.removeProperty("--sidebar-width");
  });

  it("默认档不写属性与变量", () => {
    applyPreferenceAttributes({
      radius: "default",
      fontScale: "default",
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH
    });
    expect(root().hasAttribute("data-radius")).toBe(false);
    expect(root().hasAttribute("data-font")).toBe(false);
    expect(root().style.getPropertyValue("--sidebar-width")).toBe("");
  });

  it("非默认档写入属性与 CSS 变量", () => {
    applyPreferenceAttributes({
      radius: "large",
      fontScale: "small",
      sidebarWidth: 260
    });
    expect(root().getAttribute("data-radius")).toBe("large");
    expect(root().getAttribute("data-font")).toBe("small");
    expect(root().style.getPropertyValue("--sidebar-width")).toBe("260px");
  });

  it("越界宽度按区间收敛后再落变量", () => {
    applyPreferenceAttributes({ sidebarWidth: 999 });
    expect(root().style.getPropertyValue("--sidebar-width")).toBe(
      `${SIDEBAR_WIDTH_RANGE.max}px`
    );
  });

  it("配置缺省（undefined）时撤除全部落点", () => {
    applyPreferenceAttributes({ radius: "xlarge", sidebarWidth: 300 });
    applyPreferenceAttributes(undefined);
    expect(root().hasAttribute("data-radius")).toBe(false);
    expect(root().style.getPropertyValue("--sidebar-width")).toBe("");
  });

  it("半暗侧栏 / 半暗顶栏按开关写入与撤除全局类", () => {
    applyPreferenceAttributes({ semiDarkSidebar: true, semiDarkHeader: true });
    expect(root().classList.contains("semi-dark-sidebar")).toBe(true);
    expect(root().classList.contains("semi-dark-header")).toBe(true);

    applyPreferenceAttributes({ semiDarkSidebar: false });
    expect(root().classList.contains("semi-dark-sidebar")).toBe(false);
    expect(root().classList.contains("semi-dark-header")).toBe(false);
  });
});
