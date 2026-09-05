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

import { useEpThemeStore } from "../epTheme";

describe("epTheme store", () => {
  beforeEach(() => {
    localStorage.clear();
    seedLayout();
    setActivePinia(createPinia());
  });

  it("无存储时主题色来自平台配置", () => {
    const store = useEpThemeStore();
    expect(store.epThemeColor).toBe("#409eff");
  });

  it("有存储时优先读取持久化主题色", () => {
    localStorage.setItem(
      "responsive-layout",
      JSON.stringify({ epThemeColor: "#123456", theme: "dark" })
    );
    setActivePinia(createPinia());
    const store = useEpThemeStore();
    expect(store.epThemeColor).toBe("#123456");
  });

  it("fill 依据 epTheme 返回导航图标颜色", () => {
    const store = useEpThemeStore();
    store.epTheme = "light";
    expect(store.fill).toBe("#409eff");
    store.epTheme = "dark";
    expect(store.fill).toBe("#fff");
  });

  it("setEpThemeColor 更新主题色并写回 storage", () => {
    const store = useEpThemeStore();
    store.epTheme = "light";
    store.setEpThemeColor("#00ff00");
    expect(store.epThemeColor).toBe("#00ff00");
  });
});
