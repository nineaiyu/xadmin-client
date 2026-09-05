import { defineStore } from "pinia";
import {
  ascending,
  type cacheType,
  constantMenus,
  filterNoPermissionTree,
  filterTree,
  formatFlatteningRoutes,
  getKeyList,
  store
} from "../utils";
import type { RouteRecordRaw } from "vue-router";
import { useMultiTagsStoreHook } from "./multiTags";

export const usePermissionStore = defineStore("pure-permission", {
  state: () => ({
    // 静态路由生成的菜单
    constantMenus,
    // 整体路由生成的菜单（静态、动态）
    wholeMenus: [],
    // 整体路由（一维数组格式）
    flatteningRoutes: [],
    // 缓存页面keepAlive
    cachePageList: [],
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
      this.wholeMenus = filterNoPermissionTree(
        // Pinia 会对 state 做 UnwrapRef 映射，路由联合类型经映射后与 RouteRecordRaw 失去直接可赋值性，需在边界断言
        filterTree(
          ascending(this.constantMenus.concat(routes) as RouteRecordRaw[])
        )
      );
      this.flatteningRoutes = formatFlatteningRoutes(
        // 同上：UnwrapRef 映射后需在边界断言
        this.constantMenus.concat(routes) as RouteRecordRaw[]
      );
    },
    /** 监听缓存页面是否存在于标签页，不存在则删除 */
    clearCache() {
      let cacheLength = this.cachePageList.length;
      const nameList = getKeyList(useMultiTagsStoreHook().multiTags, "name");
      while (cacheLength > 0) {
        if (
          nameList.findIndex(v => v === this.cachePageList[cacheLength - 1]) ===
          -1
        )
          this.cachePageList.splice(
            this.cachePageList.indexOf(this.cachePageList[cacheLength - 1]),
            1
          );
        cacheLength--;
      }
    },
    cacheOperate({ mode, name }: cacheType) {
      const delIndex = this.cachePageList.findIndex(v => v === name);
      switch (mode) {
        case "refresh":
          this.cachePageList = this.cachePageList.filter(v => v !== name);
          this.clearCache();
          break;
        case "add":
          this.cachePageList.push(name);
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
    }
  }
});

export function usePermissionStoreHook() {
  return usePermissionStore(store);
}
