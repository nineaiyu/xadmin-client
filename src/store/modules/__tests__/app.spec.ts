import { describe, expect, beforeEach, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { setConfig } from "@/config";

// 测试态没有 getPlatformConfig 注入，用 setConfig 预置平台配置
setConfig({
  Title: "xadmin",
  FixedHeader: false,
  HiddenSideBar: false,
  SidebarStatus: true,
  Layout: "vertical",
  Theme: "light",
  EpThemeColor: "#409eff",
  MaxTagsLevel: 20,
  ResponsiveStorageNameSpace: "responsive-"
} as never);

const seedLayout = (extra: Record<string, unknown> = {}) => {
  localStorage.setItem(
    "responsive-layout",
    JSON.stringify({
      sidebarStatus: true,
      epThemeColor: "#409eff",
      theme: "light",
      layout: "vertical",
      ...extra
    })
  );
};

import { useAppStore } from "../app";

describe("app store", () => {
  beforeEach(() => {
    localStorage.clear();
    seedLayout();
    setActivePinia(createPinia());
  });

  it("TOGGLE_SIDEBAR 打开/关闭并持久化 sidebarStatus", () => {
    const store = useAppStore();
    store.TOGGLE_SIDEBAR(true, "resize");
    expect(store.sidebar.opened).toBe(true);
    expect(store.sidebar.withoutAnimation).toBe(true);
    store.TOGGLE_SIDEBAR(false, "resize");
    expect(store.sidebar.opened).toBe(false);
  });

  it("TOGGLE_SIDEBAR 无 resize 时按折叠切换", () => {
    const store = useAppStore();
    store.sidebar.opened = true;
    store.TOGGLE_SIDEBAR();
    expect(store.sidebar.opened).toBe(false);
    store.sidebar.opened = false;
    store.TOGGLE_SIDEBAR();
    expect(store.sidebar.opened).toBe(true);
  });

  it("toggleDevice/setLayout/setViewportSize/setSortSwap", () => {
    const store = useAppStore();
    store.toggleDevice("mobile");
    expect(store.device).toBe("mobile");
    store.setLayout("vertical");
    expect(store.layout).toBe("vertical");
    store.setViewportSize({ width: 100, height: 200 });
    expect(store.viewportSize).toEqual({ width: 100, height: 200 });
    store.setSortSwap(true);
    expect(store.sortSwap).toBe(true);
  });
});
