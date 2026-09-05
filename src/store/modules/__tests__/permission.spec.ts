import { describe, expect, beforeEach, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { usePermissionStore } from "../permission";
import { useMultiTagsStoreHook } from "../multiTags";

describe("permission store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("handleWholeAuths 重建全局授权表", () => {
    const store = usePermissionStore();
    store.handleWholeAuths(["list:SystemRole", "create:SystemNotice"]);
    expect(store.permissionAuths).toEqual({
      "list:SystemRole": true,
      "create:SystemNotice": true
    });
  });

  it("cacheOperate 增删与 refresh 联动 clearCache", () => {
    const store = usePermissionStore();
    const multiTags = useMultiTagsStoreHook();
    // 无标签页时 add 后 refresh 会因 clearCache 清掉不在标签页中的缓存
    store.cacheOperate({ mode: "add", name: "UserInfo" });
    expect(store.cachePageList).toContain("UserInfo");
    store.cacheOperate({ mode: "delete", name: "UserInfo" });
    expect(store.cachePageList).not.toContain("UserInfo");
    multiTags.handleTags("equal", []);
  });

  it("clearCache 保留仍存在于标签页的缓存", () => {
    const store = usePermissionStore();
    const multiTags = useMultiTagsStoreHook();
    multiTags.handleTags("push", {
      path: "/system/user",
      name: "SystemUser",
      meta: { title: "用户管理" }
    } as never);
    store.cachePageList.push("SystemUser", "OrphanPage");
    store.clearCache();
    expect(store.cachePageList).toContain("SystemUser");
    expect(store.cachePageList).not.toContain("OrphanPage");
    multiTags.handleTags("equal", []);
  });

  it("clearAllCachePage 清空菜单与缓存", () => {
    const store = usePermissionStore();
    store.cachePageList.push("A");
    store.clearAllCachePage();
    expect(store.cachePageList).toEqual([]);
    expect(store.wholeMenus).toEqual([]);
    expect(store.flatteningRoutes).toEqual([]);
  });

  it("handleWholeMenus 组装整体菜单与扁平路由", () => {
    const store = usePermissionStore();
    store.handleWholeMenus([]);
    expect(Array.isArray(store.wholeMenus)).toBe(true);
    expect(Array.isArray(store.flatteningRoutes)).toBe(true);
  });
});
