import { describe, expect, it } from "vitest";

import {
  hasHeaderMenu,
  hasSidebar,
  headerModeToAutoHide,
  headerModeToFixed,
  isHeaderFullWidth,
  isSidebarSubmenu,
  isTwoColumnSidebar,
  normalizeLayoutMode,
  resolveHeaderMode,
  resolveLayoutMode,
  sidebarShowsSubmenu
} from "../layoutModes";

/**
 * 布局模式判定测试：这组纯函数替代原先按子串匹配的判定
 * （`layout.includes("mix")` 会把 `sidebar-mixed-nav` 误判；`header-sidebar-nav`
 * 两个分支都不命中）。每个模式的特征位必须与语义表逐项吻合。
 */

describe("normalizeLayoutMode", () => {
  it("已知模式原样返回，未知 / 空值回落 vertical", () => {
    expect(normalizeLayoutMode("mix")).toBe("mix");
    expect(normalizeLayoutMode("header-mixed-nav")).toBe("header-mixed-nav");
    expect(normalizeLayoutMode("nope")).toBe("vertical");
    expect(normalizeLayoutMode(undefined)).toBe("vertical");
    expect(normalizeLayoutMode(null)).toBe("vertical");
  });
});

describe("布局模式特征位", () => {
  it("vertical：有侧栏、无顶栏菜单、非通栏、单列、非子菜单", () => {
    expect(hasSidebar("vertical")).toBe(true);
    expect(hasHeaderMenu("vertical")).toBe(false);
    expect(isHeaderFullWidth("vertical")).toBe(false);
    expect(isTwoColumnSidebar("vertical")).toBe(false);
    expect(isSidebarSubmenu("vertical")).toBe(false);
  });

  it("horizontal：无侧栏、顶栏通栏", () => {
    expect(hasSidebar("horizontal")).toBe(false);
    expect(isHeaderFullWidth("horizontal")).toBe(true);
    expect(isTwoColumnSidebar("horizontal")).toBe(false);
  });

  it("mix：顶栏菜单在侧栏右侧、单列、侧栏显示子菜单", () => {
    expect(hasSidebar("mix")).toBe(true);
    expect(hasHeaderMenu("mix")).toBe(true);
    expect(isHeaderFullWidth("mix")).toBe(false);
    expect(isTwoColumnSidebar("mix")).toBe(false);
    expect(isSidebarSubmenu("mix")).toBe(true);
  });

  it("sidebar-mixed-nav：双列侧栏、无顶栏菜单、非通栏", () => {
    expect(hasSidebar("sidebar-mixed-nav")).toBe(true);
    expect(hasHeaderMenu("sidebar-mixed-nav")).toBe(false);
    expect(isHeaderFullWidth("sidebar-mixed-nav")).toBe(false);
    expect(isTwoColumnSidebar("sidebar-mixed-nav")).toBe(true);
    expect(isSidebarSubmenu("sidebar-mixed-nav")).toBe(true);
  });

  it("header-sidebar-nav：顶栏通栏 + 顶栏菜单 + 单列侧栏子菜单", () => {
    expect(hasSidebar("header-sidebar-nav")).toBe(true);
    expect(hasHeaderMenu("header-sidebar-nav")).toBe(true);
    expect(isHeaderFullWidth("header-sidebar-nav")).toBe(true);
    expect(isTwoColumnSidebar("header-sidebar-nav")).toBe(false);
    expect(isSidebarSubmenu("header-sidebar-nav")).toBe(true);
  });

  it("header-mixed-nav：顶栏通栏 + 顶栏菜单 + 双列侧栏", () => {
    expect(hasSidebar("header-mixed-nav")).toBe(true);
    expect(hasHeaderMenu("header-mixed-nav")).toBe(true);
    expect(isHeaderFullWidth("header-mixed-nav")).toBe(true);
    expect(isTwoColumnSidebar("header-mixed-nav")).toBe(true);
  });

  it("双列模式不会被误判为 mix（子串判定的事故点）", () => {
    // `sidebar-mixed-nav`.includes("mix") 为 false，但历史上用 includes 判定过混布；
    // 这里显式固化「双列 ≠ mix 顶栏菜单」的语义
    expect(hasHeaderMenu("sidebar-mixed-nav")).toBe(false);
    expect(hasHeaderMenu("header-sidebar-nav")).toBe(true);
  });
});

describe("resolveLayoutMode（移动端回落）", () => {
  it("移动端一律回落竖排，桌面端保留原模式", () => {
    expect(resolveLayoutMode("mix", true)).toBe("vertical");
    expect(resolveLayoutMode("header-mixed-nav", true)).toBe("vertical");
    expect(resolveLayoutMode("header-mixed-nav", false)).toBe(
      "header-mixed-nav"
    );
  });
});

describe("sidebarShowsSubmenu（含导航切割开关）", () => {
  it("竖排 / 水平永不显示子菜单", () => {
    expect(sidebarShowsSubmenu("vertical", true)).toBe(false);
    expect(sidebarShowsSubmenu("vertical", false)).toBe(false);
    expect(sidebarShowsSubmenu("horizontal", true)).toBe(false);
  });

  it("双列布局恒为子菜单（一级导航在窄列）", () => {
    expect(sidebarShowsSubmenu("sidebar-mixed-nav", false)).toBe(true);
    expect(sidebarShowsSubmenu("header-mixed-nav", false)).toBe(true);
  });

  it("mix / header-sidebar-nav 由导航切割开关决定", () => {
    expect(sidebarShowsSubmenu("mix", true)).toBe(true);
    expect(sidebarShowsSubmenu("mix", false)).toBe(false);
    expect(sidebarShowsSubmenu("mix", undefined)).toBe(false);
    expect(sidebarShowsSubmenu("header-sidebar-nav", true)).toBe(true);
    expect(sidebarShowsSubmenu("header-sidebar-nav", false)).toBe(false);
  });
});

describe("顶栏模式四态派生", () => {
  it("headerModeToFixed：仅 static 为非固定", () => {
    expect(headerModeToFixed("static")).toBe(false);
    expect(headerModeToFixed("fixed")).toBe(true);
    expect(headerModeToFixed("auto")).toBe(true);
    expect(headerModeToFixed("auto-scroll")).toBe(true);
  });

  it("headerModeToAutoHide：auto / auto-scroll 开启", () => {
    expect(headerModeToAutoHide("fixed")).toBe(false);
    expect(headerModeToAutoHide("static")).toBe(false);
    expect(headerModeToAutoHide("auto")).toBe(true);
    expect(headerModeToAutoHide("auto-scroll")).toBe(true);
  });

  it("resolveHeaderMode：偏好为空时由历史布尔键推导，保证存量行为不回退", () => {
    expect(resolveHeaderMode("", true, false)).toBe("fixed");
    expect(resolveHeaderMode(undefined, false, false)).toBe("static");
    expect(resolveHeaderMode(undefined, true, true)).toBe("auto");
    // 显式四态优先于历史键
    expect(resolveHeaderMode("static", true, true)).toBe("static");
    expect(resolveHeaderMode("auto-scroll", false, false)).toBe("auto-scroll");
  });
});
