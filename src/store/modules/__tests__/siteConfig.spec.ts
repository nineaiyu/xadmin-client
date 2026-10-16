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

import { useSiteConfigStore } from "../siteConfig";

describe("siteConfig store", () => {
  beforeEach(() => {
    localStorage.clear();
    seedLayout();
    setActivePinia(createPinia());
  });

  it("setSiteConfig 按命名空间写入本地存储", () => {
    const store = useSiteConfigStore();
    store.setSiteConfig({
      Title: "测试站点",
      FixedHeader: true,
      HiddenSideBar: false
    } as never);
    expect(localStorage.getItem(`${store.nameSpace}Title`)).toBe("测试站点");
    expect(localStorage.getItem(`${store.nameSpace}FixedHeader`)).toBe("true");
  });

  it("nameSpace 与响应式存储命名空间一致", () => {
    const store = useSiteConfigStore();
    expect(store.nameSpace).toContain("responsive-");
  });
});
