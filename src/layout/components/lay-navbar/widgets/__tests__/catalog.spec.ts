import { describe, expect, it } from "vitest";

import {
  DEFAULT_NAVBAR_ORDER,
  NAVBAR_MORE_KEYS,
  findNavbarWidget,
  resolveNavbarLayout
} from "../catalog";

/**
 * 顶栏组件编排纯函数：顺序（navbarOrder）/ 位置（navbarMoreWidgets）/ 显隐（既有开关）
 * 三者的组合口径——面板拖拽与「更多」下拉都只写偏好，渲染结果完全由本函数决定。
 */
describe("resolveNavbarLayout：顶栏组件编排", () => {
  it("默认配置：全部可见组件按内置顺序排在顶栏，无「更多」分组", () => {
    const layout = resolveNavbarLayout(undefined);
    expect(layout.more).toEqual([]);
    expect(layout.header.map(entry => entry.item.key)).toEqual(
      DEFAULT_NAVBAR_ORDER.filter(key => findNavbarWidget(key)?.defaultVisible)
    );
    // 序号与渲染序一致（flex order 直接用该值）
    layout.header.forEach((entry, index) => expect(entry.order).toBe(index));
  });

  it("navbarOrder 决定顺序，未知键忽略、未登记的组件按内置顺序补在末尾", () => {
    const layout = resolveNavbarLayout({
      navbarOrder: ["notice", "unknown-key", "refresh"],
      navbarNotice: true,
      navbarRefresh: true
    });
    const keys = layout.header.map(entry => entry.item.key);
    expect(keys.slice(0, 2)).toEqual(["notice", "refresh"]);
    expect(keys).not.toContain("unknown-key");
    expect(keys).toHaveLength(
      DEFAULT_NAVBAR_ORDER.filter(key => findNavbarWidget(key)?.defaultVisible)
        .length
    );
  });

  it("navbarMoreWidgets 只收动作类组件（more 能力），弹层类组件保持顶栏", () => {
    const layout = resolveNavbarLayout({
      navbarMoreWidgets: ["refresh", "search", "lock", "sidebarToggle"],
      navbarRefresh: true,
      navbarSearch: true,
      navbarLock: true,
      navbarSidebarToggle: true
    });
    const moreKeys = layout.more.map(entry => entry.item.key);
    // search 不支持收进下拉（请求里带它也不会被收走）；「更多」组内顺序跟随顶栏顺序
    expect(moreKeys).toEqual(["sidebarToggle", "refresh", "lock"]);
    expect(moreKeys.every(key => NAVBAR_MORE_KEYS.includes(key))).toBe(true);
    expect(layout.header.map(entry => entry.item.key)).toContain("search");
  });

  it("显隐开关优先于顺序与位置：关闭的组件不进任何一组", () => {
    const layout = resolveNavbarLayout({
      navbarOrder: ["lock", "refresh"],
      navbarMoreWidgets: ["lock"],
      navbarLock: false,
      navbarRefresh: true
    });
    expect(layout.more).toEqual([]);
    expect(layout.header.map(entry => entry.item.key)).not.toContain("lock");
    expect(layout.header.map(entry => entry.item.key)).toContain("refresh");
  });

  it("默认关闭的组件（折叠 / 明暗切换 / 时区）需显式开启才出现", () => {
    const off = resolveNavbarLayout({});
    const on = resolveNavbarLayout({
      navbarSidebarToggle: true,
      navbarThemeToggle: true,
      navbarTimezone: true
    });
    expect(off.header.map(entry => entry.item.key)).not.toContain(
      "sidebarToggle"
    );
    const keys = on.header.map(entry => entry.item.key);
    expect(keys).toContain("sidebarToggle");
    expect(keys).toContain("themeToggle");
    expect(keys).toContain("timezone");
  });

  it("widgetPositions 决定落位：头像下拉 / 不显示；未登记时回落历史键", () => {
    const layout = resolveNavbarLayout({
      widgetPositions: {
        lock: "user-dropdown",
        themeToggle: "header",
        refresh: "none"
      },
      navbarLock: true,
      navbarRefresh: true,
      navbarThemeToggle: true,
      navbarMoreWidgets: ["lock", "refresh"]
    });
    expect(layout.userDropdown.map(entry => entry.item.key)).toEqual(["lock"]);
    expect(layout.header.map(entry => entry.item.key)).toContain("themeToggle");
    expect(layout.header.map(entry => entry.item.key)).not.toContain("refresh");
    expect(layout.more).toEqual([]);
  });

  it("显式落位优先于历史显隐键（关闭的组件也能被登记为落位）", () => {
    const layout = resolveNavbarLayout({
      navbarThemeToggle: false,
      widgetPositions: { themeToggle: "user-dropdown" }
    });
    expect(layout.userDropdown.map(entry => entry.item.key)).toEqual([
      "themeToggle"
    ]);
  });

  it("弹层类组件（more=false）登记为 more 时按顶栏处理", () => {
    const layout = resolveNavbarLayout({
      widgetPositions: { search: "more" },
      navbarSearch: true
    });
    // 弹层类组件在下拉里无法展开弹层：即使偏好被写成 more，也按 header 兜底
    expect(layout.more).toEqual([]);
    expect(layout.header.map(entry => entry.item.key)).toContain("search");
  });
});
