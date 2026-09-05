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

import { useSettingStore } from "../settings";

describe("setting store", () => {
  beforeEach(() => {
    localStorage.clear();
    seedLayout();
    setActivePinia(createPinia());
  });

  it("CHANGE_SETTING 仅接受已存在的键", () => {
    const store = useSettingStore();
    store.CHANGE_SETTING({ key: "title", value: "新标题" });
    expect(store.title).toBe("新标题");

    store.CHANGE_SETTING({ key: "notExistKey", value: "x" });
    expect(
      (store as unknown as Record<string, unknown>).notExistKey
    ).toBeUndefined();
  });

  it("changeSetting 透传到 CHANGE_SETTING", () => {
    const store = useSettingStore();
    const fixed = !store.fixedHeader;
    store.changeSetting({ key: "fixedHeader", value: fixed });
    expect(store.fixedHeader).toBe(fixed);
  });
});
