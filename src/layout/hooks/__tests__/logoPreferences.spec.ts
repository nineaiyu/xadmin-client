import { describe, expect, it } from "vitest";

import {
  DEFAULT_FULL_LOGO_HEIGHT,
  FULL_LOGO_HEIGHT_RANGE,
  ICON_LOGO_HEIGHT,
  normalizeFullLogoHeight,
  resolveLogoImageStyle,
  resolveLogoMode,
  resolveLogoSrc,
  resolveLogoTextVisible
} from "../logoPreferences";

/**
 * Logo 展示派生测试：图标 / 整图两形态、暗色专用图、整图高度钳制。
 * 关键约定——整图形态下标题文字不再单独渲染（文字已在图片内）。
 */

describe("resolveLogoMode", () => {
  it("仅显式 full 走整图，其余（含缺省）回落 icon", () => {
    expect(resolveLogoMode({ logoMode: "full" })).toBe("full");
    expect(resolveLogoMode({ logoMode: "icon" })).toBe("icon");
    expect(resolveLogoMode({})).toBe("icon");
    expect(resolveLogoMode(undefined)).toBe("icon");
  });
});

describe("normalizeFullLogoHeight", () => {
  it("缺省 / 非法值回落基准高度，越界钳制", () => {
    expect(normalizeFullLogoHeight(undefined)).toBe(DEFAULT_FULL_LOGO_HEIGHT);
    expect(normalizeFullLogoHeight("")).toBe(DEFAULT_FULL_LOGO_HEIGHT);
    expect(normalizeFullLogoHeight("auto")).toBe(DEFAULT_FULL_LOGO_HEIGHT);
    expect(normalizeFullLogoHeight(FULL_LOGO_HEIGHT_RANGE.min - 40)).toBe(
      FULL_LOGO_HEIGHT_RANGE.min
    );
    expect(normalizeFullLogoHeight(FULL_LOGO_HEIGHT_RANGE.max + 40)).toBe(
      FULL_LOGO_HEIGHT_RANGE.max
    );
    expect(normalizeFullLogoHeight(41.6)).toBe(42);
  });
});

describe("resolveLogoSrc", () => {
  it("暗色外观且配置了暗色图时优先暗色图", () => {
    expect(
      resolveLogoSrc(
        { logoSource: "/a.svg", logoSourceDark: "/b.svg" },
        "/builtin.svg",
        true
      )
    ).toBe("/b.svg");
  });

  it("浅色外观 / 未配置暗色图时回落浅色图或内置资源", () => {
    expect(
      resolveLogoSrc(
        { logoSource: "/a.svg", logoSourceDark: "/b.svg" },
        "/builtin.svg",
        false
      )
    ).toBe("/a.svg");
    expect(resolveLogoSrc({}, "/builtin.svg", true)).toBe("/builtin.svg");
    expect(resolveLogoSrc({ logoSource: "  " }, "/builtin.svg", false)).toBe(
      "/builtin.svg"
    );
  });
});

describe("resolveLogoImageStyle", () => {
  it("整图形态按偏好定高，图标形态不写高度", () => {
    expect(
      resolveLogoImageStyle({ logoMode: "full", fullLogoHeight: 48 })
    ).toEqual({ objectFit: "contain", height: "48px" });
    expect(resolveLogoImageStyle({ logoMode: "icon" })).toEqual({
      objectFit: "contain"
    });
  });

  it("填充方式透传，缺省 contain", () => {
    expect(resolveLogoImageStyle({ logoFit: "cover" }).objectFit).toBe("cover");
  });
});

describe("resolveLogoTextVisible", () => {
  it("整图形态恒不渲染标题文字，图标形态跟随开关", () => {
    expect(
      resolveLogoTextVisible({ logoMode: "full", logoShowText: true })
    ).toBe(false);
    expect(
      resolveLogoTextVisible({ logoMode: "icon", logoShowText: false })
    ).toBe(false);
    expect(resolveLogoTextVisible({ logoMode: "icon" })).toBe(true);
  });
});

describe("ICON_LOGO_HEIGHT", () => {
  it("图标形态固定高度不参与偏好（与既有样式一致）", () => {
    expect(ICON_LOGO_HEIGHT).toBe(32);
  });
});
