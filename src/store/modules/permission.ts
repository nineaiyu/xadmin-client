import { defineStore } from "pinia";
import type { menuType } from "@/layout/types";
import {
  ascending,
  filterNoPermissionTree,
  filterTree,
  formatFlatteningRoutes,
  toMenuTree
} from "@/router/utils/route-tree";
import { constantMenus } from "@/router/constants";
import { getKeyList } from "@pureadmin/utils";
import { store } from "@/store";
import type { cacheType } from "../types";
import type { RouteRecordRaw } from "vue-router";
import { useMultiTagsStoreHook } from "./multiTags";
import { useUserStoreHook } from "./user";

export const usePermissionStore = defineStore("pure-permission", {
  state: () => ({
    // 静态路由生成的菜单
    constantMenus,
    // 整体路由生成的菜单（静态、动态）
    wholeMenus: [] as menuType[],
    // 菜单装配是否已结束（区分「装配中」与「装配完但为空」——零权限账号的空态依据）
    menusLoaded: false,
    // 整体路由（一维数组格式）
    flatteningRoutes: [] as RouteRecordRaw[],
    // 缓存页面keepAlive（路由 name 归一为字符串，keep-alive include 按名称匹配）
    cachePageList: [] as string[],
    // 全局的授权
    permissionAuths: {} as Record<string, boolean>
  }),
  actions: {
    handleWholeAuths(auths: string[]) {
      this.permissionAuths = {};
      auths.forEach(auth => {
        this.permissionAuths[auth] = true;
      });
    },
    /** 组装整体路由生成的菜单 */
    handleWholeMenus(routes: RouteRecordRaw[]) {
      // 路由联合类型与菜单消费类型不重叠：经 toMenuTree 显式转换（path/name/meta/children）
      this.wholeMenus = toMenuTree(
        filterNoPermissionTree(
          filterTree(
            ascending(this.constantMenus.concat(routes) as RouteRecordRaw[])
          ),
          useUserStoreHook().roles ?? []
        )
      );
      this.flatteningRoutes = formatFlatteningRoutes(
        this.constantMenus.concat(routes) as RouteRecordRaw[]
      );
      this.menusLoaded = true;
    },
    /** 监听缓存页面是否存在于标签页，不存在则删除 */
    clearCache() {
      // Set 化：旧实现对每个缓存页做 findIndex + indexOf（O(n²)），标签页多时
      // 每次关闭/刷新都会连续重扫
      const names = new Set(
        getKeyList(useMultiTagsStoreHook().multiTags, "name")
      );
      this.cachePageList = this.cachePageList.filter(name => names.has(name));
    },
    cacheOperate({ mode, name }: cacheType) {
      const delIndex = this.cachePageList.findIndex(v => v === name);
      switch (mode) {
        case "refresh":
          this.cachePageList = this.cachePageList.filter(v => v !== name);
          this.clearCache();
          break;
        case "add":
          this.cachePageList.push(String(name));
          break;
        case "delete":
          if (delIndex !== -1) {
            this.cachePageList.splice(delIndex, 1);
          }
          this.clearCache();
          break;
      }
    },
    /** 清空缓存页面 */
    clearAllCachePage() {
      this.wholeMenus = [];
      this.cachePageList = [];
      this.flatteningRoutes = [];
      this.menusLoaded = false;
    }
  }
});

export function usePermissionStoreHook() {
  return usePermissionStore(store);
}
