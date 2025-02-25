import { defineStore } from "pinia";
import {
  ascending,
  type cacheType,
  constantMenus,
  debounce,
  filterNoPermissionTree,
  filterTree,
  formatFlatteningRoutes,
  getKeyList,
  store
} from "../utils";
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
    permissionAuths: {}
  }),
  actions: {
    handleWholeAuths(auths: any[]) {
      this.permissionAuths = {};
      auths.forEach(auth => {
        this.permissionAuths[auth] = true;
      });
    },
    /** 组装整体路由生成的菜单 */
    handleWholeMenus(routes: any[]) {
      this.wholeMenus = filterNoPermissionTree(
        filterTree(ascending(this.constantMenus.concat(routes)))
      );
      this.flatteningRoutes = formatFlatteningRoutes(
        this.constantMenus.concat(routes) as any
      );
    },
    cacheOperate({ mode, name }: cacheType) {
      const delIndex = this.cachePageList.findIndex(v => v === name);
      switch (mode) {
        case "refresh":
          this.cachePageList = this.cachePageList.filter(v => v !== name);
          break;
        case "add":
          this.cachePageList.push(name);
          break;
        case "delete":
          if (delIndex !== -1) {
            this.cachePageList.splice(delIndex, 1);
          }
          break;
      }
      /** 监听缓存页面是否存在于标签页，不存在则删除 */
      debounce(() => {
        let cacheLength = this.cachePageList.length;
        const nameList = getKeyList(useMultiTagsStoreHook().multiTags, "name");
        while (cacheLength > 0) {
          if (
            nameList.findIndex(
              v => v === this.cachePageList[cacheLength - 1]
            ) === -1
          ) {
            this.cachePageList.splice(
              this.cachePageList.indexOf(this.cachePageList[cacheLength - 1]),
              1
            );
          }
          cacheLength--;
        }
      })();
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
