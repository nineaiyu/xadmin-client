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

import { useMultiTagsStore } from "../multiTags";

const tagOf = (path: string, title: string) => ({
  path,
  name: path,
  meta: { title }
});

describe("multiTags store", () => {
  beforeEach(() => {
    localStorage.clear();
    seedLayout();
    setActivePinia(createPinia());
  });

  it("equal 重置标签页集合", () => {
    const store = useMultiTagsStore();
    store.handleTags("equal", [tagOf("/a", "A"), tagOf("/b", "B")]);
    expect(store.multiTags.map(t => t.path)).toEqual(["/a", "/b"]);
  });

  it("push 去重与拒绝规则", () => {
    const store = useMultiTagsStore();
    store.handleTags("equal", []);
    store.handleTags("push", tagOf("/a", "A"));
    store.handleTags("push", tagOf("/a", "A"));
    expect(store.multiTags).toHaveLength(1);
    // 空标题拒绝
    store.handleTags("push", { path: "/e", meta: { title: "" } } as never);
    expect(store.multiTags.map(t => t.path)).not.toContain("/e");
  });

  it("splice 按路径与按位置删除", () => {
    const store = useMultiTagsStore();
    store.handleTags("equal", [tagOf("/a", "A"), tagOf("/b", "B")]);
    store.handleTags("splice", "/a");
    expect(store.multiTags.map(t => t.path)).toEqual(["/b"]);
    store.handleTags("splice", "", { startIndex: 0, length: 1 });
    expect(store.multiTags).toHaveLength(0);
  });

  it("slice 返回最后一个标签", () => {
    const store = useMultiTagsStore();
    store.handleTags("equal", [tagOf("/a", "A"), tagOf("/b", "B")]);
    expect(store.handleTags("slice")).toEqual([tagOf("/b", "B")]);
  });

  it("multiTagsCacheChange 切换持久化开关", () => {
    const store = useMultiTagsStore();
    store.multiTagsCacheChange(true);
    expect(store.multiTagsCache).toBe(true);
    store.multiTagsCacheChange(false);
    expect(store.multiTagsCache).toBe(false);
    expect(localStorage.getItem("xadmin-tags")).toBeNull();
  });
});
