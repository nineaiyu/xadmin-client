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

  it("页签最大数量：超出后自动关闭最早打开的可关闭页签", () => {
    localStorage.setItem(
      "responsive-configure",
      JSON.stringify({ maxTagsCount: 3 })
    );
    const store = useMultiTagsStore();
    store.handleTags("equal", [tagOf("/home", "首页")]);
    ["/a", "/b", "/c", "/d"].forEach(path =>
      store.handleTags("push", tagOf(path, path))
    );
    // 上限含首页固定页签：每次超限移除当前最早打开的一项（首页与固定页签不参与）
    expect(store.multiTags.map(t => t.path)).toEqual(["/home", "/c", "/d"]);
  });

  it("页签最大数量：右键固定的页签不被自动关闭", () => {
    localStorage.setItem(
      "responsive-configure",
      JSON.stringify({ maxTagsCount: 3 })
    );
    const store = useMultiTagsStore();
    store.handleTags("equal", [tagOf("/home", "首页")]);
    store.handleTags("push", tagOf("/a", "A"));
    store.togglePinnedTag("/a");
    ["/b", "/c", "/d"].forEach(path =>
      store.handleTags("push", tagOf(path, path))
    );
    // 固定页签占用名额但不参与关闭：超限时先淘汰 /b，再淘汰 /c
    expect(store.multiTags.map(t => t.path)).toEqual(["/home", "/a", "/d"]);
  });

  it("页签最大数量为 0 时不限制", () => {
    localStorage.setItem(
      "responsive-configure",
      JSON.stringify({ maxTagsCount: 0 })
    );
    const store = useMultiTagsStore();
    store.handleTags("equal", [tagOf("/home", "首页")]);
    // 平台配置 MaxTagsLevel = 20：0 优先于平台级上限，仍按不限制处理到 20 以内
    for (let i = 0; i < 10; i++) {
      store.handleTags("push", tagOf(`/p${i}`, `P${i}`));
    }
    expect(store.multiTags).toHaveLength(11);
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
