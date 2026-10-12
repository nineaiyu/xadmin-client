import { describe, expect, it } from "vitest";

import {
  hasHeaderMenu,
  hasNavbarLogo,
  hasNavbarMenu,
  hasSidebar,
  headerModeToAutoHide,
  headerModeToFixed,
  isFullContent,
  isHeaderFullWidth,
  isHeaderMixedNav,
  isHeaderNav,
  isHeaderSidebarNav,
  isMixedNav,
  isSideMode,
  isSidebarMixedNav,
  isTwoColumnSidebar,
  normalizeLayoutMode,
  resolveHeaderMode,
  resolveLayoutMode,
  sidebarShowsSubmenu
} from "../layoutModes";

/**
 * 布局模式判定测试：这组纯函数替代原先按子串匹配的判定
 * （`layout.includes("mix")` 会把 `sidebar-mixed-nav` 误判；`header-sidebar-nav`
 * 两个分支都不命中）。7 种模式与 vben 布局矩阵一一对应，特征位须逐项吻合。
 */

describe("normalizeLayoutMode", () => {
  it("已知模式原样返回，未知 / 空值回落 vertical", () => {
    expect(normalizeLayoutMode("mix")).toBe("mix");
    expect(normalizeLayoutMode("header-mixed-nav")).toBe("header-mixed-nav");
    expect(normalizeLayoutMode("full-content")).toBe("full-content");
    expect(normalizeLayoutMode("nope")).toBe("vertical");
    expect(normalizeLayoutMode(undefined)).toBe("vertical");
    expect(normalizeLayoutMode(null)).toBe("vertical");
  });
});

describe("布局模式特征位", () => {
  it("vertical（vben sidebar-nav）：有侧栏、无顶栏菜单、非通栏、单列、非子菜单", () => {
    expect(hasSidebar("vertical")).toBe(true);
    expect(isSideMode("vertical")).toBe(true);
    expect(hasHeaderMenu("vertical")).toBe(false);
    expect(hasNavbarMenu("vertical")).toBe(false);
    expect(hasNavbarLogo("vertical")).toBe(false);
    expect(isHeaderFullWidth("vertical")).toBe(false);
    expect(isTwoColumnSidebar("vertical")).toBe(false);
  });

  it("horizontal（vben header-nav）：无侧栏、顶栏通栏、承载完整菜单", () => {
    expect(hasSidebar("horizontal")).toBe(false);
    expect(isSideMode("horizontal")).toBe(false);
    expect(isHeaderNav("horizontal")).toBe(true);
    expect(hasHeaderMenu("horizontal")).toBe(true);
    // 完整菜单由通栏顶栏组件渲染，顶栏容器内部不再内嵌菜单条
    expect(hasNavbarMenu("horizontal")).toBe(false);
    expect(isHeaderFullWidth("horizontal")).toBe(true);
    expect(isTwoColumnSidebar("horizontal")).toBe(false);
  });

  it("mix（vben mixed-nav）：顶栏通栏 + 顶栏菜单 + 侧栏排在顶栏下方", () => {
    expect(hasSidebar("mix")).toBe(true);
    expect(isMixedNav("mix")).toBe(true);
    expect(hasHeaderMenu("mix")).toBe(true);
    expect(hasNavbarMenu("mix")).toBe(true);
    expect(hasNavbarLogo("mix")).toBe(true);
    expect(isHeaderFullWidth("mix")).toBe(true);
    expect(isTwoColumnSidebar("mix")).toBe(false);
  });

  it("sidebar-mixed-nav（vben sidebar-mixed-nav）：双列侧栏、无顶栏菜单、非通栏", () => {
    expect(hasSidebar("sidebar-mixed-nav")).toBe(true);
    expect(isSidebarMixedNav("sidebar-mixed-nav")).toBe(true);
    expect(hasHeaderMenu("sidebar-mixed-nav")).toBe(false);
    expect(hasNavbarLogo("sidebar-mixed-nav")).toBe(false);
    expect(isHeaderFullWidth("sidebar-mixed-nav")).toBe(false);
    expect(isTwoColumnSidebar("sidebar-mixed-nav")).toBe(true);
  });

  it("header-sidebar-nav（vben header-sidebar-nav）：顶栏通栏（无菜单）+ 侧栏排在顶栏下方", () => {
    expect(hasSidebar("header-sidebar-nav")).toBe(true);
    expect(isHeaderSidebarNav("header-sidebar-nav")).toBe(true);
    expect(hasHeaderMenu("header-sidebar-nav")).toBe(false);
    expect(hasNavbarMenu("header-sidebar-nav")).toBe(false);
    expect(hasNavbarLogo("header-sidebar-nav")).toBe(true);
    expect(isHeaderFullWidth("header-sidebar-nav")).toBe(true);
    expect(isTwoColumnSidebar("header-sidebar-nav")).toBe(false);
  });

  it("header-mixed-nav（vben header-mixed-nav）：双列侧栏 + 顶栏在侧栏右侧（承载一级菜单）", () => {
    expect(hasSidebar("header-mixed-nav")).toBe(true);
    expect(isHeaderMixedNav("header-mixed-nav")).toBe(true);
    expect(hasHeaderMenu("header-mixed-nav")).toBe(true);
    expect(hasNavbarMenu("header-mixed-nav")).toBe(true);
    expect(hasNavbarLogo("header-mixed-nav")).toBe(false);
    expect(isHeaderFullWidth("header-mixed-nav")).toBe(false);
    expect(isTwoColumnSidebar("header-mixed-nav")).toBe(true);
  });

  it("full-content（vben full-content）：无侧栏、无顶栏菜单、无外壳", () => {
    expect(hasSidebar("full-content")).toBe(false);
    expect(isSideMode("full-content")).toBe(false);
    expect(isFullContent("full-content")).toBe(true);
    expect(hasHeaderMenu("full-content")).toBe(false);
    expect(hasNavbarMenu("full-content")).toBe(false);
    expect(hasNavbarLogo("full-content")).toBe(false);
    expect(isTwoColumnSidebar("full-content")).toBe(false);
  });

  it("双列模式不会被误判为 mix（子串判定的事故点）", () => {
    // `sidebar-mixed-nav` 含 "mixed"（子串 "mix"），须固化「双列 ≠ 顶栏菜单」的语义
    expect(hasNavbarMenu("sidebar-mixed-nav")).toBe(false);
    expect(hasNavbarMenu("header-mixed-nav")).toBe(true);
  });
});

describe("resolveLayoutMode（移动端回落）", () => {
  it("移动端一律回落竖排，桌面端保留原模式", () => {
    expect(resolveLayoutMode("mix", true)).toBe("vertical");
    expect(resolveLayoutMode("header-mixed-nav", true)).toBe("vertical");
    expect(resolveLayoutMode("full-content", true)).toBe("vertical");
    expect(resolveLayoutMode("full-content", false)).toBe("full-content");
  });
});

describe("sidebarShowsSubmenu（含导航切割开关）", () => {
  it("竖排 / 水平 / 全屏内容永不显示子菜单", () => {
    expect(sidebarShowsSubmenu("vertical", true)).toBe(false);
    expect(sidebarShowsSubmenu("vertical", false)).toBe(false);
    expect(sidebarShowsSubmenu("horizontal", true)).toBe(false);
    expect(sidebarShowsSubmenu("full-content", true)).toBe(false);
  });

  it("双列布局恒为子菜单（一级导航在窄列 / 顶栏）", () => {
    expect(sidebarShowsSubmenu("sidebar-mixed-nav", false)).toBe(true);
    expect(sidebarShowsSubmenu("header-mixed-nav", false)).toBe(true);
  });

  it("mix 由导航切割开关决定（对齐 vben navigation.split）", () => {
    expect(sidebarShowsSubmenu("mix", true)).toBe(true);
    expect(sidebarShowsSubmenu("mix", false)).toBe(false);
    expect(sidebarShowsSubmenu("mix", undefined)).toBe(false);
  });

  it("header-sidebar-nav 恒为完整菜单树（一级导航在侧栏）", () => {
    expect(sidebarShowsSubmenu("header-sidebar-nav", true)).toBe(false);
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
